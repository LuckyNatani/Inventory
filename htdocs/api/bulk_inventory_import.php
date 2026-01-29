<?php
require_once '../config/session_config.php';
require_once '../config/db_connect.php';

header('Content-Type: application/json');

// Permission Check
$role_string = $_SESSION['role'] ?? '';
$user_roles = explode(',', $role_string);
if (empty(array_intersect($user_roles, ['admin', 'sub-admin', 'production']))) {
    http_response_code(403);
    echo json_encode(['error' => 'Permission denied']);
    exit;
}

$input = json_decode(file_get_contents("php://input"), true);
$items = $input['items'] ?? [];

if (empty($items)) {
    echo json_encode(['results' => []]);
    exit;
}

$response = [];
$userId = $_SESSION['user_id'];

foreach ($items as $row) {
    // Normalize keys to lowercase for easier handling
    $row = array_change_key_case($row, CASE_LOWER);
    
    $sku = trim($row['sku'] ?? '');
    
    if (empty($sku)) {
        $response[] = ['sku' => 'N/A', 'success' => false, 'message' => 'Missing SKU'];
        continue;
    }

    // Determine if we are updating or inserting
    $check = $mysqli->query("SELECT id FROM inventory WHERE sku = '$sku'");
    $exists = $check && $check->num_rows > 0;
    
    // Extract fields
    $category = $row['category'] ?? '';
    $rack = $row['rack'] ?? $row['rack_location'] ?? '';
    $cost = isset($row['cost']) ? (float)$row['cost'] : null;
    $status = strtolower($row['status'] ?? '');
    
    // Sizes
    $s = isset($row['s']) && is_numeric($row['s']) ? (int)$row['s'] : null;
    $m = isset($row['m']) && is_numeric($row['m']) ? (int)$row['m'] : null;
    $l = isset($row['l']) && is_numeric($row['l']) ? (int)$row['l'] : null;
    $xl = isset($row['xl']) && is_numeric($row['xl']) ? (int)$row['xl'] : null;
    $xxl = isset($row['xxl']) && is_numeric($row['xxl']) ? (int)$row['xxl'] : null;
    $xxxl = isset($row['xxxl']) && is_numeric($row['xxxl']) ? (int)$row['xxxl'] : null;
    
    $min_stock = isset($row['min_stock']) && is_numeric($row['min_stock']) ? (int)$row['min_stock'] : null;

    if ($exists) {
        // UPDATE
        $updates = [];
        $types = "";
        $params = [];
        
        if ($category !== '') { $updates[] = "category=?"; $types .= "s"; $params[] = $category; }
        if ($rack !== '') { $updates[] = "rack_location=?"; $types .= "s"; $params[] = $rack; }
        if ($status !== '' && in_array($status, ['active', 'discontinued', 'archived'])) { $updates[] = "status=?"; $types .= "s"; $params[] = $status; }
        
        // Only update sizes if provided
        if (!is_null($s)) { $updates[] = "s=?"; $types .= "i"; $params[] = $s; }
        if (!is_null($m)) { $updates[] = "m=?"; $types .= "i"; $params[] = $m; }
        if (!is_null($l)) { $updates[] = "l=?"; $types .= "i"; $params[] = $l; }
        if (!is_null($xl)) { $updates[] = "xl=?"; $types .= "i"; $params[] = $xl; }
        if (!is_null($xxl)) { $updates[] = "xxl=?"; $types .= "i"; $params[] = $xxl; }
        if (!is_null($xxxl)) { $updates[] = "xxxl=?"; $types .= "i"; $params[] = $xxxl; }
        
        if (!is_null($min_stock)) { $updates[] = "min_stock_alert=?"; $types .= "i"; $params[] = $min_stock; }
        
        // Always update modified info
        $updates[] = "updated_by=?"; $types .= "i"; $params[] = $userId;
        $updates[] = "updated_at=NOW()";

        if (empty($updates)) {
             $response[] = ['sku' => $sku, 'success' => true, 'message' => 'No changes detected/mapped'];
             continue;
        }
        
        // Handle Rack Location Table update
        if ($rack !== '') {
             $racks = explode(',', $rack);
             foreach($racks as $r) {
                 $rc = trim($r);
                 if($rc) {
                     $mysqli->query("INSERT IGNORE INTO rack_locations (rack_code, is_active) VALUES ('$rc', 1)");
                 }
             }
        }

        $sql = "UPDATE inventory SET " . implode(', ', $updates) . " WHERE sku = ?";
        $types .= "s";
        $params[] = $sku;
        
        $stmt = $mysqli->prepare($sql);
        $stmt->bind_param($types, ...$params);
        
        if ($stmt->execute()) {
             // Handle Cost Update if provided (separate table)
             if (!is_null($cost)) {
                 $mysqli->query("INSERT INTO sku_costings (sku, total_cost, updated_at) VALUES ('$sku', $cost, NOW()) ON DUPLICATE KEY UPDATE total_cost=$cost, updated_at=NOW()");
             }
             $response[] = ['sku' => $sku, 'success' => true, 'message' => 'Updated successfully'];
        } else {
             $response[] = ['sku' => $sku, 'success' => false, 'message' => 'Update failed: ' . $stmt->error];
        }

    } else {
        // INSERT
        // Defaults
        $cat = $category ?: 'Uncategorized';
        $si = $s ?? 0;
        $mi = $m ?? 0;
        $li = $l ?? 0;
        $xli = $xl ?? 0;
        $xxli = $xxl ?? 0;
        $xxxli = $xxxl ?? 0;
        $rl = $rack ?: '';
        $ms = $min_stock ?? 10;
        $st = $status ?: 'active';
        $img = rawurlencode($sku); // Default image path
        
        $stmt = $mysqli->prepare("INSERT INTO inventory (sku, category, s, m, l, xl, xxl, xxxl, rack_location, min_stock_alert, status, img1, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)");
        $stmt->bind_param("ssiiiiiiissis", $sku, $cat, $si, $mi, $li, $xli, $xxli, $xxxli, $rl, $ms, $st, $img, $userId);
        
        if ($stmt->execute()) {
             // Handle Rack
             if ($rl !== '') {
                 $racks = explode(',', $rl);
                 foreach($racks as $r) {
                     $rc = trim($r);
                     if($rc) {
                         $mysqli->query("INSERT IGNORE INTO rack_locations (rack_code, is_active) VALUES ('$rc', 1)");
                     }
                 }
             }
             // Handle Cost
             if (!is_null($cost)) {
                 $mysqli->query("INSERT INTO sku_costings (sku, total_cost, updated_at) VALUES ('$sku', $cost, NOW()) ON DUPLICATE KEY UPDATE total_cost=$cost, updated_at=NOW()");
             }
             
             $response[] = ['sku' => $sku, 'success' => true, 'message' => 'Created successfully'];
        } else {
             $response[] = ['sku' => $sku, 'success' => false, 'message' => 'Create failed: ' . $stmt->error];
        }
    }
}

echo json_encode(['results' => $response]);
?>
