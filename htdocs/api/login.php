<?php
require_once '../config/session_config.php';
header('Content-Type: application/json');

require_once '../config/db_connect.php';

$username = $_POST['username'] ?? '';
$password = $_POST['password'] ?? '';

if (empty($username) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Username and password are required']);
    exit;
}

// Fetch user
$stmt = $mysqli->prepare("SELECT sno, username, password, role FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if ($user && (password_verify($password, $user['password']) || $user['password'] === $password)) {
    // Set session
    $_SESSION['user_id'] = $user['sno'];
    $_SESSION['role'] = $user['role'];

    echo json_encode([
        "success" => true,
        "message" => "Login successful",
        "token" => bin2hex(random_bytes(16)), // optional
        "username" => $user['username'],
        "role" => $user['role'],
        "user_id" => $user['sno']
    ]);
} else {
    echo json_encode([
        "success" => false,
        "message" => "Invalid username or password"
    ]);
}