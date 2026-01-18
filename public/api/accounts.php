<?php
require_once '../../php/db.php';

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

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $stmt = $db->prepare("SELECT * FROM accounts WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            $account = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode($account ? $account : []);
        } else {
            $stmt = $db->prepare("SELECT * FROM accounts");
            $stmt->execute();
            $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($accounts);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        
        if (!isset($data->name) || !isset($data->type)) {
            http_response_code(400);
            echo json_encode(["message" => "Name and Type are required"]);
            exit();
        }

        $id = generate_uuid();
        $sql = "INSERT INTO accounts (id, name, type, balance, is_default) VALUES (?, ?, ?, ?, ?)";
        $stmt = $db->prepare($sql);
        
        try {
            $stmt->execute([
                $id,
                $data->name,
                $data->type,
                $data->balance ?? 0,
                $data->isDefault ?? 0 // boolean as 0/1
            ]);
            
            $data->id = $id;
            echo json_encode($data);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error creating account: " . $e->getMessage()]);
        }
        break;
        
    case 'PATCH': // React Query often sends PATCH for partial updates
    case 'PUT':
         $id = $_GET['id'] ?? null;
         // Handle URL segment ID if passed via rewrite, else query
         if (!$id) {
             // Fallback for some routers
             $pathInfo = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
             $id = end($pathInfo);
         }

         if (!$id || strlen($id) < 30) { // Basic UUID check
             http_response_code(400);
             echo json_encode(["message" => "ID is required"]);
             exit();
         }
         
         $data = json_decode(file_get_contents("php://input"));
         
         // Dynamic Update
         $fields = [];
         $params = [];
         
         if (isset($data->name)) { $fields[] = "name=?"; $params[] = $data->name; }
         if (isset($data->type)) { $fields[] = "type=?"; $params[] = $data->type; }
         if (isset($data->balance)) { $fields[] = "balance=?"; $params[] = $data->balance; }
         if (isset($data->isDefault)) { $fields[] = "is_default=?"; $params[] = $data->isDefault; }
         
         if (empty($fields)) {
             echo json_encode(["message" => "No fields to update"]);
             exit();
         }
         
         $params[] = $id;
         $sql = "UPDATE accounts SET " . implode(", ", $fields) . " WHERE id=?";
         $stmt = $db->prepare($sql);
         $stmt->execute($params);
         
         echo json_encode(["message" => "Account updated", "success" => true]);
        break;
        
    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) {
             // Fallback
             $pathInfo = explode('/', trim($_SERVER['PATH_INFO'] ?? '', '/'));
             $id = end($pathInfo);
        }
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "ID is required"]);
            exit();
        }
        $stmt = $db->prepare("DELETE FROM accounts WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["message" => "Account deleted", "success" => true]);
        break;
}
?>
