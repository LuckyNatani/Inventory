<?php
require_once '../config/session_config.php';
require_once '../config/db_connect.php';

header('Content-Type: application/json');

// Helper for security
function clean_input($data) {
    global $mysqli;
    return $mysqli->real_escape_string(trim($data));
}

// Auth Check
// Auth Check - Relaxed for public actions
$action = $_REQUEST['action'] ?? '';

// Public actions that don't satisfy strict auth
$public_actions = ['get_master_data'];

if (!in_array($action, $public_actions) && !isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$user_id = $_SESSION['user_id'] ?? 0;
// Handle multiple roles (CSV)
$role_string = $_SESSION['role'] ?? 'guest';
$user_roles = explode(',', $role_string);

// Role Permissions
$can_write = !empty(array_intersect($user_roles, ['admin', 'sub-admin', 'production']));
$is_admin = !empty(array_intersect($user_roles, ['admin', 'sub-admin']));

// --- Master Data API ---

if ($action === 'get_master_data') {
    // Returns active segments and factories for UI dropdowns
    $show_all = isset($_GET['all']) && $_GET['all'] === 'true';
    
    $segments = [];
    $factories = [];
    
    $seg_sql = $show_all ? "SELECT * FROM segments ORDER BY name ASC" : "SELECT * FROM segments WHERE status='active' ORDER BY name ASC";
    $res_seg = $mysqli->query($seg_sql);
    while ($r = $res_seg->fetch_assoc()) $segments[] = $r;
    
    $fac_sql = $show_all ? "SELECT * FROM factories ORDER BY name ASC" : "SELECT * FROM factories WHERE status='active' ORDER BY name ASC";
    $res_fac = $mysqli->query($fac_sql);
    while ($r = $res_fac->fetch_assoc()) $factories[] = $r;

    $fabrics = [];
    $res_fab = $mysqli->query("SELECT * FROM fabrics ORDER BY name ASC");
    if ($res_fab) {
        while ($r = $res_fab->fetch_assoc()) $fabrics[] = $r;
    }

    $categories = [];
    $cat_sql = $show_all ? "SELECT * FROM product_categories ORDER BY name ASC" : "SELECT * FROM product_categories WHERE status='active' ORDER BY name ASC";
    $res_cat = $mysqli->query($cat_sql);
    if ($res_cat) {
        while ($r = $res_cat->fetch_assoc()) $categories[] = $r;
    }
    
    echo json_encode(['success' => true, 'segments' => $segments, 'factories' => $factories, 'fabrics' => $fabrics, 'categories' => $categories]);
    exit;
}

if ($action === 'manage_category') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $sub_action = $data['sub_action'] ?? 'create';
    
    if ($sub_action === 'create') {
        $name = clean_input($data['name']);
        if (empty($name)) { echo json_encode(['success' => false, 'message' => 'Name required']); exit; }
        
        // Check duplicate
        $check = $mysqli->query("SELECT category_id FROM product_categories WHERE name='$name'");
        if ($check->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Category already exists']);
            exit;
        }
        
        $stmt = $mysqli->prepare("INSERT INTO product_categories (name) VALUES (?)");
        if (!$stmt) { echo json_encode(['success' => false, 'message' => $mysqli->error]); exit; }
        $stmt->bind_param("s", $name);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'id' => $mysqli->insert_id, 'name' => $name]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    if ($sub_action === 'update') {
        $id = (int)$data['category_id'];
        $name = clean_input($data['name']);
        
        if (empty($name)) { echo json_encode(['success' => false, 'message' => 'Name required']); exit; }
        
        // Check duplicate excluding self
        $check = $mysqli->query("SELECT category_id FROM product_categories WHERE name='$name' AND category_id != $id");
        if ($check->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Category name already exists']);
            exit;
        }
        
        $stmt = $mysqli->prepare("UPDATE product_categories SET name=? WHERE category_id=?");
        if (!$stmt) { echo json_encode(['success' => false, 'message' => $mysqli->error]); exit; }
        $stmt->bind_param("si", $name, $id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    
    if ($sub_action === 'toggle_status') {
        $id = (int)$data['category_id'];
        $status = clean_input($data['status']); // 'active' or 'inactive'
        
        if (!in_array($status, ['active', 'inactive'])) {
             echo json_encode(['success' => false, 'message' => 'Invalid status']); exit;
        }
        
        $stmt = $mysqli->prepare("UPDATE product_categories SET status=? WHERE category_id=?");
        $stmt->bind_param("si", $status, $id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    exit;
}

if ($action === 'manage_segment') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $sub_action = $data['sub_action'] ?? 'create';
    
    if ($sub_action === 'create') {
        $name = clean_input($data['name']);
        if (empty($name)) { echo json_encode(['success' => false, 'message' => 'Name required']); exit; }
        
        // Check duplicate
        $check = $mysqli->query("SELECT segment_id FROM segments WHERE name='$name'");
        if ($check->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Segment already exists']);
            exit;
        }
        
        $stmt = $mysqli->prepare("INSERT INTO segments (name) VALUES (?)");
        if (!$stmt) { echo json_encode(['success' => false, 'message' => $mysqli->error]); exit; }
        $stmt->bind_param("s", $name);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'id' => $mysqli->insert_id, 'name' => $name]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    if ($sub_action === 'update') {
        $id = (int)$data['segment_id'];
        $name = clean_input($data['name']);
        
        if (empty($name)) { echo json_encode(['success' => false, 'message' => 'Name required']); exit; }
        
        // Check duplicate excluding self
        $check = $mysqli->query("SELECT segment_id FROM segments WHERE name='$name' AND segment_id != $id");
        if ($check->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Segment name already exists']);
            exit;
        }
        
        $stmt = $mysqli->prepare("UPDATE segments SET name=? WHERE segment_id=?");
        if (!$stmt) { echo json_encode(['success' => false, 'message' => $mysqli->error]); exit; }
        $stmt->bind_param("si", $name, $id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    
    if ($sub_action === 'toggle_status') {
        $id = (int)$data['segment_id'];
        $status = clean_input($data['status']); // 'active' or 'inactive'
        
        if (!in_array($status, ['active', 'inactive'])) {
             echo json_encode(['success' => false, 'message' => 'Invalid status']); exit;
        }
        
        $stmt = $mysqli->prepare("UPDATE segments SET status=? WHERE segment_id=?");
        $stmt->bind_param("si", $status, $id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }

    exit;
}

if ($action === 'manage_factory') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $sub_action = $data['sub_action'] ?? 'create';
    
    if ($sub_action === 'create') {
        $name = clean_input($data['name']);
        $contact = clean_input($data['contact_info'] ?? '');
        $contact2 = clean_input($data['contact_2'] ?? '');
        $contact3 = clean_input($data['contact_3'] ?? '');
        $address = clean_input($data['address'] ?? '');
        $gst = clean_input($data['gst_number'] ?? '');
        
        if (empty($name)) { echo json_encode(['success' => false, 'message' => 'Name required']); exit; }
        
        // Check duplicate
        $check = $mysqli->query("SELECT factory_id FROM factories WHERE name='$name'");
        if ($check->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Factory already exists']);
            exit;
        }
        
        $stmt = $mysqli->prepare("INSERT INTO factories (name, contact_info, contact_2, contact_3, address, gst_number) VALUES (?, ?, ?, ?, ?, ?)");
        if (!$stmt) { echo json_encode(['success' => false, 'message' => $mysqli->error]); exit; }
        $stmt->bind_param("ssssss", $name, $contact, $contact2, $contact3, $address, $gst);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'id' => $mysqli->insert_id, 'name' => $name]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }


    if ($sub_action === 'update') {
        $id = (int)$data['factory_id'];
        $name = clean_input($data['name']);
        $contact = clean_input($data['contact_info'] ?? '');
        $contact2 = clean_input($data['contact_2'] ?? '');
        $contact3 = clean_input($data['contact_3'] ?? '');
        $address = clean_input($data['address'] ?? '');
        $gst = clean_input($data['gst_number'] ?? '');
        
        if (empty($name)) { echo json_encode(['success' => false, 'message' => 'Name required']); exit; }
        
        // Check duplicate excluding self
        $check = $mysqli->query("SELECT factory_id FROM factories WHERE name='$name' AND factory_id != $id");
        if ($check->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Factory name already exists']);
            exit;
        }
        
        $stmt = $mysqli->prepare("UPDATE factories SET name=?, contact_info=?, contact_2=?, contact_3=?, address=?, gst_number=? WHERE factory_id=?");
        if (!$stmt) { echo json_encode(['success' => false, 'message' => $mysqli->error]); exit; }
        $stmt->bind_param("ssssssi", $name, $contact, $contact2, $contact3, $address, $gst, $id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    
    if ($sub_action === 'toggle_status') {
        $id = (int)$data['factory_id'];
        $status = clean_input($data['status']); // 'active' or 'inactive'
        
        if (!in_array($status, ['active', 'inactive'])) {
             echo json_encode(['success' => false, 'message' => 'Invalid status']); exit;
        }
        
        $stmt = $mysqli->prepare("UPDATE factories SET status=? WHERE factory_id=?");
        $stmt->bind_param("si", $status, $id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    exit;
}

if ($action === 'manage_fabric') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $sub_action = $data['sub_action'] ?? 'create';
    
    if ($sub_action === 'create') {
        $name = clean_input($data['name']);
        
        if (empty($name)) { echo json_encode(['success' => false, 'message' => 'Name required']); exit; }
        
        // Check duplicate
        $check = $mysqli->query("SELECT fabric_id FROM fabrics WHERE name='$name'");
        if ($check->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Fabric already exists']);
            exit;
        }
        
        $stmt = $mysqli->prepare("INSERT INTO fabrics (name) VALUES (?)");
        if (!$stmt) { echo json_encode(['success' => false, 'message' => $mysqli->error]); exit; }
        $stmt->bind_param("s", $name);
        if ($stmt->execute()) {
            echo json_encode(['success' => true, 'id' => $mysqli->insert_id, 'name' => $name]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    
    if ($sub_action === 'update') {
        $id = (int)$data['fabric_id'];
        $name = clean_input($data['name']);
        
        if (empty($name)) { echo json_encode(['success' => false, 'message' => 'Name required']); exit; }
        
        // Check duplicate excluding self
        $check = $mysqli->query("SELECT fabric_id FROM fabrics WHERE name='$name' AND fabric_id != $id");
        if ($check->num_rows > 0) {
            echo json_encode(['success' => false, 'message' => 'Fabric name already exists']);
            exit;
        }
        
        $stmt = $mysqli->prepare("UPDATE fabrics SET name=? WHERE fabric_id=?");
        if (!$stmt) { echo json_encode(['success' => false, 'message' => $mysqli->error]); exit; }
        $stmt->bind_param("si", $name, $id);
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => $mysqli->error]);
        }
    }
    exit;
}

// --- Rates API ---

if ($action === 'log_rate') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    
    $sku = clean_input($data['sku'] ?? '');
    $segment_id = (int)($data['segment_id'] ?? 0);
    $factory_id = (int)($data['factory_id'] ?? 0);
    $price = (float)($data['price'] ?? 0);
    $note = clean_input($data['note'] ?? '');
    
    if (empty($sku) || empty($segment_id) || empty($factory_id) || $price <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid input']);
        exit;
    }
    
    // Duplicate check (idempotency - same user, same sku/seg/fac, within last 2 seconds)
    $stmt_check = $mysqli->prepare("SELECT log_id FROM factory_price_logs WHERE sku=? AND segment_id=? AND factory_id=? AND created_by=? AND created_at > (NOW() - INTERVAL 2 SECOND)");
    $stmt_check->bind_param("siii", $sku, $segment_id, $factory_id, $user_id);
    $stmt_check->execute();
    if ($stmt_check->get_result()->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Duplicate submission detected']);
        exit;
    }
    
    // Get current names for snapshot
    $seg_name = '';
    $fac_name = '';
    $res_n = $mysqli->query("SELECT name FROM segments WHERE segment_id=$segment_id");
    if ($res_n && $r = $res_n->fetch_assoc()) $seg_name = $r['name'];
    
    $res_f = $mysqli->query("SELECT name FROM factories WHERE factory_id=$factory_id");
    if ($res_f && $r = $res_f->fetch_assoc()) $fac_name = $r['name'];

    $stmt = $mysqli->prepare("INSERT INTO factory_price_logs (sku, segment_id, factory_id, price, note, created_by, segment_name_snapshot, factory_name_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("siidsiss", $sku, $segment_id, $factory_id, $price, $note, $user_id, $seg_name, $fac_name);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'log_id' => $mysqli->insert_id]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

if ($action === 'get_rates') {
    $sku = clean_input($_GET['sku'] ?? '');
    $limit = (int)($_GET['limit'] ?? 50);
    $page = (int)($_GET['page'] ?? 1);
    $offset = ($page - 1) * $limit;
    
    if (empty($sku)) {
         echo json_encode(['success' => false, 'message' => 'SKU required']);
         exit;
    }

    // Build History Query Filters
    $where = "WHERE l.sku = '$sku'";
    
    if (isset($_GET['voided']) && $_GET['voided'] === 'false') {
        $where .= " AND l.voided_flag = 0";
    }
    
    if (!empty($_GET['segment_id'])) {
        $sid = (int)$_GET['segment_id'];
        $where .= " AND l.segment_id = $sid";
    }
    if (!empty($_GET['factory_id'])) {
        $fid = (int)$_GET['factory_id'];
        $where .= " AND l.factory_id = $fid";
    }
    if (!empty($_GET['date_start'])) {
        $ds = clean_input($_GET['date_start']);
        $where .= " AND DATE(l.created_at) >= '$ds'";
    }
    if (!empty($_GET['date_end'])) {
        $de = clean_input($_GET['date_end']);
        $where .= " AND DATE(l.created_at) <= '$de'";
    }

    // Get Total Count for Pagination
    $count_res = $mysqli->query("SELECT COUNT(*) as total FROM factory_price_logs l $where");
    $total_rows = $count_res->fetch_assoc()['total'];
    $total_pages = ceil($total_rows / $limit);

    // Get History
    $sql = "SELECT l.*, 
                   COALESCE(l.segment_name_snapshot, s.name) as segment_name, 
                   COALESCE(l.factory_name_snapshot, f.name) as factory_name, 
                   u.username as created_by_name 
            FROM factory_price_logs l
            LEFT JOIN segments s ON l.segment_id = s.segment_id
            LEFT JOIN factories f ON l.factory_id = f.factory_id
            LEFT JOIN users u ON l.created_by = u.sno
            $where
            ORDER BY l.created_at DESC
            LIMIT $offset, $limit";
            
    $result = $mysqli->query($sql);
    $logs = [];
    while ($row = $result->fetch_assoc()) {
        $logs[] = $row;
    }
    
    // Get Latest Summary (Latest price per segment - UNFILTERED by date/factory usually, as it's "Current Status")
    // We want the latest log for each segment for this SKU, but only non-voided ones
    $summary_sql = "
        SELECT l.price, l.created_at, 
               COALESCE(l.segment_name_snapshot, s.name) as segment_name, 
               COALESCE(l.factory_name_snapshot, f.name) as factory_name, 
               u.username as created_by_name
        FROM factory_price_logs l
        JOIN (
            SELECT segment_id, MAX(log_id) as max_id
            FROM factory_price_logs
            WHERE sku = '$sku' AND voided_flag = 0
            GROUP BY segment_id
        ) latest ON l.log_id = latest.max_id
        LEFT JOIN segments s ON l.segment_id = s.segment_id
        LEFT JOIN factories f ON l.factory_id = f.factory_id
        LEFT JOIN users u ON l.created_by = u.sno
    ";
    $summary_res = $mysqli->query($summary_sql);
    $summary = [];
    while ($row = $summary_res->fetch_assoc()) {
        $summary[] = $row;
    }
    
    // Get SKU Metadata
    $meta_sql = "SELECT * FROM inventory WHERE sku = '$sku' LIMIT 1";
    $meta_res = $mysqli->query($meta_sql);
    $meta = $meta_res->fetch_assoc();
    
    echo json_encode([
        'success' => true, 
        'logs' => $logs, 
        'summary' => $summary, 
        'meta' => $meta,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $total_pages,
            'total_items' => $total_rows
        ]
    ]);
    exit;
}

if ($action === 'void_rate') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $log_id = (int)$data['log_id'];
    $reason = clean_input($data['reason']);
    
    if (empty($reason)) {
        echo json_encode(['success' => false, 'message' => 'Reason required']);
        exit;
    }
    
    $stmt = $mysqli->prepare("UPDATE factory_price_logs SET voided_flag = 1, void_reason = ?, voided_by = ?, voided_at = NOW() WHERE log_id = ?");
    $stmt->bind_param("sii", $reason, $user_id, $log_id);
    
    if ($stmt->execute()) {
         echo json_encode(['success' => true]);
    } else {
         echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

if ($action === 'export_rates') {
    // Basic CSV Export
    $sku = clean_input($_GET['sku'] ?? '');
    if (empty($sku)) { die("SKU Required"); }
    
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="rates_' . $sku . '.csv"');
    
    $output = fopen('php://output', 'w');
    fputcsv($output, ['SKU', 'Segment', 'Factory', 'Price', 'Note', 'Created By', 'Created At', 'Voided', 'Void Reason']);
    
    $sql = "SELECT l.sku, 
                   COALESCE(l.segment_name_snapshot, s.name) as segment, 
                   COALESCE(l.factory_name_snapshot, f.name) as factory, 
                   l.price, l.note, u.username, l.created_at, l.voided_flag, l.void_reason
            FROM factory_price_logs l
            LEFT JOIN segments s ON l.segment_id = s.segment_id
            LEFT JOIN factories f ON l.factory_id = f.factory_id
            LEFT JOIN users u ON l.created_by = u.sno
            WHERE l.sku = '$sku'
            ORDER BY l.created_at DESC";
            
     $res = $mysqli->query($sql);
     while ($row = $res->fetch_assoc()) {
         $row['voided_flag'] = $row['voided_flag'] ? 'Yes' : 'No';
         fputcsv($output, $row);
     }
     fclose($output);
     exit;
}

if ($action === 'search_sku') {
    $term = clean_input($_GET['term'] ?? '');
    if (empty($term)) { echo json_encode([]); exit; }
    
    // Search inventory for matching SKUs (limit 10)
    $stmt = $mysqli->prepare("SELECT sku FROM inventory WHERE sku LIKE ? LIMIT 10");
    $searchTerm = "%$term%";
    $stmt->bind_param("s", $searchTerm);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $results = [];
    while ($row = $res->fetch_assoc()) {
        $results[] = $row['sku'];
    }
    echo json_encode(['success' => true, 'results' => $results]);
    exit;
}


// --- Costing API ---

if ($action === 'get_costing') {
    $sku = clean_input($_GET['sku'] ?? '');
    if (empty($sku)) { echo json_encode(['success' => false, 'message' => 'SKU required']); exit; }
    
    // Fetch costing + img1 from inventory if available
    $sql = "SELECT sc.*, i.img1, i.live_links
            FROM sku_costings sc 
            LEFT JOIN inventory i ON sc.sku = i.sku 
            WHERE sc.sku = '$sku'";
    $res = $mysqli->query($sql);

    if ($res->num_rows == 0) {
        // If not found in sku_costings, check if exists in inventory to return empty costing with image
        $inv_check = $mysqli->query("SELECT sku, img1, live_links FROM inventory WHERE sku = '$sku'");
        if ($inv_check->num_rows > 0) {
            $inv_data = $inv_check->fetch_assoc();
            echo json_encode([
                'success' => true, 
                'costing' => [
                    'sku' => $inv_data['sku'],
                    'img1' => $inv_data['img1'],
                    'live_links' => $inv_data['live_links'],
                    // Default zero values for important fields to prevent JS errors
                    'total_cost' => 0
                ]
            ]);
            exit;
        }
        
        echo json_encode(['success' => false, 'message' => 'SKU not found']);
        exit;
    }
    
    $data = $res->fetch_assoc();
    
    echo json_encode(['success' => true, 'costing' => $data]);
    exit;
}

if ($action === 'save_costing') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $sku = clean_input($data['sku'] ?? '');
    
    if (empty($sku)) { echo json_encode(['success' => false, 'message' => 'SKU required']); exit; }
    
    // Inputs
    $top_fabric = clean_input($data['top_fabric'] ?? '');
    $top_cut = (float)($data['top_cut'] ?? 0);
    $top_rate = (float)($data['top_rate'] ?? 0);
    $top_shortage = (float)($data['top_shortage'] ?? 0);
    $top_total = (float)($data['top_total'] ?? 0);
    
    $bottom_fabric = clean_input($data['bottom_fabric'] ?? '');
    $bottom_cut = (float)($data['bottom_cut'] ?? 0);
    $bottom_rate = (float)($data['bottom_rate'] ?? 0);
    $bottom_shortage = (float)($data['bottom_shortage'] ?? 0);
    $bottom_total = (float)($data['bottom_total'] ?? 0);

    $tb_fabric = clean_input($data['top_bottom_fabric'] ?? '');
    $tb_cut = (float)($data['top_bottom_cut'] ?? 0);
    $tb_rate = (float)($data['top_bottom_rate'] ?? 0);
    $tb_shortage = (float)($data['top_bottom_shortage'] ?? 0);
    $tb_total = (float)($data['top_bottom_total'] ?? 0);
    
    $astar_fabric = clean_input($data['astar_fabric'] ?? '');
    $astar_cut = (float)($data['astar_cut'] ?? 0);
    $astar_rate = (float)($data['astar_rate'] ?? 0);
    $astar_shortage = (float)($data['astar_shortage'] ?? 0);
    $astar_total = (float)($data['astar_total'] ?? 0);
    
    $emb_fabric = clean_input($data['embroidery_fabric'] ?? '');
    $emb_cut = (float)($data['embroidery_cut'] ?? 0);
    $emb_rate = (float)($data['embroidery_rate'] ?? 0);
    $emb_shortage = (float)($data['embroidery_shortage'] ?? 0);
    $emb_total = (float)($data['embroidery_total'] ?? 0);

    $dup_fabric = clean_input($data['dupatta_fabric'] ?? '');
    $dup_cut = (float)($data['dupatta_cut'] ?? 0);
    $dup_rate = (float)($data['dupatta_rate'] ?? 0);
    $dup_shortage = (float)($data['dupatta_shortage'] ?? 0);
    $dup_total = (float)($data['dupatta_total'] ?? 0); // This will also update legacy dupatta_cost if we map it
    
    // Digital Print
    $dp_fabric = clean_input($data['digital_print_fabric'] ?? '');
    $dp_cut = (float)($data['digital_print_cut'] ?? 0);
    $dp_rate = (float)($data['digital_print_rate'] ?? 0);
    $dp_shortage = (float)($data['digital_print_shortage'] ?? 0);
    $dp_total = (float)($data['digital_print_total'] ?? 0);

    // Digital Print Dupatta
    $dp_dup_fabric = clean_input($data['digital_print_dupatta_fabric'] ?? '');
    $dp_dup_cut = (float)($data['digital_print_dupatta_cut'] ?? 0);
    $dp_dup_rate = (float)($data['digital_print_dupatta_rate'] ?? 0);
    $dp_dup_shortage = (float)($data['digital_print_dupatta_shortage'] ?? 0);
    $dp_dup_total = (float)($data['digital_print_dupatta_total'] ?? 0);
    
    $stitching_rate = (float)($data['stitching_rate'] ?? 0);
    $stitching_markup = (float)($data['stitching_markup'] ?? 0);
    $stitching_total = (float)($data['stitching_total'] ?? 0); // Maps to stitching_cost
    
    $dying_rate = (float)($data['dying_rate'] ?? 0);
    $dying_markup = (float)($data['dying_markup'] ?? 0);
    $dying_total = (float)($data['dying_total'] ?? 0);

    $knit_rate = (float)($data['knit_rate'] ?? 0);
    $knit_markup = (float)($data['knit_markup'] ?? 0);
    $knit_total = (float)($data['knit_total'] ?? 0);

    $press_rate = (float)($data['press_rate'] ?? 0);
    $press_markup = (float)($data['press_markup'] ?? 0);
    $press_total = (float)($data['press_total'] ?? 0);
    
    $operational = (float)($data['operational_cost'] ?? 0);
    $extra = (float)($data['extra_cost'] ?? 0);
    $final_markup = (float)($data['final_markup'] ?? 0);
    $total = (float)($data['total_cost'] ?? 0);
    
    // Check if exists
    // Check if exists
    $check = $mysqli->query("SELECT * FROM sku_costings WHERE sku='$sku'");
    if ($check === false) {
         echo json_encode(['success' => false, 'message' => 'Database error: Table missing.']);
         exit;
    }
    
    if ($check->num_rows > 0) {
        $existing = $check->fetch_assoc();
        
        // Log History for Numeric Fields
        // Exclude calculated totals to prevents duplicate/redundant logs (e.g. Rate change logs rate AND total)
        $numeric_fields = [
            'top_cut' => $top_cut, 'top_rate' => $top_rate, 'top_shortage' => $top_shortage,
            'bottom_cut' => $bottom_cut, 'bottom_rate' => $bottom_rate, 'bottom_shortage' => $bottom_shortage,
            'top_bottom_cut' => $tb_cut, 'top_bottom_rate' => $tb_rate, 'top_bottom_shortage' => $tb_shortage,
            'astar_cut' => $astar_cut, 'astar_rate' => $astar_rate, 'astar_shortage' => $astar_shortage,
            'embroidery_cut' => $emb_cut, 'embroidery_rate' => $emb_rate, 'embroidery_shortage' => $emb_shortage,
            'dupatta_cut' => $dup_cut, 'dupatta_rate' => $dup_rate, 'dupatta_shortage' => $dup_shortage,
            'digital_print_cut' => $dp_cut, 'digital_print_rate' => $dp_rate, 'digital_print_shortage' => $dp_shortage,
            'digital_print_dupatta_cut' => $dp_dup_cut, 'digital_print_dupatta_rate' => $dp_dup_rate, 'digital_print_dupatta_shortage' => $dp_dup_shortage,
            'stitching_rate' => $stitching_rate, 'stitching_markup' => $stitching_markup,
            'dying_rate' => $dying_rate, 'dying_markup' => $dying_markup,
            'knit_rate' => $knit_rate, 'knit_markup' => $knit_markup,
            'press_rate' => $press_rate, 'press_markup' => $press_markup,
            'operational_cost' => $operational, 'extra_cost' => $extra, 'final_markup' => $final_markup, 'total_cost' => $total
        ];

        $current_month = date('Y-m');
        $hist_stmt = $mysqli->prepare("INSERT INTO sku_costing_history (sku, field_changed, old_value, new_value, changed_by, month_ref) VALUES (?, ?, ?, ?, ?, ?)");
        
        foreach ($numeric_fields as $field => $new_val) {
            $old_val = (float)($existing[$field] ?? 0);
            // Floating point comparison with small epsilon
            if (abs($old_val - $new_val) > 0.001) {
                $hist_stmt->bind_param("ssddis", $sku, $field, $old_val, $new_val, $user_id, $current_month);
                $hist_stmt->execute();
            }
        }

        $sql = "UPDATE sku_costings SET 
            top_fabric=?, top_cut=?, top_rate=?, top_shortage=?, top_total=?,
            bottom_fabric=?, bottom_cut=?, bottom_rate=?, bottom_shortage=?, bottom_total=?,
            top_bottom_fabric=?, top_bottom_cut=?, top_bottom_rate=?, top_bottom_shortage=?, top_bottom_total=?,
            astar_fabric=?, astar_cut=?, astar_rate=?, astar_shortage=?, astar_total=?,
            embroidery_fabric=?, embroidery_cut=?, embroidery_rate=?, embroidery_shortage=?, embroidery_total=?,
            dupatta_fabric=?, dupatta_cut=?, dupatta_rate=?, dupatta_shortage=?, dupatta_total=?, dupatta_cost=?,
            digital_print_fabric=?, digital_print_cut=?, digital_print_rate=?, digital_print_shortage=?, digital_print_total=?,
            digital_print_dupatta_fabric=?, digital_print_dupatta_cut=?, digital_print_dupatta_rate=?, digital_print_dupatta_shortage=?, digital_print_dupatta_total=?,
            stitching_rate=?, stitching_markup=?, stitching_cost=?,
            dying_rate=?, dying_markup=?, dying_total=?,
            knit_rate=?, knit_markup=?, knit_total=?,
            press_rate=?, press_markup=?, press_total=?,
            operational_cost=?, extra_cost=?, final_markup=?, total_cost=?,
            updated_by=?, updated_at=NOW()
            WHERE sku=?";
            
        $stmt = $mysqli->prepare($sql);
        if (!$stmt) { echo json_encode(['success' => false, 'message' => 'Prep failed: ' . $mysqli->error]); exit; }

        $types = "sdddd sdddd sdddd sdddd sdddd sddddd sdddd sdddd ddd ddd ddd ddd ddd d is"; 
        $types = str_replace(" ", "", $types);
        
        $stmt->bind_param($types,
            $top_fabric, $top_cut, $top_rate, $top_shortage, $top_total,
            $bottom_fabric, $bottom_cut, $bottom_rate, $bottom_shortage, $bottom_total,
            $tb_fabric, $tb_cut, $tb_rate, $tb_shortage, $tb_total,
            $astar_fabric, $astar_cut, $astar_rate, $astar_shortage, $astar_total,
            $emb_fabric, $emb_cut, $emb_rate, $emb_shortage, $emb_total,
            $dup_fabric, $dup_cut, $dup_rate, $dup_shortage, $dup_total, $dup_total,
            $dp_fabric, $dp_cut, $dp_rate, $dp_shortage, $dp_total,
            $dp_dup_fabric, $dp_dup_cut, $dp_dup_rate, $dp_dup_shortage, $dp_dup_total,
            $stitching_rate, $stitching_markup, $stitching_total,
            $dying_rate, $dying_markup, $dying_total,
            $knit_rate, $knit_markup, $knit_total,
            $press_rate, $press_markup, $press_total,
            $operational, $extra, $final_markup, $total,
            $user_id, $sku
        );

    } else {
        // INSERT
        $sql = "INSERT INTO sku_costings (
            sku, 
            top_fabric, top_cut, top_rate, top_shortage, top_total,
            bottom_fabric, bottom_cut, bottom_rate, bottom_shortage, bottom_total,
            top_bottom_fabric, top_bottom_cut, top_bottom_rate, top_bottom_shortage, top_bottom_total,
            astar_fabric, astar_cut, astar_rate, astar_shortage, astar_total,
            embroidery_fabric, embroidery_cut, embroidery_rate, embroidery_shortage, embroidery_total,
            dupatta_fabric, dupatta_cut, dupatta_rate, dupatta_shortage, dupatta_total, dupatta_cost,
            digital_print_fabric, digital_print_cut, digital_print_rate, digital_print_shortage, digital_print_total,
            digital_print_dupatta_fabric, digital_print_dupatta_cut, digital_print_dupatta_rate, digital_print_dupatta_shortage, digital_print_dupatta_total,
            stitching_rate, stitching_markup, stitching_cost,
            dying_rate, dying_markup, dying_total,
            knit_rate, knit_markup, knit_total,
            press_rate, press_markup, press_total,
            operational_cost, extra_cost, final_markup, total_cost, updated_by
        ) VALUES (
            ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, ?, ?, 
            ?, ?, ?, 
            ?, ?, ?, 
            ?, ?, ?, 
            ?, ?, ?, 
            ?, ?, ?, ?, ?
        )";
        
        $stmt = $mysqli->prepare($sql);
        if (!$stmt) { echo json_encode(['success' => false, 'message' => 'Prep failed: ' . $mysqli->error]); exit; }

        $types = "s sdddd sdddd sdddd sdddd sdddd sddddd sdddd sdddd ddd ddd ddd ddd ddd d i";
        $types = str_replace(" ", "", $types);

        $stmt->bind_param($types,
            $sku,
            $top_fabric, $top_cut, $top_rate, $top_shortage, $top_total,
            $bottom_fabric, $bottom_cut, $bottom_rate, $bottom_shortage, $bottom_total,
            $tb_fabric, $tb_cut, $tb_rate, $tb_shortage, $tb_total,
            $astar_fabric, $astar_cut, $astar_rate, $astar_shortage, $astar_total,
            $emb_fabric, $emb_cut, $emb_rate, $emb_shortage, $emb_total,
            $dup_fabric, $dup_cut, $dup_rate, $dup_shortage, $dup_total, $dup_total,
            $dp_fabric, $dp_cut, $dp_rate, $dp_shortage, $dp_total,
            $dp_dup_fabric, $dp_dup_cut, $dp_dup_rate, $dp_dup_shortage, $dp_dup_total,
            $stitching_rate, $stitching_markup, $stitching_total,
            $dying_rate, $dying_markup, $dying_total,
            $knit_rate, $knit_markup, $knit_total,
            $press_rate, $press_markup, $press_total,
            $operational, $extra, $final_markup, $total, 
            $user_id
        );
    }
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}


// --- Notes API ---

if ($action === 'get_notes') {
    $sku = clean_input($_GET['sku'] ?? '');
    if (empty($sku)) { echo json_encode(['success' => false, 'message' => 'SKU required']); exit; }
    
    $check_table = $mysqli->query("SHOW TABLES LIKE 'sku_notes'");
    if ($check_table->num_rows == 0) {
        echo json_encode(['success' => true, 'notes' => []]); // Graceful fallback if table missing
        exit;
    }

    $stmt = $mysqli->prepare("
        SELECT n.*, u.username as created_by_name 
        FROM sku_notes n
        LEFT JOIN users u ON n.created_by = u.sno
        WHERE n.sku = ? 
        ORDER BY n.created_at DESC
    ");
    $stmt->bind_param("s", $sku);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $notes = [];
    while ($r = $res->fetch_assoc()) $notes[] = $r;
    
    echo json_encode(['success' => true, 'notes' => $notes]);
    exit;
}

if ($action === 'add_note') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $sku = clean_input($data['sku'] ?? '');
    $note = clean_input($data['note'] ?? '');
    
    if (empty($sku) || empty($note)) { 
        echo json_encode(['success' => false, 'message' => 'SKU and Note required']); 
        exit; 
    }
    
    // Check table existence
    $check_table = $mysqli->query("SHOW TABLES LIKE 'sku_notes'");
    if ($check_table->num_rows == 0) {
        echo json_encode(['success' => false, 'message' => 'Database table missing. Please run update_db_notes.php']); 
        exit;
    }

    $stmt = $mysqli->prepare("INSERT INTO sku_notes (sku, note, created_by) VALUES (?, ?, ?)");
    $stmt->bind_param("ssi", $sku, $note, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'note_id' => $mysqli->insert_id]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

if ($action === 'edit_note') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $note_id = (int)($data['note_id'] ?? 0);
    $note = clean_input($data['note'] ?? '');
    
    if ($note_id <= 0 || empty($note)) { 
        echo json_encode(['success' => false, 'message' => 'Invalid data']); 
        exit; 
    }

    $stmt = $mysqli->prepare("UPDATE sku_notes SET note = ? WHERE note_id = ?");
    $stmt->bind_param("si", $note, $note_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

if ($action === 'delete_note') {
    if (!$can_write) { http_response_code(403); echo json_encode(['error' => 'Permission denied']); exit; }
    
    $data = json_decode(file_get_contents("php://input"), true);
    $note_id = (int)($data['note_id'] ?? 0);
    
    if ($note_id <= 0) { 
        echo json_encode(['success' => false, 'message' => 'Invalid ID']); 
        exit; 
    }

    $stmt = $mysqli->prepare("DELETE FROM sku_notes WHERE note_id = ?");
    $stmt->bind_param("i", $note_id);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

// --- Reports API ---

if ($action === 'report_factory_skus') {
    $factory_id = (int)($_GET['factory_id'] ?? 0);
    if (!$factory_id) { echo json_encode(['success' => false, 'message' => 'Factory ID required']); exit; }

    // Get latest log per SKU/Segment for this factory (Corrected Logic)
    $sql = "SELECT l.sku, 
                   COALESCE(l.segment_name_snapshot, s.name) as segment_name, 
                   l.price, 
                   l.created_at as last_date
            FROM factory_price_logs l
            JOIN (
                SELECT sku, segment_id, MAX(log_id) as max_id
                FROM factory_price_logs
                WHERE factory_id = $factory_id AND voided_flag = 0
                GROUP BY sku, segment_id
            ) latest ON l.log_id = latest.max_id
            LEFT JOIN segments s ON l.segment_id = s.segment_id
            ORDER BY l.created_at DESC";

    $res = $mysqli->query($sql);
    $data = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $data[] = [
                'sku' => $row['sku'],
                'segments' => $row['segment_name'],
                'price' => $row['price'],
                'last_date' => date('Y-m-d', strtotime($row['last_date']))
            ];
        }
    }
    
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

if ($action === 'report_dependency') {
    // SKUs with only 1 distinct factory in their history (non-voided)
    $sql = "SELECT l.sku, COUNT(DISTINCT l.factory_id) as fac_count, MAX(l.factory_id) as factory_id
            FROM factory_price_logs l
            WHERE l.voided_flag = 0
            GROUP BY l.sku
            HAVING fac_count = 1";
            
    $res = $mysqli->query($sql);
    $data = [];
    if ($res) {
        while($row = $res->fetch_assoc()) {
            $fid = $row['factory_id'];
            // Get factory name
            $fName = 'Unknown';
            $fRes = $mysqli->query("SELECT name FROM factories WHERE factory_id = $fid");
            if ($fRes && $fr = $fRes->fetch_assoc()) $fName = $fr['name'];
            
            // Count total logs for context
            $sku = $row['sku'];
            $cRes = $mysqli->query("SELECT COUNT(*) as c FROM factory_price_logs WHERE sku='$sku' AND voided_flag=0");
            $logCount = ($cRes && $cr = $cRes->fetch_assoc()) ? $cr['c'] : 0;
            
            $data[] = [
                'sku' => $row['sku'],
                'factory_name' => $fName,
                'log_count' => $logCount
            ];
        }
    }
    
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

if ($action === 'report_rate_history') {
    $sku = clean_input($_GET['sku'] ?? '');
    $segment_id = (int)($_GET['segment_id'] ?? 0);
    
    if (empty($sku)) { echo json_encode(['success' => false, 'message' => 'SKU Required']); exit; }
    
    $where = "WHERE l.sku = '$sku' AND l.voided_flag = 0";
    if ($segment_id > 0) $where .= " AND l.segment_id = $segment_id";
    
    $sql = "SELECT l.*, 
                   COALESCE(l.segment_name_snapshot, s.name) as segment_name, 
                   COALESCE(l.factory_name_snapshot, f.name) as factory_name, 
                   u.username 
            FROM factory_price_logs l
            LEFT JOIN segments s ON l.segment_id = s.segment_id
            LEFT JOIN factories f ON l.factory_id = f.factory_id
            LEFT JOIN users u ON l.created_by = u.sno
            $where
            ORDER BY l.created_at DESC";
            
    $res = $mysqli->query($sql);
    $data = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $data[] = [
                'created_at' => date('Y-m-d', strtotime($row['created_at'])),
                'factory_name' => $row['factory_name'],
                'segment_name' => $row['segment_name'],
                'price' => $row['price'],
                'note' => $row['note'],
                'created_by_name' => $row['username']
            ];
        }
    }
    
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}


if ($action === 'get_factories') {
    $res = $mysqli->query("SELECT factory_id, name FROM factories WHERE status='active' ORDER BY name");
    $factories = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) $factories[] = $row;
    }
    echo json_encode(['success' => true, 'factories' => $factories]);
    exit;
}

if ($action === 'get_segments') {
    $res = $mysqli->query("SELECT segment_id, name FROM segments ORDER BY name");
    $segments = [];
    if ($res) {
        while ($row = $res->fetch_assoc()) $segments[] = $row;
    }
    echo json_encode(['success' => true, 'segments' => $segments]);
    exit;
}


if ($action === 'create_user') {
    // Only Admin can create users
    $current_roles = explode(',', $_SESSION['role'] ?? '');
    if (!isset($_SESSION['role']) || !in_array('admin', $current_roles)) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }

    $username = clean_input($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $role = clean_input($_POST['role'] ?? '');

    if (empty($username) || empty($password) || empty($role)) {
        echo json_encode(['success' => false, 'message' => 'All fields required']);
        exit;
    }

    // Check if user exists
    $stmt = $mysqli->prepare("SELECT sno FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'Username already exists']);
        exit;
    }

    // Hash password
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);

    $stmt = $mysqli->prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $username, $hashed_password, $role);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $mysqli->error]);
    }
    exit;
}

$mysqli->close();
?>
