<?php
require_once '../config/session_config.php';
require_once '../config/db_connect.php';

header('Content-Type: application/json');

// Auth Check
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Suppress PHP warnings from breaking JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

$role_string = $_SESSION['role'] ?? 'guest';
$user_roles = explode(',', $role_string);

// Allowed roles: tailor, admin, production
$allowed_roles = ['admin', 'sub-admin', 'production', 'tailor'];
if (empty(array_intersect($user_roles, $allowed_roles))) {
    http_response_code(403);
    echo json_encode(['error' => 'Permission denied']);
    exit;
}

$action = $_GET['action'] ?? 'list';

function escape($val) {
    global $mysqli;
    return $mysqli->real_escape_string($val);
}

// Ensure logs table exists
$mysqli->query("CREATE TABLE IF NOT EXISTS sku_cuts_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(255) NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    changes_json TEXT,
    updated_by INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX (sku),
    INDEX (created_at)
)");

if ($action === 'list') {
    $page = (int)($_GET['page'] ?? 1);
    $limit = (int)($_GET['limit'] ?? 20);
    $offset = ($page - 1) * $limit;
    $search = escape($_GET['search'] ?? '');
    $category = $_GET['category'] ?? 'all';
    $rack = escape($_GET['rack_location'] ?? '');
    $sort = $_GET['sort'] ?? 'sku';
    
    $where = "WHERE i.status != 'archived'";
    if ($search !== '') {
        $like = "%$search%";
        $where .= " AND (i.sku LIKE '" . escape($like) . "')";
    }
    if ($category !== 'all') {
        $where .= " AND i.category = '" . escape($category) . "'";
    }
    if ($rack !== '') {
        $where .= " AND i.rack_location LIKE '%" . escape($rack) . "%'";
    }

    $orderBy = "ORDER BY i.sku ASC";
    if ($sort === 'updated') {
        $orderBy = "ORDER BY i.updated_at DESC";
    }

    $query = "SELECT i.sku, i.img1, i.updated_at, i.category, i.rack_location,
                     
                     COALESCE(sc.g1_top_bottom, '') as g1_top_bottom,
                     COALESCE(sc.g1_top, '') as g1_top,
                     COALESCE(sc.g1_bottom, '') as g1_bottom,
                     COALESCE(sc.g1_work, '') as g1_work,
                     COALESCE(sc.g1_lace1, '') as g1_lace1,
                     COALESCE(sc.g1_lace2, '') as g1_lace2,

                     COALESCE(sc.g2_top_bottom, '') as g2_top_bottom,
                     COALESCE(sc.g2_top, '') as g2_top,
                     COALESCE(sc.g2_bottom, '') as g2_bottom,
                     COALESCE(sc.g2_work, '') as g2_work,
                     COALESCE(sc.g2_lace1, '') as g2_lace1,
                     COALESCE(sc.g2_lace2, '') as g2_lace2,

                     COALESCE(sc.g3_top_bottom, '') as g3_top_bottom,
                     COALESCE(sc.g3_top, '') as g3_top,
                     COALESCE(sc.g3_bottom, '') as g3_bottom,
                     COALESCE(sc.g3_work, '') as g3_work,
                     COALESCE(sc.g3_lace1, '') as g3_lace1,
                     COALESCE(sc.g3_lace2, '') as g3_lace2,

                     COALESCE(sc.remark, '') as remark
              FROM inventory i
              LEFT JOIN sku_cuts sc ON i.sku = sc.sku
              $where
              $orderBy
              LIMIT $offset, $limit";

    $result = $mysqli->query($query);
    if (!$result) {
        http_response_code(500);
        echo json_encode(["error" => "Query failed: " . $mysqli->error]);
        exit;
    }

    $items = [];
    while ($row = $result->fetch_assoc()) {
        $items[] = $row;
    }

    $totalRes = $mysqli->query("SELECT COUNT(*) as total FROM inventory i $where");
    $total = $totalRes->fetch_assoc()['total'];

    echo json_encode([
        "items" => $items,
        "total" => $total
    ]);

} elseif ($action === 'export') {
    $search = escape($_GET['search'] ?? '');
    $category = $_GET['category'] ?? 'all';
    $rack = escape($_GET['rack_location'] ?? '');
    
    $where = "WHERE i.status != 'archived'";
    if ($search !== '') {
        $like = "%$search%";
        $where .= " AND (i.sku LIKE '" . escape($like) . "')";
    }
    if ($category !== 'all') {
        $where .= " AND i.category = '" . escape($category) . "'";
    }
    if ($rack !== '') {
        $where .= " AND i.rack_location LIKE '%" . escape($rack) . "%'";
    }

    header("Content-Type: application/vnd.ms-excel");
    header("Content-Disposition: attachment; filename=tailor_cuts_export.xls");
    
    echo "<table border='1'>";
    echo "<tr>
            <th>SKU</th><th>Category</th><th>Rack</th>
            <th>G1: Top+Bot (S-3XL)</th><th>G1: Top</th><th>G1: Bottom</th><th>G1: Work</th><th>G1: Lace1</th><th>G1: Lace2</th>
            <th>G2: Top+Bot (M-3XL)</th><th>G2: Top</th><th>G2: Bottom</th><th>G2: Work</th><th>G2: Lace1</th><th>G2: Lace2</th>
            <th>G3: Top+Bot (S-2XL)</th><th>G3: Top</th><th>G3: Bottom</th><th>G3: Work</th><th>G3: Lace1</th><th>G3: Lace2</th>
            <th>Remark</th>
            <th>Last Updated</th>
          </tr>";
    
    $query = "SELECT i.sku, i.category, i.rack_location, i.updated_at,
                     COALESCE(sc.g1_top_bottom, '') as g1_top_bottom,
                     COALESCE(sc.g1_top, '') as g1_top,
                     COALESCE(sc.g1_bottom, '') as g1_bottom,
                     COALESCE(sc.g1_work, '') as g1_work,
                     COALESCE(sc.g1_lace1, '') as g1_lace1,
                     COALESCE(sc.g1_lace2, '') as g1_lace2,

                     COALESCE(sc.g2_top_bottom, '') as g2_top_bottom,
                     COALESCE(sc.g2_top, '') as g2_top,
                     COALESCE(sc.g2_bottom, '') as g2_bottom,
                     COALESCE(sc.g2_work, '') as g2_work,
                     COALESCE(sc.g2_lace1, '') as g2_lace1,
                     COALESCE(sc.g2_lace2, '') as g2_lace2,

                     COALESCE(sc.g3_top_bottom, '') as g3_top_bottom,
                     COALESCE(sc.g3_top, '') as g3_top,
                     COALESCE(sc.g3_bottom, '') as g3_bottom,
                     COALESCE(sc.g3_work, '') as g3_work,
                     COALESCE(sc.g3_lace1, '') as g3_lace1,
                     COALESCE(sc.g3_lace2, '') as g3_lace2,

                     COALESCE(sc.remark, '') as remark
              FROM inventory i
              LEFT JOIN sku_cuts sc ON i.sku = sc.sku
              $where
              ORDER BY i.sku ASC";

    $res = $mysqli->query($query);
    while ($row = $res->fetch_assoc()) {
        echo "<tr>
                <td>{$row['sku']}</td>
                <td>{$row['category']}</td>
                <td>{$row['rack_location']}</td>
                
                <td>{$row['g1_top_bottom']}</td>
                <td>{$row['g1_top']}</td>
                <td>{$row['g1_bottom']}</td>
                <td>{$row['g1_work']}</td>
                <td>{$row['g1_lace1']}</td>
                <td>{$row['g1_lace2']}</td>

                <td>{$row['g2_top_bottom']}</td>
                <td>{$row['g2_top']}</td>
                <td>{$row['g2_bottom']}</td>
                <td>{$row['g2_work']}</td>
                <td>{$row['g2_lace1']}</td>
                <td>{$row['g2_lace2']}</td>

                <td>{$row['g3_top_bottom']}</td>
                <td>{$row['g3_top']}</td>
                <td>{$row['g3_bottom']}</td>
                <td>{$row['g3_work']}</td>
                <td>{$row['g3_lace1']}</td>
                <td>{$row['g3_lace2']}</td>
                
                <td>{$row['remark']}</td>
                
                <td>{$row['updated_at']}</td>
              </tr>";
    }
    echo "</table>";
    exit;

} elseif ($action === 'get_logs') {
    // Only admins
    if (!in_array('admin', $user_roles) && !in_array('sub-admin', $user_roles)) {
        http_response_code(403);
        echo json_encode(['error' => 'Permission denied']);
        exit;
    }

    $search = escape($_GET['search'] ?? '');
    $where = "WHERE 1=1";
    if ($search !== '') {
        $where .= " AND l.sku LIKE '%$search%'";
    }

    $query = "SELECT l.*, u.username 
              FROM sku_cuts_logs l 
              LEFT JOIN users u ON l.updated_by = u.sno 
              $where 
              ORDER BY l.created_at DESC 
              LIMIT 100";
    
    $res = $mysqli->query($query);
    if (!$res) {
        http_response_code(500);
        echo json_encode(['error' => 'Query failed: ' . $mysqli->error]);
        exit;
    }

    $logs = [];
    while ($row = $res->fetch_assoc()) {
        $logs[] = $row;
    }
    echo json_encode($logs);
    exit;

} elseif ($action === 'update') {
    $data = json_decode(file_get_contents("php://input"), true);
    
    $sku = escape($data['sku'] ?? '');
    //$remark = escape($data['remark'] ?? '');
    $newValues = [
        'remark' => escape($data['remark'] ?? ''),
        'g1_top_bottom' => escape($data['g1_top_bottom'] ?? ''),
        'g1_top' => escape($data['g1_top'] ?? ''),
        'g1_bottom' => escape($data['g1_bottom'] ?? ''),
        'g1_work' => escape($data['g1_work'] ?? ''),
        'g1_lace1' => escape($data['g1_lace1'] ?? ''),
        'g1_lace2' => escape($data['g1_lace2'] ?? ''),
        'g2_top_bottom' => escape($data['g2_top_bottom'] ?? ''),
        'g2_top' => escape($data['g2_top'] ?? ''),
        'g2_bottom' => escape($data['g2_bottom'] ?? ''),
        'g2_work' => escape($data['g2_work'] ?? ''),
        'g2_lace1' => escape($data['g2_lace1'] ?? ''),
        'g2_lace2' => escape($data['g2_lace2'] ?? ''),
        'g3_top_bottom' => escape($data['g3_top_bottom'] ?? ''),
        'g3_top' => escape($data['g3_top'] ?? ''),
        'g3_bottom' => escape($data['g3_bottom'] ?? ''),
        'g3_work' => escape($data['g3_work'] ?? ''),
        'g3_lace1' => escape($data['g3_lace1'] ?? ''),
        'g3_lace2' => escape($data['g3_lace2'] ?? '')
    ];

    $user_id = $_SESSION['user_id'];

    if (empty($sku)) {
        http_response_code(400);
        echo json_encode(["error" => "SKU is required"]);
        exit;
    }

    // Check if entry exists & fetch old data for logging
    $check = $mysqli->query("SELECT * FROM sku_cuts WHERE sku = '$sku'");
    $existing = $check->fetch_assoc();
    
    $changes = [];
    $isCreate = false;

    if ($existing) {
        // Compare with old values
        foreach ($newValues as $key => $val) {
            $oldVal = $existing[$key] ?? '';
            // normalize
            if ((string)$oldVal !== (string)$val) {
                $changes[$key] = ['old' => $oldVal, 'new' => $val];
            }
        }
    } else {
        $isCreate = true;
        foreach ($newValues as $key => $val) {
            if ($val !== '') {
                $changes[$key] = ['old' => null, 'new' => $val];
            }
        }
    }

    // Only proceed if there are changes or it's a new create
    if (empty($changes) && !$isCreate) {
        echo json_encode(["success" => true, "message" => "No changes detected"]);
        exit;
    }

    if ($existing) {
        $stmt = $mysqli->prepare("UPDATE sku_cuts SET 
            g1_top_bottom=?, g1_top=?, g1_bottom=?, g1_work=?, g1_lace1=?, g1_lace2=?,
            g2_top_bottom=?, g2_top=?, g2_bottom=?, g2_work=?, g2_lace1=?, g2_lace2=?,
            g3_top_bottom=?, g3_top=?, g3_bottom=?, g3_work=?, g3_lace1=?, g3_lace2=?,
            updated_by=?, updated_at=NOW(), remark=? WHERE sku=?");
        
        if (!$stmt) {
             http_response_code(500);
             echo json_encode(["error" => "Update Prepare failed: " . $mysqli->error]);
             exit;
        }

        $stmt->bind_param("ssssssssssssssssssiss", 
            $newValues['g1_top_bottom'], $newValues['g1_top'], $newValues['g1_bottom'], $newValues['g1_work'], $newValues['g1_lace1'], $newValues['g1_lace2'],
            $newValues['g2_top_bottom'], $newValues['g2_top'], $newValues['g2_bottom'], $newValues['g2_work'], $newValues['g2_lace1'], $newValues['g2_lace2'],
            $newValues['g3_top_bottom'], $newValues['g3_top'], $newValues['g3_bottom'], $newValues['g3_work'], $newValues['g3_lace1'], $newValues['g3_lace2'],
            $user_id, $newValues['remark'], $sku);
    } else {
        $stmt = $mysqli->prepare("INSERT INTO sku_cuts (
            sku, 
            g1_top_bottom, g1_top, g1_bottom, g1_work, g1_lace1, g1_lace2,
            g2_top_bottom, g2_top, g2_bottom, g2_work, g2_lace1, g2_lace2,
            g3_top_bottom, g3_top, g3_bottom, g3_work, g3_lace1, g3_lace2,
            updated_by, updated_at, remark
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)");
        
        if (!$stmt) {
             http_response_code(500);
             echo json_encode(["error" => "Insert Prepare failed: " . $mysqli->error]);
             exit;
        }

        // Fixed bind_param string: added one 's' (21 chars for 21 vars)
        $stmt->bind_param("sssssssssssssssssssis", 
            $sku, 
            $newValues['g1_top_bottom'], $newValues['g1_top'], $newValues['g1_bottom'], $newValues['g1_work'], $newValues['g1_lace1'], $newValues['g1_lace2'],
            $newValues['g2_top_bottom'], $newValues['g2_top'], $newValues['g2_bottom'], $newValues['g2_work'], $newValues['g2_lace1'], $newValues['g2_lace2'],
            $newValues['g3_top_bottom'], $newValues['g3_top'], $newValues['g3_bottom'], $newValues['g3_work'], $newValues['g3_lace1'], $newValues['g3_lace2'],
            $user_id, $newValues['remark']);
    }

    if ($stmt->execute()) {
        $stmt->close(); // Close main statement

        // Log changes
        if (!empty($changes)) {
            $changeType = $isCreate ? 'create' : 'update';
            $changesJson = json_encode($changes);
            
            // Prepare Log Statement safely
            if ($logStmt = $mysqli->prepare("INSERT INTO sku_cuts_logs (sku, change_type, changes_json, updated_by) VALUES (?, ?, ?, ?)")) {
                $uid = (int)$user_id;
                $logStmt->bind_param("sssi", $sku, $changeType, $changesJson, $uid);
                if (!$logStmt->execute()) {
                    error_log("Log Insert Error: " . $logStmt->error);
                }
                $logStmt->close();
            } else {
                error_log("Log Prepare Error: " . $mysqli->error);
            }
        }
        echo json_encode(["success" => true]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Database error: " . $stmt->error]);
    }

} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
}

$mysqli->close();
?>
