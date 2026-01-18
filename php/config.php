<?php
// Configuration for Hostinger Environment
define('DB_HOST', 'localhost'); // Usually localhost on Hostinger
define('DB_NAME', 'u123456789_dbname'); // REPLACE with your Hostinger DB Name
define('DB_USER', 'u123456789_dbuser'); // REPLACE with your Hostinger DB User
define('DB_PASS', 'YourStrongPassword123!'); // REPLACE with your Hostinger DB Password

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
