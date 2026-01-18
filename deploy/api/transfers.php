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

switch ($method) {
    case 'GET':
        $stmt = $db->prepare("SELECT * FROM transfers ORDER BY date DESC");
        $stmt->execute();
        $transfers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($transfers);
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        
        if (!isset($data->fromAccountId) || !isset($data->toAccountId) || !isset($data->amount)) {
            http_response_code(400);
            echo json_encode(["message" => "From, To, and Amount are required"]);
            exit();
        }

        $id = generate_uuid();
        
        try {
            $db->beginTransaction();
            
            $sql = "INSERT INTO transfers (id, from_account_id, to_account_id, amount, date, notes) VALUES (?, ?, ?, ?, ?, ?)";
            $stmt = $db->prepare($sql);
            
            $stmt->execute([
                $id,
                $data->fromAccountId,
                $data->toAccountId,
                $data->amount,
                $data->date,
                $data->notes ?? null
            ]);
            
            // Update Balances
            updateAccountBalance($db, $data->fromAccountId, -floatval($data->amount));
            updateAccountBalance($db, $data->toAccountId, floatval($data->amount));
            
            $db->commit();
            
            $data->id = $id;
            echo json_encode($data);
        } catch (Exception $e) {
            $db->rollBack();
            http_response_code(500);
            echo json_encode(["message" => "Error creating transfer: " . $e->getMessage()]);
        }
        break;
}
?>
