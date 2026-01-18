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

function updateAccountBalance($db, $accountId, $amount) {
    if (!$accountId) return;
    $stmt = $db->prepare("SELECT balance FROM accounts WHERE id = ?");
    $stmt->execute([$accountId]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($account) {
        $newBalance = floatval($account['balance']) + floatval($amount);
        $update = $db->prepare("UPDATE accounts SET balance = ? WHERE id = ?");
        $update->execute([$newBalance, $accountId]);
    }
}

function updateInvoicePayments($db, $invoiceId) {
    if (!$invoiceId) return;
    
    $stmt = $db->prepare("SELECT SUM(amount) as paid FROM payments WHERE invoice_id = ?");
    $stmt->execute([$invoiceId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $paidAmount = floatval($result['paid'] ?? 0);
    
    $stmtInv = $db->prepare("SELECT total_amount FROM invoices WHERE id = ?");
    $stmtInv->execute([$invoiceId]);
    $invoice = $stmtInv->fetch(PDO::FETCH_ASSOC);
    
    if ($invoice) {
        $total = floatval($invoice['total_amount']);
        $due = max(0, $total - $paidAmount);
        
        $status = 'Pending';
        if ($paidAmount >= $total) $status = 'Paid';
        else if ($paidAmount > 0) $status = 'Partial';
        
        $upd = $db->prepare("UPDATE invoices SET paid_amount=?, due_amount=?, status=? WHERE id=?");
        $upd->execute([$paidAmount, $due, $status, $invoiceId]);
    }
}

switch ($method) {
    case 'GET':
        $stmt = $db->prepare("SELECT * FROM payments ORDER BY date DESC");
        $stmt->execute();
        $payments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($payments);
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        $id = generate_uuid();
        
        try {
            $db->beginTransaction();
            
            $sql = "INSERT INTO payments (id, client_id, invoice_id, date, amount, method, notes, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            $stmt = $db->prepare($sql);
            
            $stmt->execute([
                $id,
                $data->clientId,
                $data->invoiceId ?? null,
                $data->date,
                $data->amount,
                $data->method,
                $data->notes ?? null,
                $data->accountId ?? null
            ]);
            
            // Update Invoice Status
            if ($data->invoiceId) {
                updateInvoicePayments($db, $data->invoiceId);
                
                // Profit Calculation Logic (Simplified from TS)
                if ($data->accountId) {
                    // Fetch invoice to calc profit margin
                     $invStmt = $db->prepare("SELECT * FROM invoices WHERE id = ?");
                     $invStmt->execute([$data->invoiceId]);
                     $invoice = $invStmt->fetch(PDO::FETCH_ASSOC);
                     
                     if ($invoice) {
                         // Fetch items
                         $itmStmt = $db->prepare("SELECT * FROM invoice_items WHERE invoice_id = ?");
                         $itmStmt->execute([$data->invoiceId]);
                         $items = $itmStmt->fetchAll(PDO::FETCH_ASSOC);
                         
                         $totalAdActualCost = 0;
                         $totalOtherActualCost = 0;
                         
                         foreach($items as $item) {
                             if ($item['item_type'] === 'AdCost') $totalAdActualCost += $item['actual_cost'];
                             else $totalOtherActualCost += $item['actual_cost'];
                         }
                         
                         $usdSpend = $totalAdActualCost / ($invoice['fb_dollar_rate'] ?: 122);
                         $supplierPayment = $usdSpend * ($invoice['supplier_dollar_rate'] ?: 128);
                         $totalActualCost = $supplierPayment + $totalOtherActualCost;

                         $profitMargin = 0;
                         if ($invoice['total_amount'] > 0) {
                             $profitMargin = ($invoice['total_amount'] - $totalActualCost) / $invoice['total_amount'];
                         }
                         
                         $paymentProfit = $data->amount * $profitMargin;
                         updateAccountBalance($db, $data->accountId, $paymentProfit);
                     }
                }
            }
            
            $db->commit();
            $data->id = $id;
            echo json_encode($data);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(["message" => "Error creating payment: " . $e->getMessage()]);
        }
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
        
        $stmt = $db->prepare("SELECT * FROM payments WHERE id = ?");
        $stmt->execute([$id]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($payment) {
            $del = $db->prepare("DELETE FROM payments WHERE id = ?");
            $del->execute([$id]);
            
            if ($payment['invoice_id']) {
                updateInvoicePayments($db, $payment['invoice_id']);
            }
            
            $db->commit();
            echo json_encode(["message" => "Payment deleted", "success" => true]);
        } else {
            $db->rollBack();
            http_response_code(404);
            echo json_encode(["message" => "Payment not found"]);
        }
        break;
}
?>
