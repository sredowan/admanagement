<?php
require_once '../php/db.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();

$method = $_SERVER['REQUEST_METHOD'];

function generate_uuid() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
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

switch ($method) {
    case 'GET':
        $stmt = $db->prepare("SELECT * FROM expenses ORDER BY date DESC");
        $stmt->execute();
        $expenses = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($expenses);
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        
        // Basic Validation
        if (!isset($data->date) || !isset($data->amount) || !isset($data->category) || !isset($data->accountId)) {
            http_response_code(400);
            echo json_encode(["message" => "Missing required fields"]);
            exit();
        }

        $id = generate_uuid();
        $sql = "INSERT INTO expenses (id, date, amount, category, description, account_id, spending_type, linked_client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $db->prepare($sql);
        
        try {
            $db->beginTransaction();

            $stmt->execute([
                $id,
                $data->date,
                $data->amount,
                $data->category,
                $data->description ?? null,
                $data->accountId,
                $data->spendingType ?? 'Agency',
                $data->linkedClientId ?? null
            ]);
            
            // Decrease Balance
            updateAccountBalance($db, $data->accountId, -floatval($data->amount));
            
            $db->commit();
            
            $data->id = $id;
            echo json_encode($data);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(["message" => "Error creating expense: " . $e->getMessage()]);
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
        
        try {
            $db->beginTransaction();
            
            // Get expense details for refund
            $stmt = $db->prepare("SELECT * FROM expenses WHERE id = ?");
            $stmt->execute([$id]);
            $expense = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($expense) {
                // Refund Balance
                updateAccountBalance($db, $expense['account_id'], floatval($expense['amount']));
                
                $del = $db->prepare("DELETE FROM expenses WHERE id = ?");
                $del->execute([$id]);
                
                $db->commit();
                echo json_encode(["message" => "Expense deleted", "success" => true]);
            } else {
                $db->rollBack();
                http_response_code(404);
                echo json_encode(["message" => "Expense not found"]);
            }
        } catch (Exception $e) {
             $db->rollBack();
             http_response_code(500);
             echo json_encode(["message" => "Error deleting expense: " . $e->getMessage()]);
        }
        break;
}
?>
