<?php
require_once '../config/db_connect.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

// --- API Actions ---

if ($action === 'add') {
    $data = json_decode(file_get_contents("php://input"), true);
    $name = $mysqli->real_escape_string($data['name']);
    $amount = (float)$data['amount'];
    $date = $mysqli->real_escape_string($data['date']);
    $category = $mysqli->real_escape_string($data['category']);
    
    $stmt = $mysqli->prepare("INSERT INTO operational_expenses (expense_name, amount, expense_date, category) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("sdss", $name, $amount, $date, $category);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => $mysqli->error]);
    }

} elseif ($action === 'list') {
    $month = $mysqli->real_escape_string($_GET['month']); // YYYY-MM
    
    $sql = "SELECT * FROM operational_expenses WHERE DATE_FORMAT(expense_date, '%Y-%m') = '$month' ORDER BY expense_date DESC";
    $res = $mysqli->query($sql);
    
    $expenses = [];
    while ($row = $res->fetch_assoc()) {
        $expenses[] = $row;
    }
    echo json_encode($expenses);

} elseif ($action === 'delete') {
    $id = (int)$_POST['id'];
    if ($mysqli->query("DELETE FROM operational_expenses WHERE id=$id")) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => $mysqli->error]);
    }

} elseif ($action === 'stats') {
    $month = $mysqli->real_escape_string($_GET['month']); // YYYY-MM
    
    // 1. Total Expenses
    $resExp = $mysqli->query("SELECT SUM(amount) as total FROM operational_expenses WHERE DATE_FORMAT(expense_date, '%Y-%m') = '$month'");
    $totalExpenses = (float)($resExp->fetch_assoc()['total'] ?? 0);
    
    // 2. Units Sold (From Audit Log deduction logic)
    $sqlSold = "SELECT ABS(COALESCE(SUM(quantity_change), 0)) as sold 
                FROM inventory_audit_log 
                WHERE quantity_change < 0 
                AND field_changed IN ('xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'quantity')
                AND DATE_FORMAT(changed_at, '%Y-%m') = '$month'";
                
    $resSold = $mysqli->query($sqlSold);
    $totalSold = (int)($resSold->fetch_assoc()['sold'] ?? 0);
    
    // 3. Cost Per Unit
    $costPerUnit = ($totalSold > 0) ? ($totalExpenses / $totalSold) : 0;
    
    echo json_encode([
        'total_expenses' => $totalExpenses,
        'total_sold' => $totalSold,
        'cost_per_unit' => round($costPerUnit, 2)
    ]);

} elseif ($action === 'apply_to_all') {
    $data = json_decode(file_get_contents("php://input"), true);
    $newCost = (float)$data['cost_per_unit'];
    $month = $mysqli->real_escape_string($data['month']);
    $userId = (int)($data['user_id'] ?? 1); 
    
    // 1. Log History
    // We record the change. Since we are doing a bulk update, we grab the current value of one representative (or avg) 
    // OR we log individual rows. Logging individual rows for thousands of SKUs is heavy but accurate.
    // For now, efficient bulk log:
    $stmtHist = $mysqli->prepare("
        INSERT INTO sku_costing_history (sku, field_changed, old_value, new_value, changed_by, month_ref)
        SELECT sku, 'operational_cost', COALESCE(operational_cost, 0), ?, ?, ?
        FROM sku_costings
    ");
    $stmtHist->bind_param("dis", $newCost, $userId, $month);
    $stmtHist->execute();
    
    // 2. Update operational_cost AND total_cost
    // Logic: NewTotal = OldTotal - OldOps + NewOps
    // This preserves manual edits or other cost components.
    
    $stmtUpdate = $mysqli->prepare("
        UPDATE sku_costings 
        SET total_cost = total_cost - COALESCE(operational_cost, 0) + ?,
            operational_cost = ?, 
            updated_at = NOW()
    ");
    // Bind twice: once for calculation, once for column assignment
    $stmtUpdate->bind_param("dd", $newCost, $newCost);
    
    if ($stmtUpdate->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => $mysqli->error]);
    }

} elseif ($action === 'history_log') {
    // Fetch history logs, optionally filtered by SKU
    $sku = isset($_GET['sku']) ? $mysqli->real_escape_string($_GET['sku']) : '';
    
    $where = "1=1";
    if (!empty($sku)) {
        $where .= " AND h.sku = '$sku'";
    }
    
    // Fetch recent 50 history logs (or more if filtered?) 
    // If SKU is specific, maybe show more history? 50 is fine for now.
    $sql = "SELECT h.*, u.username 
            FROM sku_costing_history h 
            LEFT JOIN users u ON h.changed_by = u.sno 
            WHERE $where
            ORDER BY h.changed_at DESC 
            LIMIT 50";
    $res = $mysqli->query($sql);
    
    $history = [];
    while ($row = $res->fetch_assoc()) {
        $history[] = $row;
    }
    echo json_encode($history);

} else {
    echo json_encode(['error' => 'Invalid action']);
}
?>
