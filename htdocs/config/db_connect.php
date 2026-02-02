<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
date_default_timezone_set('Asia/Kolkata');

$host = "127.0.0.1:3306";
$master_user = "u988569002_eazyinventory";
$master_pass = "7@BgliVI";
$master_db = "u988569002_eazyinventory";

// 1. Connect to Master DB
$mysqli = new mysqli($host, $master_user, $master_pass, $master_db);

if ($mysqli->connect_errno) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Master DB connection failed: " . $mysqli->connect_error]);
    exit();
}

// 2. Determine Subdomain
$subdomain = null;
if (isset($_SERVER['HTTP_HOST'])) {
    $host_parts = explode('.', $_SERVER['HTTP_HOST']);
    // Logic: if host is 'sub.domain.com', parts are ['sub', 'domain', 'com']
    // If it's a subdomain, we expect at least 3 parts (localhost might be an exception to handle)
    if (count($host_parts) >= 3) {
        $subdomain = $host_parts[0];
    }
}

// 3. Lookup Client Credentials
if ($subdomain && $subdomain !== 'www' && $subdomain !== 'eazyinventory') { // Exclude 'www' or main domain part
    $stmt = $mysqli->prepare("SELECT db_name, db_user, db_pass FROM clients WHERE subdomain = ? AND status = 'active'");
    if ($stmt) {
        $stmt->bind_param("s", $subdomain);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            // Found a client! Switch databases.
            $client_db_name = $row['db_name'];
            $client_db_user = $row['db_user']; 
            $client_db_pass = $row['db_pass'];

            // Close master connection
            $mysqli->close();

            // Connect to Client DB
            // Note: Assuming same host. If different, add db_host col to clients table.
            $mysqli = new mysqli($host, $client_db_user, $client_db_pass, $client_db_name);

            if ($mysqli->connect_errno) {
                // Return generic error to avoid leaking details, or log it
                header('Content-Type: application/json');
                http_response_code(500);
                echo json_encode(["success" => false, "message" => "Client database connection failed."]);
                exit();
            }
        }
        $stmt->close();
    }
}

// Define Constant for Asset Paths
if (!defined('CLIENT_SUBDOMAIN')) {
    define('CLIENT_SUBDOMAIN', $subdomain ? $subdomain : 'default');
}

$mysqli->query("SET time_zone = '+05:30'");
