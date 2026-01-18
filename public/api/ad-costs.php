<?php
require_once '../../php/db.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Optional: filter by invoice_id? 
        $invoiceId = $_GET['invoiceId'] ?? null;
        
        if ($invoiceId) {
            $stmt = $db->prepare("SELECT * FROM ad_costs WHERE invoice_id = ?");
            $stmt->execute([$invoiceId]);
        } else {
            // Fetch all ad costs (maybe date range filtered in production)
            $stmt = $db->prepare("SELECT * FROM ad_costs ORDER BY date DESC");
            $stmt->execute();
        }
        
        $adCosts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($adCosts);
        break;


    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['clientId'], $data['date'], $data['spendBdt'], $data['platform'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        $id = generate_uuid();
        $stmt = $db->prepare("INSERT INTO ad_costs (id, client_id, date, platform, campaign_name, spend_bdt, invoiced) VALUES (?, ?, ?, ?, ?, ?, 0)");
        
        try {
            $stmt->execute([
                $id,
                $data['clientId'],
                $data['date'],
                $data['platform'],
                $data['campaignName'] ?? '',
                $data['spendBdt']
            ]);
            
            // Add ID to response
            $data['id'] = $id;
            echo json_encode($data);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        break;

    case 'DELETE':
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $parts = explode('/', trim($path, '/'));
        $id = end($parts);
        
        if ($id && $id !== 'ad-costs.php' && $id !== 'ad-costs') {
            $stmt = $db->prepare("DELETE FROM ad_costs WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        } else {
             http_response_code(400);
            echo json_encode(['error' => 'ID required']);
        }
        break;
}

function generate_uuid() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}
?>
