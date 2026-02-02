<?php
require_once '../config/session_config.php';
require_once '../config/db_connect.php';

// disable error display, we will echo text
ini_set('display_errors', 1);
error_reporting(E_ALL);

echo "--- DIAGNOSTIC START ---\n";

// 1. Check inventory table schema details for size columns
echo "\n[Inventory Schema Check]\n";
$res = $mysqli->query("DESCRIBE inventory");
while($row = $res->fetch_assoc()) {
    if (in_array($row['Field'], ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'])) {
        echo "Field: {$row['Field']}, Type: {$row['Type']}, Null: {$row['Null']}, Default: {$row['Default']}\n";
    }
}

// 2. Check inventory_audit_log schema details (specifically changed_at)
echo "\n[Audit Log Schema Check]\n";
$res = $mysqli->query("DESCRIBE inventory_audit_log");
while($row = $res->fetch_assoc()) {
    if ($row['Field'] == 'changed_at') {
        echo "Field: {$row['Field']}, Type: {$row['Type']}, Null: {$row['Null']}, Default: {$row['Default']}, Extra: {$row['Extra']}\n";
    }
    // Also check if field_changed exists
    if ($row['Field'] == 'field_changed') {
        echo "Field: {$row['Field']}, Type: {$row['Type']}\n";
    }
}

// 3. Test bind_param with NULL for sizes
echo "\n[Testing NULL Insert]\n";
$testSku = "TEST-NULL-" . uniqid();
$stmt = $mysqli->prepare("INSERT INTO inventory (sku, category, xs, s) VALUES (?, 'TestCat', ?, ?)");

$valNull = null;
$valInt = 10;
// bind (sku, xs, s) -> s, i, i
$stmt->bind_param("sii", $testSku, $valNull, $valInt);

if ($stmt->execute()) {
    $id = $mysqli->insert_id;
    echo "Inserted test row ID: $id\n";
    
    // Fetch it back
    $check = $mysqli->query("SELECT xs, s FROM inventory WHERE id = $id")->fetch_assoc();
    echo "Fetched back: xs = " . var_export($check['xs'], true) . ", s = " . var_export($check['s'], true) . "\n";
    
    // Cleanup
    $mysqli->query("DELETE FROM inventory WHERE id = $id");
} else {
    echo "Insert failed: " . $stmt->error . "\n";
}

// 4. Check recent audit logs
echo "\n[Recent Audit Logs]\n";
$logs = $mysqli->query("SELECT changed_at, sku, action, quantity_change, field_changed FROM inventory_audit_log ORDER BY changed_at DESC LIMIT 5");
while($row = $logs->fetch_assoc()) {
    echo "Log: " . json_encode($row) . "\n";
}

echo "\n--- DIAGNOSTIC END ---\n";
?>
