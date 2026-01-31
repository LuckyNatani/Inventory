<?php
require_once '../config/db_connect.php';

echo "Starting Migration: Merging platform_orders_summary into picklists...\n";

// 1. Add Columns to picklists if not exist
$columns = [
    "total_quantity" => "INT DEFAULT 0",
    "picked_quantity" => "INT DEFAULT 0",
    "substituted_quantity" => "INT DEFAULT 0"
];

foreach ($columns as $col => $def) {
    $check = $mysqli->query("SHOW COLUMNS FROM picklists LIKE '$col'");
    if ($check->num_rows == 0) {
        if ($mysqli->query("ALTER TABLE picklists ADD COLUMN $col $def")) {
            echo "Added column: $col\n";
        } else {
            die("Error adding column $col: " . $mysqli->error . "\n");
        }
    } else {
        echo "Column $col already exists.\n";
    }
}

// 2. Populate Data from platform_orders_summary
echo "Migrating data...\n";
$sqlVal = "SELECT picklist_id, total_quantity, picked_quantity, substituted_quantity FROM platform_orders_summary";
$res = $mysqli->query($sqlVal);

if ($res) {
    while ($row = $res->fetch_assoc()) {
        $pid = $row['picklist_id'];
        $tq = $row['total_quantity'];
        $pq = $row['picked_quantity'];
        $sq = $row['substituted_quantity'];
        
        $update = "UPDATE picklists SET 
                   total_quantity = $tq, 
                   picked_quantity = $pq, 
                   substituted_quantity = $sq 
                   WHERE picklist_id = $pid";
        $mysqli->query($update);
    }
    echo "Data migration complete.\n";
} else {
    echo "No data found in platform_orders_summary or table doesn't exist.\n";
}

// 3. Populate missing data (for picklists not in summary)
echo "Backfilling missing data from picklist_items...\n";
$missingSql = "SELECT picklist_id FROM picklists WHERE total_quantity = 0";
$missingRes = $mysqli->query($missingSql);
while ($row = $missingRes->fetch_assoc()) {
    $pid = $row['picklist_id'];
    
    // Calc from specific items
    $calcSql = "SELECT SUM(quantity_required) as tq, SUM(quantity_picked) as pq FROM picklist_items WHERE picklist_id = $pid";
    $calcRow = $mysqli->query($calcSql)->fetch_assoc();
    
    $tq = $calcRow['tq'] ?? 0;
    $pq = $calcRow['pq'] ?? 0;
    
    // Substituted
    $subSql = "SELECT SUM(substitute_quantity) as sq 
               FROM substitutions s 
               JOIN picklist_items pi ON s.original_item_id = pi.item_id 
               WHERE pi.picklist_id = $pid";
    $subRow = $mysqli->query($subSql)->fetch_assoc();
    $sq = $subRow['sq'] ?? 0;
    
    $mysqli->query("UPDATE picklists SET total_quantity=$tq, picked_quantity=$pq, substituted_quantity=$sq WHERE picklist_id=$pid");
}

// 4. Drop Table
echo "Dropping platform_orders_summary table...\n";
if ($mysqli->query("DROP TABLE IF EXISTS platform_orders_summary")) {
    echo "Table dropped successfully.\n";
} else {
    echo "Error dropping table: " . $mysqli->error . "\n";
}

echo "Migration Successful!\n";
$mysqli->close();
?>
