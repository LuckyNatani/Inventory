<?php
require_once '../config/db_connect.php';

header('Content-Type: application/json');


$action = $_GET['action'] ?? '';

function escape($val) {
    global $mysqli;
    return $mysqli->real_escape_string($val);
}

// Helper to log audit
function logAudit($inventory_id, $sku, $action, $field, $old_val, $new_val, $qty_change, $user_id, $ref_type = 'manual', $ref_id = null, $notes = '') {
    global $mysqli;
    $stmt = $mysqli->prepare("INSERT INTO inventory_audit_log (inventory_id, sku, action, field_changed, old_value, new_value, quantity_change, changed_by, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("isssssiisss", $inventory_id, $sku, $action, $field, $old_val, $new_val, $qty_change, $user_id, $ref_type, $ref_id, $notes);
    $stmt->execute();
}

function updatePicklistSummary($picklist_id) {
    global $mysqli;
    
    // 1. Get Quantities from Items
    $sqlQty = "SELECT SUM(quantity_required) as total_qty, 
                      SUM(quantity_picked) as picked_qty 
               FROM picklist_items 
               WHERE picklist_id = $picklist_id";
    $resQty = $mysqli->query($sqlQty)->fetch_assoc();
    $total_quantity = $resQty['total_qty'] ?? 0;
    $picked_quantity = $resQty['picked_qty'] ?? 0;
    
    // 2. Substituted Qty
    $sqlSub = "SELECT SUM(s.substitute_quantity) as sub_qty 
               FROM substitutions s
               JOIN picklist_items pi ON s.original_item_id = pi.item_id
               WHERE pi.picklist_id = $picklist_id";
    $resSub = $mysqli->query($sqlSub)->fetch_assoc();
    $substituted_quantity = $resSub['sub_qty'] ?? 0;
    
    // 3. Update Picklists Table
    // Also update item counts here to ensure everything is in sync
    $sqlCounts = "SELECT COUNT(*) as total, 
                   SUM(CASE WHEN status = 'picked' THEN 1 ELSE 0 END) as picked,
                   SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
            FROM picklist_items 
            WHERE picklist_id = $picklist_id";
    $resCounts = $mysqli->query($sqlCounts)->fetch_assoc();
    
    $total_items = $resCounts['total'];
    $picked_items = $resCounts['picked'];
    $pending_items = $resCounts['pending'];

    $stmt = $mysqli->prepare("UPDATE picklists SET 
        total_items=?, picked_items=?, pending_items=?,
        total_quantity=?, picked_quantity=?, substituted_quantity=?
        WHERE picklist_id=?");
        
    $stmt->bind_param("iiiiiii", $total_items, $picked_items, $pending_items, 
                      $total_quantity, $picked_quantity, $substituted_quantity, $picklist_id);
    $stmt->execute();
}

if ($action === 'upload') {
    // Expecting JSON payload with items
    $data = json_decode(file_get_contents("php://input"), true);
    
    $platform = escape($data['platform']);
    $user_id = $data['user_id'] ?? 1;
    $items = $data['items']; // Array of {sku, size, quantity}

    // Create Picklist
    $total_items = count($items);
    $stmt = $mysqli->prepare("INSERT INTO picklists (platform, uploaded_by, total_items, pending_items, status) VALUES (?, ?, ?, ?, 'pending')");
    $stmt->bind_param("siii", $platform, $user_id, $total_items, $total_items);
    
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to create picklist"]);
        exit;
    }
    $picklist_id = $mysqli->insert_id;

    // Insert Items
    $warnings = [];
    $stmtItem = $mysqli->prepare("INSERT INTO picklist_items (picklist_id, sku, size, quantity_required, quantity_pending, rack_location) VALUES (?, ?, ?, ?, ?, ?)");
    
    foreach ($items as $item) {
        $sku = escape($item['sku']);
        $size = strtolower($item['size']);
        $qty = (int)$item['quantity'];

        // Check inventory for Rack Location and Stock
        $invRes = $mysqli->query("SELECT id, rack_location, $size FROM inventory WHERE sku='$sku'");
        $inv = $invRes->fetch_assoc();
        
        $rack = $inv ? $inv['rack_location'] : 'UNKNOWN';
        
        if (!$inv) {
            $warnings[] = "SKU $sku not found in inventory.";
        } elseif ($inv[$size] < $qty) {
            $warnings[] = "Low stock for $sku (Size $size). Req: $qty, Avail: {$inv[$size]}";
        }

        $stmtItem->bind_param("issdis", $picklist_id, $sku, $size, $qty, $qty, $rack);
        $stmtItem->execute();
    }

    updatePicklistSummary($picklist_id);

    echo json_encode([
        "success" => true,
        "picklist_id" => $picklist_id,
        "warnings" => $warnings
    ]);

} elseif ($action === 'list') {
    $status = escape($_GET['status'] ?? '');
    $picker_id = escape($_GET['picker_id'] ?? '');
    $picklist_id = escape($_GET['picklist_id'] ?? '');
    
    $where = "WHERE 1";
    if ($status && $status !== 'All') $where .= " AND status = '$status'";
    if ($picker_id) $where .= " AND assigned_to = $picker_id";
    if ($picklist_id) $where .= " AND p.picklist_id = $picklist_id"; // Use p.picklist_id

    $res = $mysqli->query("SELECT p.*, u.username as picker_name FROM picklists p LEFT JOIN users u ON p.assigned_to = u.sno $where ORDER BY upload_date DESC");
    $list = [];
    while ($row = $res->fetch_assoc()) {
        $list[] = $row;
    }
    echo json_encode($list);

} elseif ($action === 'assign') {
    $data = json_decode(file_get_contents("php://input"), true);
    $picklist_id = (int)$data['picklist_id'];
    $picker_id = (int)$data['picker_id'];
    
    // Status in_progress, but started_at is NOT set here
    $mysqli->query("UPDATE picklists SET assigned_to=$picker_id, status='in_progress' WHERE picklist_id=$picklist_id");
    echo json_encode(["success" => true]);

} elseif ($action === 'start') {
    $data = json_decode(file_get_contents("php://input"), true);
    $picklist_id = (int)$data['picklist_id'];
    
    // Only set started_at if it's NULL
    $mysqli->query("UPDATE picklists SET status='in_progress', started_at=COALESCE(started_at, NOW()) WHERE picklist_id=$picklist_id");
    echo json_encode(["success" => true]);

} elseif ($action === 'pick_item') {
    $data = json_decode(file_get_contents("php://input"), true);
    $item_id = (int)$data['item_id'];
    $qty_picked = (int)$data['quantity_picked'];
    $qty_return = (int)($data['quantity_return'] ?? 0); // Quantity from return
    $status = escape($data['status']); // picked, partial, not_found
    $user_id = (int)$data['user_id'];
    $notes = escape($data['notes'] ?? '');

    // Get item details
    $itemRes = $mysqli->query("SELECT * FROM picklist_items WHERE item_id=$item_id");
    $item = $itemRes->fetch_assoc();
    
    if (!$item) {
        echo json_encode(["error" => "Item not found"]);
        exit;
    }

    // Get Substituted Quantity for this item
    $subRes = $mysqli->query("SELECT SUM(substitute_quantity) as sub_qty FROM substitutions WHERE original_item_id = $item_id");
    $subData = $subRes->fetch_assoc();
    $qty_substituted = (int)($subData['sub_qty'] ?? 0);

    // Update picklist item with both quantities
    // Pending = Required - Picked - Substituted
    $qty_pending = max(0, $item['quantity_required'] - $qty_picked - $qty_substituted);
    
    // If pending is 0, status should be 'picked' or 'substituted' (if not already set)
    // The frontend sends the status, but if we recalculated pending to 0 and status was partial, we might want to update it?
    // For now, trust the status sent BUT if pending is 0, ensure we don't leave it as 'pending' (though frontend shouldn't send 'pending' if it thinks it's done)
    
    $mysqli->query("UPDATE picklist_items SET quantity_picked=$qty_picked, quantity_return=$qty_return, quantity_pending=$qty_pending, status='$status', picked_at=NOW(), picked_by=$user_id, notes='$notes' WHERE item_id=$item_id");

    // Update Inventory & Log Audit
    // We need to calculate how much "Inventory Stock" was actually used.
    // Inventory Used = Total Picked - Return Picked.
    
    $old_total = $item['quantity_picked'];
    $old_return = $item['quantity_return'] ?? 0;
    
    $old_inv_used = $old_total - $old_return;
    $new_inv_used = $qty_picked - $qty_return;
    
    $inv_diff = $new_inv_used - $old_inv_used;

    if ($inv_diff != 0) {
        $sku = $item['sku'];
        $size = $item['size'];
        
        // Get current stock
        $invRes = $mysqli->query("SELECT id, $size FROM inventory WHERE sku='$sku'");
        $inv = $invRes->fetch_assoc();
        
        if ($inv) {
            // Subtract the difference from INVENTORY only
            $new_stock = max(0, $inv[$size] - $inv_diff);
            $current_time = date('Y-m-d H:i:s');
            $mysqli->query("UPDATE inventory SET $size=$new_stock, updated_by=$user_id, updated_at='$current_time' WHERE id={$inv['id']}");
            
            logAudit($inv['id'], $sku, 'pick', $size, $inv[$size], $new_stock, -$inv_diff, $user_id, 'picklist', $item['picklist_id'], "Picked: $qty_picked (Ret: $qty_return)");
        }
    }

    // Update Picklist Progress (Recalculate to ensure accuracy)
    $pid = $item['picklist_id'];
    $mysqli->query("UPDATE picklists p
                    SET 
                        p.picked_items = (SELECT COUNT(*) FROM picklist_items WHERE picklist_id = $pid AND status IN ('picked')),
                        p.pending_items = (SELECT COUNT(*) FROM picklist_items WHERE picklist_id = $pid AND status = 'pending')
                    WHERE p.picklist_id = $pid");

    // Update Summary
    updatePicklistSummary($pid);

    echo json_encode(["success" => true]);

} elseif ($action === 'complete') {
    $data = json_decode(file_get_contents("php://input"), true);
    $picklist_id = (int)$data['picklist_id'];
    
    // 1. Check for pending items
    $res = $mysqli->query("SELECT COUNT(*) as pending FROM picklist_items WHERE picklist_id=$picklist_id AND status='pending'");
    $pending = $res->fetch_assoc()['pending'];
    
    if ($pending > 0) {
        echo json_encode(["success" => false, "error" => "Cannot submit. Please process all pending items."]);
        exit;
    }

    // Determine Status
    $status = 'completed';
    
    // Update Picklist Status
    $current_time = date('Y-m-d H:i:s');
    $mysqli->query("UPDATE picklists SET status = '$status', completed_at = '$current_time' WHERE picklist_id = $picklist_id");

    echo json_encode(["success" => true, "status" => $status]);

} elseif ($action === 'pickers') {
    $res = $mysqli->query("SELECT sno as id, username as name FROM users WHERE role LIKE '%stocker%'");
    $pickers = [];
    while ($row = $res->fetch_assoc()) {
        $pickers[] = $row;
    }
    echo json_encode($pickers);

} elseif ($action === 'items') {
    $picklist_id = (int)$_GET['picklist_id'];
    // Join with inventory to get image
    $res = $mysqli->query("
        SELECT pi.*, i.img1 as image_url,
               COALESCE((SELECT SUM(original_quantity - sub.substitute_quantity) FROM substitutions sub WHERE sub.original_item_id = pi.item_id), 0) as sub_qty_placeholder, 
               COALESCE((SELECT SUM(sub.substitute_quantity) FROM substitutions sub WHERE sub.original_item_id = pi.item_id), 0) as substituted_quantity,
               (SELECT GROUP_CONCAT(CONCAT(sub.substitute_sku, ' (', sub.substitute_size, ')') SEPARATOR ', ') FROM substitutions sub WHERE sub.original_item_id = pi.item_id) as substituted_details
        FROM picklist_items pi 
        LEFT JOIN inventory i ON pi.sku = i.sku 
        WHERE pi.picklist_id=$picklist_id
    ");
    $items = [];
    while ($row = $res->fetch_assoc()) {
        $items[] = $row;
    }
    echo json_encode($items);
}

$mysqli->close();
?>
