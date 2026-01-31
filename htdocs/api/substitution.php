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

if ($action === 'pending_items') {
    $date = escape($_GET['date'] ?? '');
    $startDate = escape($_GET['start_date'] ?? '');
    $endDate = escape($_GET['end_date'] ?? '');
    
    $where = "pi.status IN ('pending', 'not_picked', 'partial', 'not_found') AND pi.quantity_pending > 0";
    
    if ($startDate && $endDate) {
        $where .= " AND DATE(p.upload_date) BETWEEN '$startDate' AND '$endDate'";
    } elseif ($date) {
        $where .= " AND DATE(p.upload_date) = '$date'";
    }

    $sql = "SELECT pi.*, p.platform, p.picklist_id, p.upload_date, i.img1, i.rack_location 
            FROM picklist_items pi 
            JOIN picklists p ON pi.picklist_id = p.picklist_id 
            LEFT JOIN inventory i ON pi.sku = i.sku 
            WHERE $where
            ORDER BY p.picklist_id DESC";
            
    $res = $mysqli->query($sql);
    $items = [];
    while ($row = $res->fetch_assoc()) {
        $items[] = $row;
    }
    echo json_encode($items);

} elseif ($action === 'substitution_history') {
    $date = escape($_GET['date'] ?? '');
    $startDate = escape($_GET['start_date'] ?? '');
    $endDate = escape($_GET['end_date'] ?? '');
    
    $where = "1";
    if ($startDate && $endDate) {
        $where .= " AND DATE(p.upload_date) BETWEEN '$startDate' AND '$endDate'";
    } elseif ($date) {
        $where .= " AND DATE(p.upload_date) = '$date'";
    }

    $sql = "SELECT s.*, u.username as substituted_by_name, p.upload_date 
            FROM substitutions s 
            LEFT JOIN users u ON s.substituted_by = u.sno
            JOIN picklist_items pi ON s.original_item_id = pi.item_id
            JOIN picklists p ON pi.picklist_id = p.picklist_id
            WHERE $where 
            ORDER BY p.upload_date DESC, s.substituted_at DESC";
            
    $res = $mysqli->query($sql);
    $history = [];
    while ($row = $res->fetch_assoc()) {
        $history[] = $row;
    }
    echo json_encode($history);

} elseif ($action === 'search_substitute') {
    $query = escape($_GET['query'] ?? '');
    $size = escape($_GET['size'] ?? '');
    
    $where = "WHERE status='active'";
    if ($query) {
        $where .= " AND (sku LIKE '%$query%' OR category LIKE '%$query%')";
    }
    // We do NOT filter by stock here anymore. 
    // Users might want to substitute with the SAME SKU but a DIFFERENT size.
    // if ($size) {
    //    $where .= " AND $size > 0";
    // }
    
    $res = $mysqli->query("SELECT * FROM inventory $where LIMIT 20");
    $items = [];
    while ($row = $res->fetch_assoc()) {
        $items[] = $row;
    }
    echo json_encode($items);

} elseif ($action === 'substitute') {
    $data = json_decode(file_get_contents("php://input"), true);
    
    $original_item_id = (int)$data['original_item_id'];
    $sub_sku = escape($data['substitute_sku']);
    $sub_size = escape($data['substitute_size']);
    $sub_qty = (int)$data['substitute_quantity'];
    $user_id = (int)$data['user_id'];
    $reason = escape($data['reason']);

    // Get Original Item Info
    $origRes = $mysqli->query("SELECT * FROM picklist_items WHERE item_id=$original_item_id");
    $origItem = $origRes->fetch_assoc();
    
    if (!$origItem) {
        echo json_encode(["error" => "Original item not found"]);
        exit;
    }

    // Get Substitute Inventory Info
    $subInvRes = $mysqli->query("SELECT id, $sub_size FROM inventory WHERE sku='$sub_sku'");
    $subInv = $subInvRes->fetch_assoc();
    
    if (!$subInv || $subInv[$sub_size] < $sub_qty) {
        echo json_encode(["error" => "Insufficient stock for substitute"]);
        exit;
    }

    // 1. Deduct Substitute Stock
    $new_stock = $subInv[$sub_size] - $sub_qty;
    $current_time = date('Y-m-d H:i:s');
    $mysqli->query("UPDATE inventory SET $sub_size=$new_stock, updated_by=$user_id, updated_at='$current_time' WHERE id={$subInv['id']}");
    logAudit($subInv['id'], $sub_sku, 'substitute', $sub_size, $subInv[$sub_size], $new_stock, -$sub_qty, $user_id, 'substitution', $original_item_id, "Substituted for {$origItem['sku']}");

    // 2. Create Substitution Record
    $stmt = $mysqli->prepare("INSERT INTO substitutions (original_item_id, original_sku, original_size, original_quantity, substitute_sku, substitute_size, substitute_quantity, substituted_by, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("issississ", $original_item_id, $origItem['sku'], $origItem['size'], $origItem['quantity_pending'], $sub_sku, $sub_size, $sub_qty, $user_id, $reason);
    $stmt->execute();

    // 3. Update Original Item Status
    $remaining_qty = $origItem['quantity_pending'] - $sub_qty;
    
    if ($remaining_qty > 0) {
        // Partial substitution
        $mysqli->query("UPDATE picklist_items SET quantity_pending=$remaining_qty WHERE item_id=$original_item_id");
    } else {
        // Full substitution
        $mysqli->query("UPDATE picklist_items SET status='substituted', quantity_pending=0 WHERE item_id=$original_item_id");
    }

    // Update Summary
    updatePicklistSummary($origItem['picklist_id']);

    echo json_encode(["success" => true]);
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
    // This is duplicate logic from picklist.php, ideally should be in a helper file, but for now copying is safer.
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

$mysqli->close();
?>
