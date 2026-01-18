<?php
// Configuration for Hostinger Environment
define('DB_HOST', 'localhost'); // Internal connection on Hostinger
define('DB_NAME', 'u632925822_agencybilling');
define('DB_USER', 'u632925822_userbill'); 
define('DB_PASS', 'Redowan173123');

// CORS Configuration
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
