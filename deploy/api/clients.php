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

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            $stmt = $db->prepare("SELECT * FROM clients WHERE id = ?");
            $stmt->execute([$_GET['id']]);
            $client = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode($client ? $client : []);
        } else {
            $stmt = $db->prepare("SELECT * FROM clients");
            $stmt->execute();
            $clients = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($clients);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents("php://input"));
        
        if (!isset($data->companyName)) {
            http_response_code(400);
            echo json_encode(["message" => "Company Name is required"]);
            exit();
        }

        $id = generate_uuid();
        $sql = "INSERT INTO clients (id, company_name, contact_person, phone, email, billing_address, default_markup_percent, default_vat_percent, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $db->prepare($sql);
        
        try {
            $stmt->execute([
                $id,
                $data->companyName,
                $data->contactPerson ?? null,
                $data->phone ?? null,
                $data->email ?? null,
                $data->billingAddress ?? null,
                $data->defaultMarkupPercent ?? 20,
                $data->defaultVatPercent ?? 0,
                $data->notes ?? null
            ]);
            
            // Return the created object
            $data->id = $id;
            echo json_encode($data);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["message" => "Error creating client: " . $e->getMessage()]);
        }
        break;
        
    case 'PUT':
         // We need ID from URL usually, but let's check input or query param
         // For REST, it should be /api/clients.php?id=... or parsed from URL
         $id = $_GET['id'] ?? null;
         if (!$id) {
             http_response_code(400);
             echo json_encode(["message" => "ID is required for update"]);
             exit();
         }
         
         $data = json_decode(file_get_contents("php://input"));
         // Construct dynamic update SQL
         // Simplified for now: assume full update or check specific fields
         $sql = "UPDATE clients SET company_name=?, contact_person=?, phone=?, email=?, billing_address=?, default_markup_percent=?, default_vat_percent=?, notes=? WHERE id=?";
         $stmt = $db->prepare($sql);
         $stmt->execute([
            $data->companyName,
            $data->contactPerson ?? null,
            $data->phone ?? null,
            $data->email ?? null,
            $data->billingAddress ?? null,
            $data->defaultMarkupPercent ?? 20,
            $data->defaultVatPercent ?? 0,
            $data->notes ?? null,
            $id
         ]);
         echo json_encode(["message" => "Client updated", "success" => true]);
        break;
        
    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "ID is required for delete"]);
            exit();
        }
        $stmt = $db->prepare("DELETE FROM clients WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["message" => "Client deleted", "success" => true]);
        break;
}
?>
