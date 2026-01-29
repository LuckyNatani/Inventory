<?php
require_once '../config/session_config.php';
require_once '../config/db_connect.php';

header('Content-Type: application/json');

// --- AUTHENTICATION ---
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$role_string = $_SESSION['role'] ?? 'guest';
$user_roles = explode(',', $role_string);
$allowed_roles = ['admin', 'sub-admin', 'production'];

if (empty(array_intersect($user_roles, $allowed_roles))) {
    http_response_code(403);
    echo json_encode(['error' => 'Permission denied']);
    exit;
}

// --- HELPER FUNCTIONS ---
function escape($val) {
    global $mysqli;
    return $mysqli->real_escape_string($val);
}

// Input: JSON { "items": [ { "sku": "ABC", "new_links": ["http...", "http..."] } ], "user_id": 123 }
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['items']) || !is_array($input['items'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid input format. Expected JSON with "items" array.']);
    exit;
}

$items = $input['items'];
$userId = $_SESSION['user_id'];
$timestamp = date('Y-m-d H:i:s');

$stats = [
    'total_processed' => 0,
    'success_count' => 0,
    'error_count' => 0,
    'results' => []
];

foreach ($items as $item) {
    $stats['total_processed']++;
    $sku = isset($item['sku']) ? trim($item['sku']) : '';
    $newLinks = isset($item['new_links']) && is_array($item['new_links']) ? $item['new_links'] : [];

    // Filter empty
    $newLinks = array_filter($newLinks, function($l) { return !empty(trim($l)); });

    if (empty($sku)) {
        $stats['results'][] = ['sku' => 'UNKNOWN', 'status' => 'error', 'message' => 'Missing SKU'];
        $stats['error_count']++;
        continue;
    }

    if (empty($newLinks)) {
        $stats['results'][] = ['sku' => $sku, 'status' => 'skipped', 'message' => 'No new links provided'];
        continue;
    }

    // Check SKU existence
    // We select ID and existing links
    $res = $mysqli->query("SELECT id, live_links FROM inventory WHERE sku = '" . escape($sku) . "' AND status != 'archived'");
    
    if (!$res || $res->num_rows === 0) {
        $stats['results'][] = ['sku' => $sku, 'status' => 'error', 'message' => 'SKU not found'];
        $stats['error_count']++;
        continue;
    }

    $row = $res->fetch_assoc();
    $inventoryId = $row['id'];
    $currentLinksRaw = $row['live_links'] ?? '';
    
    // Parse existing
    $currentLinks = [];
    if (!empty($currentLinksRaw)) {
        $parts = explode(',', $currentLinksRaw);
        foreach ($parts as $p) {
            $p = trim($p);
            if (!empty($p)) $currentLinks[] = $p;
        }
    }

    // Merge: Append new links if they don't exist
    $addedCount = 0;
    foreach ($newLinks as $link) {
        $link = trim($link);
        if (!in_array($link, $currentLinks)) {
            $currentLinks[] = $link;
            $addedCount++;
        }
    }

    if ($addedCount === 0) {
        $stats['results'][] = ['sku' => $sku, 'status' => 'skipped', 'message' => 'All links already exist'];
        continue;
    }

    // Update DB
    $finalLinksStr = implode(',', $currentLinks);
    $finalLinksEscaped = escape($finalLinksStr);

    $updateStmt = $mysqli->prepare("UPDATE inventory SET live_links = ?, updated_by = ?, updated_at = ? WHERE id = ?");
    $updateStmt->bind_param("sisi", $finalLinksStr, $userId, $timestamp, $inventoryId);

    if ($updateStmt->execute()) {
        $stats['success_count']++;
        $stats['results'][] = ['sku' => $sku, 'status' => 'success', 'message' => "Added $addedCount new link(s)"];
        
        // Audit Log (Optional but good)
        // We won't block on this failing
        $logSql = "INSERT INTO inventory_audit_log (inventory_id, sku, action, field_changed, old_value, new_value, changed_by, notes) 
                   VALUES ($inventoryId, '" . escape($sku) . "', 'bulk_link_update', 'live_links', '" . escape($currentLinksRaw) . "', '$finalLinksEscaped', $userId, 'Bulk Upload')";
        $mysqli->query($logSql);

    } else {
        $stats['error_count']++;
        $stats['results'][] = ['sku' => $sku, 'status' => 'error', 'message' => 'Database update failed: ' . $updateStmt->error];
    }
}

echo json_encode($stats);
$mysqli->close();
?>
