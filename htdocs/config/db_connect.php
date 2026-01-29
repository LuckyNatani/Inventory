<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
date_default_timezone_set('Asia/Kolkata');

$mysqli = new mysqli("sql300.infinityfree.com", "if0_39430414", "yFvxr5LUR0O7Nr", "if0_39430414_test_inventory");

if ($mysqli->connect_errno) {
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database connection failed: " . $mysqli->connect_error]);
    exit();
}

$mysqli->query("SET time_zone = '+05:30'");
