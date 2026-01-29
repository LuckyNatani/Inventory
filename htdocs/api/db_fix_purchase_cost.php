<?php
// Standalone script to add purchase_cost column
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Copy details from db_connect.php to be self-contained if needed,
// but let's try requiring it first.
require_once '../config/db_connect.php';

echo "<h1>Database Fix: Add Purchase Cost</h1>";

if ($mysqli->connect_errno) {
    echo "<p style='color:red'>Failed to connect to MySQL: " . $mysqli->connect_error . "</p>";
    exit();
}
echo "<p style='color:green'>Connected to database successfully.</p>";

// Check if column exists
$result = $mysqli->query("SHOW COLUMNS FROM inventory LIKE 'purchase_cost'");
if ($result->num_rows > 0) {
    echo "<p style='color:orange'>Column 'purchase_cost' already exists. No action needed.</p>";
} else {
    echo "<p>Column 'purchase_cost' missing. Attempting to add...</p>";
    $sql = "ALTER TABLE inventory ADD COLUMN purchase_cost DECIMAL(10,2) DEFAULT 0.00 AFTER rack_location";
    if ($mysqli->query($sql)) {
        echo "<h2 style='color:green'>SUCCESS: Column 'purchase_cost' added!</h2>";
    } else {
        echo "<h2 style='color:red'>ERROR: Could not add column.</h2>";
        echo "<p>MySQL Error: " . $mysqli->error . "</p>";
    }
}

echo "<hr>";
echo "<p>Verify the table structure below:</p>";
$res = $mysqli->query("DESCRIBE inventory");
if ($res) {
    echo "<table border='1' cellpadding='5'><tr><th>Field</th><th>Type</th></tr>";
    while ($row = $res->fetch_assoc()) {
        $color = ($row['Field'] == 'purchase_cost') ? 'lightgreen' : 'white';
        echo "<tr style='background-color:$color'><td>{$row['Field']}</td><td>{$row['Type']}</td></tr>";
    }
    echo "</table>";
}

$mysqli->close();
?>
