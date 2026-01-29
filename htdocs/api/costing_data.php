<?php
require_once '../config/db_connect.php';

// Suppress HTML errors to ensure JSON output (overrides db_connect.php)
ini_set('display_errors', 0);
error_reporting(0); 

// Re-enable JSON error reporting for our script logic
header('Content-Type: application/json');

$action = $_REQUEST['action'] ?? '';

if ($action === 'get_all_costing') {
    // Pagination & Filter Params
    $page = isset($_REQUEST['page']) ? (int)$_REQUEST['page'] : 1;
    $limit = isset($_REQUEST['limit']) ? (int)$_REQUEST['limit'] : 50;
    
    // Inline Sanitization
    $cat_raw = $_REQUEST['category'] ?? '';
    $category = $mysqli->real_escape_string(trim($cat_raw));
    
    $skus_param = $_REQUEST['skus'] ?? '';
    
    $offset = ($page - 1) * $limit;

    // Base query parts
    $where_sql = "1=1";
    
    if (!empty($skus_param)) {
        // If SKUs are provided (Show Selected mode), filter by these specific SKUs
        // explode, trim, escape
        $sku_list = explode(',', $skus_param);
        $clean_skus = [];
        foreach ($sku_list as $s) {
            $clean_s = $mysqli->real_escape_string(trim($s));
            if (!empty($clean_s)) {
                $clean_skus[] = "'$clean_s'";
            }
        }
        if (!empty($clean_skus)) {
            $where_sql .= " AND i.sku IN (" . implode(',', $clean_skus) . ")";
        } else {
             // Handle case where param exists but empty strings
            $where_sql = "0"; 
        }
    } elseif (!empty($category)) {
        // Only apply category filter if NOT showing selected
        $where_sql .= " AND i.category = '$category'";
    }

    // 1. Get Total Count
    $count_sql = "SELECT COUNT(*) as total FROM inventory i WHERE $where_sql";
    $count_res = $mysqli->query($count_sql);
    $total_items = ($count_res && $row = $count_res->fetch_assoc()) ? (int)$row['total'] : 0;
    $total_pages = ceil($total_items / $limit);

    // 2. Fetch Data
    $details = isset($_REQUEST['details']) && $_REQUEST['details'] === 'true';
    
    $cols = "i.sku, i.img1, i.category, COALESCE(c.total_cost, 0) as total_cost";
    if ($details) {
        $cols = "i.sku, i.img1, i.category, c.*"; // Select all costing columns
    }
    
    $sql = "SELECT $cols
            FROM inventory i
            LEFT JOIN sku_costings c ON i.sku = c.sku
            WHERE $where_sql
            ORDER BY i.sku ASC";

    if ($limit > 0) {
        $sql .= " LIMIT $limit OFFSET $offset";
    }
            
    $result = $mysqli->query($sql);
    
    if (!$result) {
        echo json_encode(['success' => false, 'message' => 'Database Error: ' . $mysqli->error]);
        exit;
    }
    
    $data = [];
    while ($row = $result->fetch_assoc()) {
        $data[] = $row;
    }
    
    echo json_encode([
        'success' => true, 
        'items' => $data,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $total_pages,
            'total_items' => $total_items,
            'limit' => $limit
        ]
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
?>
