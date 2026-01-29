<?php
require_once '../config/db_connect.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';
$range = $_GET['range'] ?? 'today';

$start_date = $_GET['start_date'] ?? '';
$end_date = $_GET['end_date'] ?? '';

function getDateCondition($range, $dateColumn = 'date', $start = '', $end = '') {
    global $mysqli;
    if ($range === 'today') {
        return "DATE($dateColumn) = CURDATE()";
    } elseif ($range === 'yesterday') {
        return "DATE($dateColumn) = CURDATE() - INTERVAL 1 DAY";
    } elseif ($range === '7days') {
        return "$dateColumn >= CURDATE() - INTERVAL 7 DAY";
    } elseif ($range === 'custom' && $start && $end) {
        $start = $mysqli->real_escape_string($start);
        $end = $mysqli->real_escape_string($end);
        return "DATE($dateColumn) BETWEEN '$start' AND '$end'";
    }
    return "1";
}

if ($action === 'stats') {
    $cond = getDateCondition($range, 'date', $start_date, $end_date);
    
    // 1. Overall Summary (from platform_orders_summary)
    // 1. Overall Summary (from platform_orders_summary)
    // 1. Overall Summary (from platform_orders_summary)
    $sql = "SELECT 
        COALESCE(SUM(total_orders), 0) as total_orders,
        COALESCE(SUM(pending_orders), 0) as real_pending,
        COALESCE(SUM(not_picked_orders), 0) as not_picked,
        COALESCE(SUM(partial_orders), 0) as partial,
        COALESCE(SUM(not_found_orders), 0) as not_found,
        COALESCE(SUM(fulfilled_orders), 0) as picked_orders
        FROM platform_orders_summary 
        WHERE $cond";
        
    $result = $mysqli->query($sql)->fetch_assoc();

    // Aggregated Pending for Card
    // Pending = Not Picked + Partial + Not Found + (Real Pending if any exist)
    $result['pending_orders'] = $result['not_picked'] + $result['partial'] + $result['not_found'] + $result['real_pending'];
    
    // Get Substitution Count
    // Align with Order Date (upload_date) to match other cards
    $subCond = getDateCondition($range, 'p.upload_date', $start_date, $end_date);
    $sqlSub = "SELECT COUNT(*) as substitutions 
               FROM substitutions s
               JOIN picklist_items pi ON s.original_item_id = pi.item_id
               JOIN picklists p ON pi.picklist_id = p.picklist_id
               WHERE $subCond";
    $resSub = $mysqli->query($sqlSub)->fetch_assoc();
    $result['substitutions'] = $resSub['substitutions']; // Add this line
    // Completed Orders = Picked + Substituted
    // Direct count for accuracy and consistency with modal
    $compCond = getDateCondition($range, 'p.upload_date', $start_date, $end_date);
    $sqlComp = "SELECT COUNT(*) as completed 
                FROM picklist_items pi 
                JOIN picklists p ON pi.picklist_id = p.picklist_id
                WHERE $compCond AND pi.status IN ('picked', 'substituted')";
    $resComp = $mysqli->query($sqlComp)->fetch_assoc();
    $result['completed_orders'] = $resComp['completed'];
    
    // 2. Platform Breakdown
    // Use JOIN to get platform name from picklists table to ensure accuracy
    $condPlatform = getDateCondition($range, 's.date', $start_date, $end_date);
    $sqlPlatform = "SELECT p.platform, COALESCE(SUM(s.total_orders), 0) as count 
                    FROM platform_orders_summary s
                    JOIN picklists p ON s.picklist_id = p.picklist_id
                    WHERE $condPlatform 
                    GROUP BY p.platform";
    $resPlatform = $mysqli->query($sqlPlatform);
    $platforms = [];
    while($row = $resPlatform->fetch_assoc()) {
        $platforms[] = $row;
    }
    
    // 3. Trend Chart Data
    $trend = [];
    // User requested "Today" to be a single bar (daily aggregate), not hourly.
    // We should use platform_orders_summary consistently for all date ranges to match the "Total Orders" summary card.
    // Previously, 'today' used the 'picklists' table which counted batches/picklists instead of calculating total orders, causing discrepancies (e.g., 3 picklists vs 6 total orders).
    
    $sqlTrend = "SELECT DATE_FORMAT(date, '%Y-%m-%d') as label, COALESCE(SUM(total_orders), 0) as value 
                 FROM platform_orders_summary 
                 WHERE $cond 
                 GROUP BY DATE(date) 
                 ORDER BY DATE(date)";
    
    $resTrend = $mysqli->query($sqlTrend);
    while($row = $resTrend->fetch_assoc()) {
        $trend[] = $row;
    }

    echo json_encode([
        'summary' => $result,
        'platforms' => $platforms,
        'trend' => $trend
    ]);

} elseif ($action === 'sku_today') {
    $sku = $mysqli->real_escape_string($_GET['sku'] ?? '');
    $sql = "SELECT COUNT(*) as count 
            FROM picklist_items pi
            JOIN picklists p ON pi.picklist_id = p.picklist_id
            WHERE pi.sku = '$sku' AND DATE(p.upload_date) = CURDATE() 
            AND pi.status IN ('picked', 'substituted')";
    $result = $mysqli->query($sql)->fetch_assoc();
    echo json_encode(['count' => $result['count']]);

} elseif ($action === 'sku_sizes') {
    $sku = $mysqli->real_escape_string($_GET['sku'] ?? '');
    $cond = getDateCondition($range, 'p.upload_date', $start_date, $end_date);
    
    $sql = "SELECT pi.size, COUNT(*) as count 
            FROM picklist_items pi
            JOIN picklists p ON pi.picklist_id = p.picklist_id
            WHERE pi.sku = '$sku' AND $cond
            AND pi.status IN ('picked', 'substituted')
            GROUP BY pi.size
            ORDER BY FIELD(pi.size, 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl')";
    
    $result = $mysqli->query($sql);
    $sizes = [];
    while($row = $result->fetch_assoc()) {
        $sizes[$row['size']] = $row['count'];
    }
    echo json_encode($sizes);

} elseif ($action === 'sku_trend') {
    $sku = $mysqli->real_escape_string($_GET['sku'] ?? '');
    $cond = getDateCondition($range, 'p.upload_date', $start_date, $end_date);
    
    // Always group by DATE, regardless of range
    $sql = "SELECT DATE_FORMAT(p.upload_date, '%Y-%m-%d') as label, COUNT(*) as value 
            FROM picklist_items pi
            JOIN picklists p ON pi.picklist_id = p.picklist_id
            WHERE pi.sku = '$sku' AND $cond
            AND pi.status IN ('picked', 'substituted')
            GROUP BY DATE(p.upload_date) 
            ORDER BY DATE(p.upload_date)";

    $result = $mysqli->query($sql);
    $trend = [];
    while($row = $result->fetch_assoc()) {
        $trend[] = $row;
    }
    echo json_encode($trend);

} elseif ($action === 'sku_search') {
    $term = $mysqli->real_escape_string($_GET['term'] ?? '');
    $items = [];
    if (strlen($term) >= 2) {
        // Search in inventory table for SKUs matching the term
        $sql = "SELECT sku FROM inventory 
                WHERE sku LIKE '%$term%' AND status != 'archived'
                LIMIT 10";
        $result = $mysqli->query($sql);
        while ($row = $result->fetch_assoc()) {
            $items[] = $row['sku'];
        }
    }
    echo json_encode($items);

} elseif ($action === 'item_details') {
    $type = $_GET['type'] ?? 'total';
    $cond = getDateCondition($range, 'p.upload_date', $start_date, $end_date);

    $statusClause = "1";
    $statusClause = "1";
    if ($type === 'pending') {
        // Pending Card includes: pending, not_picked, partial, not_found
        $statusClause = "pi.status IN ('pending', 'not_picked', 'partial', 'not_found')";
    } elseif ($type === 'picked') {
        // Completed items (Picked + Substituted)
        $statusClause = "pi.status IN ('picked', 'substituted')";
    }

    $sql = "SELECT pi.sku, pi.size, pi.quantity_required, pi.quantity_picked, pi.status, 
                   p.picklist_id, p.platform, p.upload_date
            FROM picklist_items pi
            JOIN picklists p ON pi.picklist_id = p.picklist_id
            WHERE $cond AND $statusClause
            ORDER BY p.upload_date DESC, p.picklist_id DESC
            LIMIT 100"; // Limit to prevent overload

    $result = $mysqli->query($sql);
    $items = [];
    while ($row = $result->fetch_assoc()) {
        $items[] = $row;
    }

    echo json_encode($items);
}

$mysqli->close();
?>
