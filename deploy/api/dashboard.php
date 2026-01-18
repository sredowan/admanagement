<?php
require_once '../php/db.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Basic Metrics
        $metrics = [];
        
        // Total Accounts Balance
        $stmt = $db->prepare("SELECT SUM(balance) as total FROM accounts");
        $stmt->execute();
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        $metrics['totalBalance'] = floatval($res['total'] ?? 0);
        
        // Total Receivables (Due)
        $stmt = $db->prepare("SELECT SUM(due_amount) as due FROM invoices WHERE status != 'Paid'");
        $stmt->execute();
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        $metrics['totalReceivables'] = floatval($res['due'] ?? 0);
        
        // Total Expenses (This Month)
        // Adjust for actual date handling in production
        $startOfMonth = date('Y-m-01');
        $endOfMonth = date('Y-m-t');
        
        $stmt = $db->prepare("SELECT SUM(amount) as expense FROM expenses WHERE date >= ? AND date <= ?");
        $stmt->execute([$startOfMonth, $endOfMonth]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        $metrics['monthlyExpenses'] = floatval($res['expense'] ?? 0);
        
        // Total Invoiced (This Month)
        $stmt = $db->prepare("SELECT SUM(total_amount) as invoiced FROM invoices WHERE invoice_date >= ? AND invoice_date <= ?");
        $stmt->execute([$startOfMonth, $endOfMonth]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        $metrics['monthlyInvoiced'] = floatval($res['invoiced'] ?? 0);
        
        echo json_encode($metrics);
        break;
}
?>
