<?php
require_once '../../php/db.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

function generate_uuid() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

switch ($method) {
    case 'GET':
        // We need to return invoices WITH items for list view if frontend expects it
        // Or handle /api/invoices/:id
        $id = $_GET['id'] ?? null;
        if (!$id) {
             $pathInfo = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
             $id = end($pathInfo);
             if ($id === 'invoices' || $id === 'api') $id = null;
        }

        if ($id) {
            $stmt = $db->prepare("SELECT * FROM invoices WHERE id = ?");
            $stmt->execute([$id]);
            $invoice = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($invoice) {
                // Get Items
                $stmtItems = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
                $stmtItems->execute([$id]);
                $invoice['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode($invoice);
            } else {
                http_response_code(404);
                echo json_encode(["message" => "Invoice not found"]);
            }
        } else {
            // List all
            // Ideally we should limit or paginate,/ but let's match current implementation
             $stmt = $db->prepare("SELECT * FROM invoices ORDER BY invoice_date DESC");
             $stmt->execute();
             $invoices = $stmt->fetchAll(PDO::FETCH_ASSOC);
             
             // The storage.ts implementation loads items for ALL invoices in the list.
             // This is heavy but we must match it or frontend breaks.
             foreach ($invoices as &$inv) {
                 $stmtItems = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
                 $stmtItems->execute([$inv['id']]);
                 $inv['items'] = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
             }
             echo json_encode($invoices);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        $id = generate_uuid();
        
        try {
            $db->beginTransaction();
            
            $sql = "INSERT INTO invoices (id, invoice_number, client_id, invoice_date, period_start, period_end, status, subtotal, vat_amount, total_amount, paid_amount, due_amount, fb_dollar_rate, supplier_dollar_rate, bkash_fee_percent, include_bkash_fee, markup_percent, vat_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $db->prepare($sql);
            
            $stmt->execute([
                $id,
                $data->invoiceNumber,
                $data->clientId,
                $data->invoiceDate,
                $data->periodStart,
                $data->periodEnd,
                $data->status ?? 'Pending',
                0, 0, 0, 0, 0, // Calculated fields start at 0
                $data->fbDollarRate ?? 122,
                $data->supplierDollarRate ?? 128,
                $data->bkashFeePercent ?? 1.8,
                $data->includeBkashFee ?? 0,
                $data->markupPercent ?? 20,
                $data->vatPercent ?? 0,
                $data->notes ?? null
            ]);
            
            $db->commit();
            
            // Return struct
            $data->id = $id;
            echo json_encode($data);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(["message" => "Error creating invoice: " . $e->getMessage()]);
        }
        break;
        
    case 'PUT':
         // Update Logic (simplified)
         $id = $_GET['id'] ?? null;
         if (!$id) {
             $pathInfo = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
             $id = end($pathInfo);
         }
         
         $data = json_decode(file_get_contents("php://input"));
         
         // Assuming we only allow updating status or amounts, but really extensive updates are needed.
         // For now, let's implement status update which is common
         if (isset($data->status) || isset($data->paidAmount)) {
             $fields = [];
             $params = [];
             
             if (isset($data->status)) { $fields[] = "status=?"; $params[] = $data->status; }
             if (isset($data->paidAmount)) { $fields[] = "paid_amount=?"; $params[] = $data->paidAmount; }
             if (isset($data->dueAmount)) { $fields[] = "due_amount=?"; $params[] = $data->dueAmount; }
             
             $params[] = $id;
             $sql = "UPDATE invoices SET " . implode(", ", $fields) . " WHERE id=?";
             $stmt = $db->prepare($sql);
             $stmt->execute($params);
         }
         
         echo json_encode(["message" => "Invoice updated", "success" => true]);
        break;

    case 'DELETE':
         $id = $_GET['id'] ?? null;
         if (!$id) {
             $pathInfo = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
             $id = end($pathInfo);
         }
         
         if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "ID is required"]);
            exit();
        }
        
        $db->beginTransaction();
        
        // Delete items first
        $delItems = $db->prepare("DELETE FROM invoice_items WHERE invoice_id = ?");
        $delItems->execute([$id]);
        
        // Unlink ad costs
        $uplink = $db->prepare("UPDATE ad_costs SET invoiced = 0, invoice_id = NULL WHERE invoice_id = ?");
        $uplink->execute([$id]);
        
        // Delete invoice
        $delInv = $db->prepare("DELETE FROM invoices WHERE id = ?");
        $delInv->execute([$id]);
        
        $db->commit();
        echo json_encode(["message" => "Invoice deleted", "success" => true]);
        break;
}
?>
