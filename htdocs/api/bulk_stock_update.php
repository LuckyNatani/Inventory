<?php
require_once '../config/session_config.php';
require_once '../config/db_connect.php';

header('Content-Type: application/json');

// Permission Check
$role_string = $_SESSION['role'] ?? '';
$user_roles = explode(',', $role_string);
if (empty(array_intersect($user_roles, ['admin', 'sub-admin', 'production', 'stocker']))) {
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
$validSizes = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'];

foreach ($items as $row) {
    $sku = trim($row['sku'] ?? '');
    $size = strtolower(trim($row['size'] ?? ''));
    $action = strtolower(trim($row['action'] ?? ''));
    $quantity = isset($row['quantity']) ? (int)$row['quantity'] : 0;

    // Validate inputs
    if (empty($sku)) {
        $response[] = ['sku' => $row['rawSku'] ?? 'N/A', 'success' => false, 'message' => 'Missing SKU'];
        continue;
    }

    if (!in_array($size, $validSizes)) {
        $response[] = ['sku' => $row['rawSku'] ?? $sku, 'success' => false, 'message' => "Invalid size: $size"];
        continue;
    }

    if (!in_array($action, ['increase', 'decrease'])) {
        $response[] = ['sku' => $row['rawSku'] ?? $sku, 'success' => false, 'message' => "Invalid action: $action"];
        continue;
    }

    if ($quantity <= 0) {
        $response[] = ['sku' => $row['rawSku'] ?? $sku, 'success' => false, 'message' => 'Quantity must be greater than 0'];
        continue;
    }

    // Check if SKU exists
    $stmt = $mysqli->prepare("SELECT id, $size as current_qty FROM inventory WHERE sku = ? AND status != 'archived'");
    $stmt->bind_param("s", $sku);
    $stmt->execute();
    $result = $stmt->get_result();
    $product = $result->fetch_assoc();
    $stmt->close();

    if (!$product) {
        $response[] = ['sku' => $row['rawSku'] ?? $sku, 'success' => false, 'message' => "SKU not found: $sku"];
        continue;
    }

    $inventoryId = $product['id'];
    $currentVal = (int)$product['current_qty'];

    // Calculate new value
    if ($action === 'increase') {
        $newVal = $currentVal + $quantity;
        $qtyChange = $quantity;
    } else {
        $newVal = max(0, $currentVal - $quantity);
        $qtyChange = $newVal - $currentVal; // actual change, e.g. 0 - 2 = -2
    }

    // Update inventory
    $updateStmt = $mysqli->prepare("UPDATE inventory SET $size = ?, updated_by = ?, updated_at = NOW() WHERE id = ?");
    $updateStmt->bind_param("iii", $newVal, $userId, $inventoryId);

    if ($updateStmt->execute()) {
        // Log audit
        $auditAction = $action === 'increase' ? 'bulk_increase' : 'bulk_decrease';
        $oldStr = (string)$currentVal;
        $newStr = (string)$newVal;
        $auditStmt = $mysqli->prepare("INSERT INTO inventory_audit_log (inventory_id, sku, action, field_changed, old_value, new_value, quantity_change, changed_by, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'bulk_update', NULL, ?)");
        $notes = "Bulk $action: $quantity on $size";
        $auditStmt->bind_param("isssssiis", $inventoryId, $sku, $auditAction, $size, $oldStr, $newStr, $qtyChange, $userId, $notes);
        $auditStmt->execute();
        $auditStmt->close();

        $actionLabel = $action === 'increase' ? 'Increased' : 'Decreased';
        $clampNote = ($action === 'decrease' && $quantity > $currentVal) ? ' (clamped to 0)' : '';
        $response[] = [
            'sku' => $row['rawSku'] ?? ($sku . '_' . strtoupper($size)),
            'success' => true,
            'message' => "$actionLabel $size by $quantity ($currentVal → $newVal)$clampNote"
        ];
    } else {
        $response[] = [
            'sku' => $row['rawSku'] ?? $sku,
            'success' => false,
            'message' => 'Update failed: ' . $updateStmt->error
        ];
    }
    $updateStmt->close();
}

echo json_encode(['results' => $response]);
?>
