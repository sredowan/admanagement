<?php
require_once '../../php/db.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $db->prepare("SELECT * FROM settings");
        $stmt->execute();
        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($settings);
        break;

    case 'POST':
         // Usually settings are key-value updates
         // Or getting a specific key via Query
         // Not heavily used in current app logic shown in traces, mostly simple Get
        break;
}
?>
