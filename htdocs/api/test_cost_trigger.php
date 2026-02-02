<?php
require_once '../config/db_connect.php';

// Prepare a test SKU entry if not exists
$testSku = 'TEST-COST-' . uniqid();
$mysqli->query("INSERT INTO sku_costings (sku, total_cost, operational_cost) VALUES ('$testSku', 100, 10)");

// Simulate the logic from operational_cost.php apply_to_all
$newCost = 20;
$userId = 1;
$month = '2026-02';

echo "Simulating update for SKU: $testSku\n";

// 1. Insert History
$stmtHist = $mysqli->prepare("
    INSERT INTO sku_costing_history (sku, field_changed, old_value, new_value, changed_by, month_ref)
    SELECT sku, 'operational_cost', COALESCE(operational_cost, 0), ?, ?, ?
    FROM sku_costings
    WHERE sku = ?
");
$stmtHist->bind_param("diss", $newCost, $userId, $month, $testSku);
$stmtHist->execute();

echo "Inserted history. Checking logs count...\n";

// Count logs
$resBefore = $mysqli->query("SELECT COUNT(*) as cnt FROM sku_costing_history WHERE sku='$testSku'");
$cntBefore = $resBefore->fetch_assoc()['cnt'];
echo "Logs found: $cntBefore (Expected 1)\n";

// 2. Update Cost
$stmtUpdate = $mysqli->prepare("
    UPDATE sku_costings 
    SET total_cost = total_cost - COALESCE(operational_cost, 0) + ?,
        operational_cost = ?, 
        updated_at = NOW()
    WHERE sku = ?
");
$stmtUpdate->bind_param("dds", $newCost, $newCost, $testSku);
$stmtUpdate->execute();

echo "Updated cost table. Checking logs count again (checking for triggers)...\n";
$resAfter = $mysqli->query("SELECT COUNT(*) as cnt FROM sku_costing_history WHERE sku='$testSku'");
$cntAfter = $resAfter->fetch_assoc()['cnt'];
echo "Logs found: $cntAfter\n";

if ($cntAfter > $cntBefore) {
    echo "WARNING: Extra log entry detected! Total: $cntAfter. Likely a trigger exists.\n";
    // Fetch the extra log to see what it looks like
    $logs = $mysqli->query("SELECT * FROM sku_costing_history WHERE sku='$testSku'");
    while($row = $logs->fetch_assoc()) {
        print_r($row);
    }
} else {
    echo "No extra log entries. System appears clean of triggers.\n";
}

// Cleanup
$mysqli->query("DELETE FROM sku_costings WHERE sku='$testSku'");
$mysqli->query("DELETE FROM sku_costing_history WHERE sku='$testSku'");
?>
