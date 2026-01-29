<?php
require_once '../config/db_connect.php';

header('Content-Type: application/json');

// Auth Check
require_once '../config/session_config.php';
$role_string = $_SESSION['role'] ?? '';
$user_roles = explode(',', $role_string);
if (!in_array('admin', $user_roles)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$action = $_GET['action'] ?? '';

function clean($val) {
    global $mysqli;
    return $mysqli->real_escape_string(trim($val));
}

if ($action === 'list') {
    $res = $mysqli->query("SELECT sno, username, role, mobile1, mobile2, aadhar_number, address, created_at FROM users ORDER BY sno DESC");
    $users = [];
    while ($row = $res->fetch_assoc()) $users[] = $row;
    echo json_encode(['success' => true, 'data' => $users]);
    exit;
}

if ($action === 'get') {
    $id = (int)($_GET['id'] ?? 0);
    $res = $mysqli->query("SELECT sno, username, password, role, mobile1, mobile2, aadhar_number, address FROM users WHERE sno=$id");
    if ($row = $res->fetch_assoc()) {
        echo json_encode(['success' => true, 'data' => $row]);
    } else {
        echo json_encode(['success' => false, 'message' => 'User not found']);
    }
    exit;
}

// POST Actions
$data = json_decode(file_get_contents("php://input"), true);

if ($action === 'create') {
    $username = clean($data['username'] ?? '');
    $password = $data['password'] ?? '';
    // Role is CSV
    $role = clean($data['role'] ?? 'viewer');
    $mobile1 = clean($data['mobile1'] ?? '');
    $mobile2 = clean($data['mobile2'] ?? '');
    $aadhar = clean($data['aadhar_number'] ?? '');
    $address = clean($data['address'] ?? '');

    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Username and Password required']);
        exit;
    }

    // Check Duplicate
    $check = $mysqli->query("SELECT sno FROM users WHERE username='$username'");
    if ($check->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Username already exists']);
        exit;
    }

    //$hash = password_hash($password, PASSWORD_DEFAULT);
    
    // Set Timezone
    date_default_timezone_set('Asia/Kolkata');
    $created_at = date('Y-m-d H:i:s');
    
    $stmt = $mysqli->prepare("INSERT INTO users (username, password, role, mobile1, mobile2, aadhar_number, address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssssss", $username, $password, $role, $mobile1, $mobile2, $aadhar, $address, $created_at);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

if ($action === 'update') {
    $id = (int)($data['id'] ?? 0);
    $username = clean($data['username'] ?? '');
    $role = clean($data['role'] ?? '');
    $mobile1 = clean($data['mobile1'] ?? '');
    $mobile2 = clean($data['mobile2'] ?? '');
    $aadhar = clean($data['aadhar_number'] ?? '');
    $address = clean($data['address'] ?? '');
    $password = $data['password'] ?? ''; // Optional

    if ($id <= 0 || empty($username)) {
        echo json_encode(['success' => false, 'message' => 'Invalid ID or Username']);
        exit;
    }

    // Check Duplicate (excluding self)
    $check = $mysqli->query("SELECT sno FROM users WHERE username='$username' AND sno != $id");
    if ($check->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Username taken']);
        exit;
    }

    $sql = "UPDATE users SET username=?, role=?, mobile1=?, mobile2=?, aadhar_number=?, address=?";
    $types = "ssssss";
    $params = [$username, $role, $mobile1, $mobile2, $aadhar, $address];

    if (!empty($password)) {
        //$hash = password_hash($password, PASSWORD_DEFAULT);
        $sql .= ", password=?";
        $types .= "s";
        $params[] = $password;
    }

    $sql .= " WHERE sno=?";
    $types .= "i";
    $params[] = $id;

    $stmt = $mysqli->prepare($sql);
    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

if ($action === 'delete') {
    $id = (int)($data['id'] ?? 0);
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid ID']);
        exit;
    }

    // Prevent deleting self?
    if ($id == $_SESSION['user_id']) {
        echo json_encode(['success' => false, 'message' => 'Cannot delete yourself']);
        exit;
    }

    if ($mysqli->query("DELETE FROM users WHERE sno=$id")) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

$mysqli->close();
?>
