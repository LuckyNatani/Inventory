<?php
require_once '../config/db_connect.php';

try {
    $result = $mysqli->query("SHOW COLUMNS FROM inventory LIKE 'purchase_cost'");
    if ($result->num_rows == 0) {
        // Column doesn't exist, add it
        // Adding AFTER rack_location as per plan, or just at the end is fine.
        $sql = "ALTER TABLE inventory ADD COLUMN purchase_cost DECIMAL(10,2) DEFAULT 0.00 AFTER rack_location";
        if ($mysqli->query($sql)) {
            echo "Successfully added 'purchase_cost' column to 'inventory' table.\n";
        } else {
            echo "Error adding column: " . $mysqli->error . "\n";
        }
    } else {
        echo "Column 'purchase_cost' already exists.\n";
    }
} catch (Exception $e) {
    echo "Exception: " . $e->getMessage() . "\n";
}

$mysqli->close();
?>
