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
        // Ad Cost linking logic (usually separate) or creation
        break;
}
?>
