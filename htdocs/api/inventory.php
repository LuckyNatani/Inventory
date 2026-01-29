<?php
require_once '../config/session_config.php';
require_once '../config/db_connect.php';

// Disable error displaying for API to prevents JSON corruption
ini_set('display_errors', 0);
error_reporting(E_ALL); // Log errors but don't display them

header('Content-Type: application/json');

// --- AUTHENTICATION & SECURITY ---

$public_actions = ['list', 'get'];
$action = $_GET['action'] ?? 'list';

// Check if authentication is required
if (!in_array($action, $public_actions) && !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$role_string = $_SESSION['role'] ?? 'guest';
$user_roles = explode(',', $role_string);

// Permissions
// Edit: Admin, Sub-Admin, Stocker, Production
$can_edit = !empty(array_intersect($user_roles, ['admin', 'sub-admin', 'stocker', 'production']));
// Delete: Admin, Sub-Admin ONLY
$can_delete = !empty(array_intersect($user_roles, ['admin', 'sub-admin']));

function escape($val) {
  global $mysqli;
  return $mysqli->real_escape_string($val);
}

function logAudit($inventory_id, $sku, $action, $field, $old_val, $new_val, $qty_change, $user_id, $ref_type = 'manual', $ref_id = null, $notes = '') {
    global $mysqli;
    $stmt = $mysqli->prepare("INSERT INTO inventory_audit_log (inventory_id, sku, action, field_changed, old_value, new_value, quantity_change, changed_by, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if ($stmt) {
        $stmt->bind_param("isssssiisss", $inventory_id, $sku, $action, $field, $old_val, $new_val, $qty_change, $user_id, $ref_type, $ref_id, $notes);
        $stmt->execute();
    }
}

function handleRackLocations($rack_string) {
    global $mysqli;
    if (empty($rack_string)) return;
    
    $racks = explode(',', $rack_string);
    foreach ($racks as $r) {
        $code = trim($r);
        if ($code === '') continue;
        
        $stmt = $mysqli->prepare("INSERT IGNORE INTO rack_locations (rack_code, is_active) VALUES (?, 1)");
        if ($stmt) {
            $stmt->bind_param("s", $code);
            $stmt->execute();
            $stmt->close();
        }
    }
}

function processImageUpload($tmpName, $sku) {
    if (empty($sku)) return false;
    
    $info = getimagesize($tmpName);
    if (!$info) return false;
    
    $mime = $info['mime'];
    $image = false;
    switch ($mime) {
        case 'image/jpeg': $image = imagecreatefromjpeg($tmpName); break;
        case 'image/png': $image = imagecreatefrompng($tmpName); break;
        case 'image/webp': $image = imagecreatefromwebp($tmpName); break;
        case 'image/gif': $image = imagecreatefromgif($tmpName); break;
    }
    
    if (!$image) return false;
    
    $skuFilename = rawurlencode($sku);
    $targetDir = "../assets/images/products/";
    if (!is_dir($targetDir)) mkdir($targetDir, 0755, true);
    $targetFile = $targetDir . $skuFilename . ".webp";
    
    $width = imagesx($image);
    $height = imagesy($image);
    $maxDim = 1500; 

    if ($width > $maxDim || $height > $maxDim) {
        $ratio = $width / $height;
        if ($width > $height) {
            $newWidth = $maxDim;
            $newHeight = $maxDim / $ratio;
        } else {
            $newHeight = $maxDim;
            $newWidth = $maxDim * $ratio;
        }
        $newImage = imagecreatetruecolor($newWidth, $newHeight);
        
        imagealphablending($newImage, false);
        imagesavealpha($newImage, true);
        imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($image);
        $image = $newImage;
    }

    imagewebp($image, $targetFile, 60);
    clearstatcache();
    imagedestroy($image);
    
    return $skuFilename;
}

// --- LOGIC ---

if ($action === 'list' || $action === '') {
    $page = (int)($_GET['page'] ?? 1);
    $limit = (int)($_GET['limit'] ?? 20);
    $offset = ($page - 1) * $limit;
    $search = escape($_GET['search'] ?? '');
    $category = $_GET['category'] ?? 'all';
    $stock = $_GET['stock'] ?? '';
    $rack = escape($_GET['rack_location'] ?? '');
    $sort = $_GET['sort'] ?? 'sku';

    $where = "WHERE i.status != 'archived'";
    if ($search !== '') {
        $like = "%$search%";
        $where .= " AND (i.sku LIKE '" . escape($like) . "' OR i.category LIKE '" . escape($like) . "')";
    }
    if ($category !== 'all') {
        $where .= " AND i.category = '" . escape($category) . "'";
    }
    if ($rack !== '') {
        $where .= " AND i.rack_location = '" . escape($rack) . "'";
    }
    if ($stock === 'low') {
        // Updated Logic: Any size <= min_stock_alert AND Total > 0
        $where .= " AND (s <= i.min_stock_alert OR m <= i.min_stock_alert OR l <= i.min_stock_alert OR xl <= i.min_stock_alert OR xxl <= i.min_stock_alert OR xxxl <= i.min_stock_alert) 
                    AND (s+m+l+xl+xxl+xxxl) > 0";
    } elseif ($stock === 'zero') {
        $where .= " AND (i.s=0 AND i.m=0 AND i.l=0 AND i.xl=0 AND i.xxl=0 AND i.xxxl=0)";
    } elseif ($stock === 'active') {
        $where .= " AND (i.s+i.m+i.l+i.xl+i.xxl+i.xxxl) > 0";
    }

    $orderBy = "ORDER BY i.sku ASC";
    if ($sort === 'total_desc') {
        $orderBy = "ORDER BY (i.s+i.m+i.l+i.xl+i.xxl+i.xxxl) DESC";
    } elseif ($sort === 'total_asc') {
        $orderBy = "ORDER BY (i.s+i.m+i.l+i.xl+i.xxl+i.xxxl) ASC";
    } elseif ($sort === 'value_desc') {
        $orderBy = "ORDER BY ((i.s+i.m+i.l+i.xl+i.xxl+i.xxxl) * IF(COALESCE(sc.total_cost, 0) > 0, sc.total_cost, COALESCE(i.purchase_cost, 0))) DESC";
    } elseif ($sort === 'value_asc') {
        $orderBy = "ORDER BY ((i.s+i.m+i.l+i.xl+i.xxl+i.xxxl) * IF(COALESCE(sc.total_cost, 0) > 0, sc.total_cost, COALESCE(i.purchase_cost, 0))) ASC";
    } elseif ($sort === 'updated') {
        $orderBy = "ORDER BY i.updated_at DESC";
    }

    $items = [];
    $query = "SELECT i.*, 
                     (SELECT username FROM users WHERE sno = i.updated_by) as updated_by_name,
                     sc.total_cost as cost_price
              FROM inventory i
              LEFT JOIN sku_costings sc ON i.sku = sc.sku
              $where 
              $orderBy 
              LIMIT $offset, $limit";
              
    $result = $mysqli->query($query);
    if (!$result) {
        http_response_code(500);
        echo json_encode(["valid" => false, "error" => "Query failed: " . $mysqli->error]);
        exit;
    }
    
    while ($row = $result->fetch_assoc()) {
        $items[] = $row;
    }

    $totalRes = $mysqli->query("SELECT COUNT(*) as total FROM inventory i $where");
    if (!$totalRes) {
        http_response_code(500);
        echo json_encode(["valid" => false, "error" => "Count query failed: " . $mysqli->error]);
        exit;
    }
    $total = $totalRes->fetch_assoc()['total'];

    // Stats
    $s1 = $mysqli->query("SELECT COUNT(*) as total FROM inventory WHERE status != 'archived'");
    $stats['total'] = $s1 ? (int)$s1->fetch_assoc()['total'] : 0;

    $s2 = $mysqli->query("SELECT COUNT(*) as low FROM inventory WHERE status != 'archived' AND (s <= min_stock_alert OR m <= min_stock_alert OR l <= min_stock_alert OR xl <= min_stock_alert OR xxl <= min_stock_alert OR xxxl <= min_stock_alert) AND (s+m+l+xl+xxl+xxxl) > 0");
    $stats['low'] = $s2 ? (int)$s2->fetch_assoc()['low'] : 0;

    $s3 = $mysqli->query("SELECT COUNT(*) as zero FROM inventory WHERE status != 'archived' AND (s=0 AND m=0 AND l=0 AND xl=0 AND xxl=0 AND xxxl=0)");
    $stats['zero'] = $s3 ? (int)$s3->fetch_assoc()['zero'] : 0;
    
    // New Stat: Total with Stock
    $s4 = $mysqli->query("SELECT COUNT(*) as active FROM inventory WHERE status != 'archived' AND (s+m+l+xl+xxl+xxxl) > 0");
    $stats['active'] = $s4 ? (int)$s4->fetch_assoc()['active'] : 0;

    echo json_encode([
        "items" => $items,
        "total" => $total,
        "stats" => $stats
    ]);

} elseif ($action === 'get' && isset($_GET['id'])) {
    $id = (int) $_GET['id'];
    $stmt = $mysqli->prepare("SELECT i.*, sc.total_cost as cost_price 
                              FROM inventory i 
                              LEFT JOIN sku_costings sc ON i.sku = sc.sku 
                              WHERE i.id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    $product = $result->fetch_assoc();

    if ($product) {
        echo json_encode($product);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Product not found"]);
    }

} elseif ($action === 'add') {
    if (!$can_edit) {
        http_response_code(403);
        echo json_encode(['error' => 'Permission denied']);
        exit;
    }

    $isMultipart = strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false;
    if ($isMultipart) {
        $data = $_POST;
    } else {
        $data = json_decode(file_get_contents("php://input"), true);
    }
    
    if (empty($data['sku'])) {
        $data['sku'] = strtoupper(substr($data['category'], 0, 3) . '-' . uniqid());
    }

    handleRackLocations($data['rack_location'] ?? '');

    // Live Links
    $live_links = escape($data['live_links'] ?? '');

    // Purchase Cost
    $purchase_cost = $data['purchase_cost'] ?? 0.00;

    $stmt = $mysqli->prepare("INSERT INTO inventory (sku, category, s, m, l, xl, xxl, xxxl, rack_location, img1, min_stock_alert, status, updated_by, created_at, updated_at, live_links, purchase_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    
    // Use session user_id always for security
    $auth_user_id = $_SESSION['user_id'];
    
    $status = $data['status'] ?? 'active';
    $min_stock = $data['min_stock_alert'] ?? 10;
    $current_time = date('Y-m-d H:i:s');

    $data['img1'] = rawurlencode($data['sku']);

    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploaded = processImageUpload($_FILES['image']['tmp_name'], $data['sku']);
        if ($uploaded) {
            $data['img1'] = $uploaded;
        }
    }

    $stmt->bind_param(
        "ssiiiiiissisisssd",
        $data['sku'], $data['category'],
        $data['s'], $data['m'], $data['l'], $data['xl'],
        $data['xxl'], $data['xxxl'], $data['rack_location'],
        $data['img1'], $min_stock, $status, $auth_user_id, $current_time, $current_time,
        $live_links, $purchase_cost
    );
    
    try {
        if ($stmt->execute()) {
            $new_id = $mysqli->insert_id;
            logAudit($new_id, $data['sku'], 'add', 'all', '', 'New Product', 0, $auth_user_id);
            echo json_encode(["success" => true, "id" => $new_id]);
        } else {
            throw new Exception($stmt->error);
        }
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() == 1062) {
            http_response_code(409);
            echo json_encode(["error" => "Duplicate entry: Product with this SKU already exists."]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Database error: " . $e->getMessage()]);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(["error" => $e->getMessage()]);
    }

} elseif ($action === 'update') {
    if (!$can_edit) {
        http_response_code(403);
        echo json_encode(['error' => 'Permission denied']);
        exit;
    }

    $isMultipart = strpos($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data') !== false;
    if ($isMultipart) {
        $data = $_POST;
    } else {
        $data = json_decode(file_get_contents("php://input"), true);
    }
    
    $id = $data['editingId'];
    
    $oldRes = $mysqli->query("SELECT * FROM inventory WHERE id=$id");
    $oldData = $oldRes->fetch_assoc();

    handleRackLocations($data['rack_location'] ?? '');

    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploaded = processImageUpload($_FILES['image']['tmp_name'], $data['sku']);
        if ($uploaded) {
            $data['img1'] = $uploaded;
        }
    } else {
        $data['img1'] = $oldData['img1'];
    }
    
    if (empty($data['img1'])) { 
         $data['img1'] = rawurlencode($data['sku']);
    }

    // Live Links
    $live_links = escape($data['live_links'] ?? '');

    // Purchase Cost
    $purchase_cost = $data['purchase_cost'] ?? 0.00;

    $stmt = $mysqli->prepare("UPDATE inventory SET sku=?, category=?, s=?, m=?, l=?, xl=?, xxl=?, xxxl=?, rack_location=?, img1=?, min_stock_alert=?, status=?, updated_by=?, updated_at=?, live_links=?, purchase_cost=? WHERE id=?");
    
    $auth_user_id = $_SESSION['user_id'];
    $current_time = date('Y-m-d H:i:s');

    $stmt->bind_param(
        "ssiiiiiissisissdi",
        $data['sku'], $data['category'],
        $data['s'], $data['m'], $data['l'], $data['xl'],
        $data['xxl'], $data['xxxl'], $data['rack_location'],
        $data['img1'], $data['min_stock_alert'], $data['status'], $auth_user_id, $current_time,
        $live_links, $purchase_cost,
        $id
    );
    
    try {
        if ($stmt->execute()) {
            $fields = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl', 'rack_location', 'status', 'purchase_cost'];
            foreach ($fields as $f) {
                if (isset($oldData[$f]) && isset($data[$f]) && $oldData[$f] != $data[$f]) {
                    $diff = is_numeric($data[$f]) && is_numeric($oldData[$f]) ? $data[$f] - $oldData[$f] : 0;
                    logAudit($id, $oldData['sku'], 'update', $f, $oldData[$f], $data[$f], $diff, $auth_user_id);
                }
            }
            echo json_encode(["success" => true]);
        } else {
            throw new Exception($stmt->error);
        }
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() == 1062) {
            http_response_code(409);
            echo json_encode(["error" => "Duplicate entry: SKU already exists."]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Database error: " . $e->getMessage()]);
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(["error" => $e->getMessage()]);
    }

} elseif ($action === 'delete') {
    if (!$can_delete) {
        http_response_code(403);
        echo json_encode(['error' => 'Permission denied']);
        exit;
    }

    $id = (int)$_GET['id'];
    $mysqli->query("UPDATE inventory SET status='archived' WHERE id=$id");
    echo json_encode(["success" => true]);

} elseif ($action === 'audit_log') {
    $sku = escape($_GET['sku'] ?? '');
    $page = (int)($_GET['page'] ?? 1);
    $limit = (int)($_GET['limit'] ?? 20);
    $offset = ($page - 1) * $limit;

    $res = $mysqli->query("SELECT * FROM inventory_audit_log WHERE sku='$sku' ORDER BY changed_at DESC LIMIT $offset, $limit");
    
    $logs = [];
    while ($row = $res->fetch_assoc()) {
        $logs[] = $row;
    }

    // Check if there are more
    $countRes = $mysqli->query("SELECT COUNT(*) as total FROM inventory_audit_log WHERE sku='$sku'");
    $total = $countRes->fetch_assoc()['total'];

    echo json_encode([
        'items' => $logs,
        'total' => $total,
        'hasMore' => ($offset + count($logs)) < $total
    ]);

} elseif ($action === 'category_stats') {
    // Admin only check ideally, but frontend handles visibility mostly.
    
    // Total Quantity by Category
    $qtyRes = $mysqli->query("SELECT category, SUM(s+m+l+xl+xxl+xxxl) as total_qty FROM inventory WHERE status!='archived' GROUP BY category");
    $qty_stats = [];
    while ($row = $qtyRes->fetch_assoc()) {
        $qty_stats[] = $row;
    }

    // Total Value by Category
    // Logic: If Manufacture Cost (sc.total_cost) exists (>0), use it. Else use Purchase Cost (i.purchase_cost).
    $valRes = $mysqli->query("SELECT i.category, SUM((i.s+i.m+i.l+i.xl+i.xxl+i.xxxl) * IF(COALESCE(sc.total_cost, 0) > 0, sc.total_cost, COALESCE(i.purchase_cost, 0))) as total_value FROM inventory i LEFT JOIN sku_costings sc ON i.sku = sc.sku WHERE i.status!='archived' GROUP BY category");
    $val_stats = [];
    while ($row = $valRes->fetch_assoc()) {
        $val_stats[] = $row;
    }

    echo json_encode(['qty' => $qty_stats, 'value' => $val_stats]);

} elseif ($action === 'rack_locations') {
    $res = $mysqli->query("SELECT * FROM rack_locations WHERE is_active=1 ORDER BY rack_code ASC");
    if (!$res) {
        http_response_code(500);
        echo json_encode(["valid" => false, "error" => "Rack query failed: " . $mysqli->error]);
        exit;
    }
    $racks = [];
    while ($row = $res->fetch_assoc()) {
        $racks[] = $row;
    }
    echo json_encode($racks);

} elseif ($action === 'export') {
    // FIX: Apply filters to export
    $search = escape($_GET['search'] ?? '');
    $category = $_GET['category'] ?? 'all';
    $stock = $_GET['stock'] ?? '';
    $rack = escape($_GET['rack_location'] ?? '');

    $where = "WHERE i.status != 'archived'";
    if ($search !== '') {
        $like = "%$search%";
        $where .= " AND (i.sku LIKE '" . escape($like) . "' OR i.category LIKE '" . escape($like) . "')";
    }
    if ($category !== 'all') {
        $where .= " AND i.category = '" . escape($category) . "'";
    }
    if ($rack !== '') {
        $where .= " AND i.rack_location = '" . escape($rack) . "'";
    }
    if ($stock === 'low') {
        $where .= " AND (i.s<20 OR i.m<20 OR i.l<20 OR i.xl<20 OR i.xxl<20 OR i.xxxl<20) 
                    AND (i.s+i.m+i.l+i.xl+i.xxl+i.xxxl) > 0";
    } elseif ($stock === 'zero') {
        $where .= " AND (i.s=0 AND i.m=0 AND i.l=0 AND i.xl=0 AND i.xxl=0 AND i.xxxl=0)";
    }

    header("Content-Type: application/vnd.ms-excel");
    header("Content-Disposition: attachment; filename=inventory_export.xls");
    
    echo "<table border='1'>";
    echo "<tr><th>SKU</th><th>Category</th><th>S</th><th>M</th><th>L</th><th>XL</th><th>XXL</th><th>XXXL</th><th>Total</th><th>Rack</th><th>Status</th><th>Purchase Cost</th><th>Manufacture Cost</th></tr>";
    
    $res = $mysqli->query("SELECT i.*, sc.total_cost FROM inventory i LEFT JOIN sku_costings sc ON i.sku = sc.sku $where");
    while ($row = $res->fetch_assoc()) {
        $total_qty = $row['s'] + $row['m'] + $row['l'] + $row['xl'] + $row['xxl'] + $row['xxxl'];
        $p_cost = $row['purchase_cost'] ?? 0;
        $m_cost = $row['total_cost'] ?? 0;
        // Use a more robust CSV-friendly way if needed, but HTML table works for XLS hack
        echo "<tr>
                <td>{$row['sku']}</td>
                <td>{$row['category']}</td>
                <td>{$row['s']}</td>
                <td>{$row['m']}</td>
                <td>{$row['l']}</td>
                <td>{$row['xl']}</td>
                <td>{$row['xxl']}</td>
                <td>{$row['xxxl']}</td>
                <td>{$total_qty}</td>
                <td>{$row['rack_location']}</td>

                <td>{$row['status']}</td>
                <td>{$p_cost}</td>
                <td>{$m_cost}</td>
              </tr>";
    }
    echo "</table>";
    exit;

} elseif ($action === 'increment_stock') {
    if (!$can_edit) {
        http_response_code(403);
        echo json_encode(['error' => 'Permission denied']);
        exit;
    }

    $data = json_decode(file_get_contents("php://input"), true);
    
    $skuFragment = escape($data['sku_fragment'] ?? '');
    $size = strtolower(escape($data['size'] ?? ''));
    $qty = (int)($data['quantity'] ?? 1);
    $userId = $_SESSION['user_id']; // Use session

    if (empty($skuFragment) || empty($size)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Missing SKU fragment or size"]);
        exit;
    }

    $validSizes = ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'];
    if (!in_array($size, $validSizes)) {
        http_response_code(400);
        echo json_encode(["success" => false, "error" => "Invalid size: $size"]);
        exit;
    }

    $query = "SELECT * FROM inventory WHERE sku LIKE '$skuFragment%' AND status != 'archived'";
    $result = $mysqli->query($query);
    
    $candidates = [];
    while ($row = $result->fetch_assoc()) {
        $candidates[] = $row;
    }

    if (count($candidates) === 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "error" => "No product found matching '$skuFragment'"]);
        exit;
    }
    
    if (count($candidates) > 1) {
        $candidateSkus = array_map(function($c) { return $c['sku']; }, $candidates);
        http_response_code(409);
        echo json_encode([
            "success" => false, 
            "error" => "Ambiguous match for '$skuFragment'",
            "candidates" => $candidateSkus
        ]);
        exit;
    }

    $product = $candidates[0];
    $inventoryId = $product['id'];
    $fullSku = $product['sku'];
    $currentVal = $product[$size];
    $newVal = $currentVal + $qty;

    $stmt = $mysqli->prepare("UPDATE inventory SET $size = ?, updated_by = ?, updated_at = NOW() WHERE id = ?");
    $stmt->bind_param("iii", $newVal, $userId, $inventoryId);
    
    if ($stmt->execute()) {
        logAudit($inventoryId, $fullSku, 'increment_voice', $size, $currentVal, $newVal, $qty, $userId, 'voice_input', null, "Voice added $qty to $size");
        echo json_encode([
            "success" => true,
            "sku" => $fullSku,
            "size" => $size,
            "new_quantity" => $newVal,
            "message" => "Updated $fullSku ($size) to $newVal"
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "error" => "Database update failed: " . $mysqli->error]);
    }
}

$mysqli->close();
?>
