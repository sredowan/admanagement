<?php
// Configuration for Hostinger Environment
// Configuration for Hostinger Environment
// Detect if running on localhost (dev) or production
$isLocal = in_array($_SERVER['REMOTE_ADDR'], ['127.0.0.1', '::1']) || strpos($_SERVER['HTTP_HOST'] ?? '', 'localhost') !== false;

if ($isLocal) {
    define('DB_HOST', 'srv2045.hstgr.io'); // Remote SQL for Local Dev
} else {
    define('DB_HOST', 'localhost'); // Internal connection on Production
}

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
