<?php
require_once '../config/db_connect.php';

// Add remark column
$sql = "ALTER TABLE sku_cuts ADD COLUMN IF NOT EXISTS remark TEXT AFTER sku";
if ($mysqli->query($sql) === TRUE) {
    echo "Added remark column.<br>";
} else {
    echo "Error adding remark: " . $mysqli->error . "<br>";
}

// Update Lace columns for G1
$sql = "ALTER TABLE sku_cuts CHANGE COLUMN IF EXISTS g1_lace g1_lace1 VARCHAR(255) DEFAULT ''";
if ($mysqli->query($sql) === TRUE) {
    echo "Changed g1_lace to g1_lace1.<br>";
} else {
     // If it failed, maybe it already exists or g1_lace doesn't exist. Check if g1_lace1 exists first? 
     // Using IF EXISTS in CHANGE COLUMN is MariaDB 10.0.2+. 
     // Standard MySQL might fail if column doesn't exist. 
     // Let's rely on the error message or just try add if change fails.
     echo "Error changing g1_lace: " . $mysqli->error . "<br>";
}

$sql = "ALTER TABLE sku_cuts ADD COLUMN IF NOT EXISTS g1_lace2 VARCHAR(255) DEFAULT '' AFTER g1_lace1";
if ($mysqli->query($sql) === TRUE) {
    echo "Added g1_lace2.<br>";
} else {
    echo "Error adding g1_lace2: " . $mysqli->error . "<br>";
}

// Update Lace columns for G2
$sql = "ALTER TABLE sku_cuts CHANGE COLUMN IF EXISTS g2_lace g2_lace1 VARCHAR(255) DEFAULT ''";
$mysqli->query($sql);
$sql = "ALTER TABLE sku_cuts ADD COLUMN IF NOT EXISTS g2_lace2 VARCHAR(255) DEFAULT '' AFTER g2_lace1";
$mysqli->query($sql);

// Update Lace columns for G3
$sql = "ALTER TABLE sku_cuts CHANGE COLUMN IF EXISTS g3_lace g3_lace1 VARCHAR(255) DEFAULT ''";
$mysqli->query($sql);
$sql = "ALTER TABLE sku_cuts ADD COLUMN IF NOT EXISTS g3_lace2 VARCHAR(255) DEFAULT '' AFTER g3_lace1";
$mysqli->query($sql);

echo "Migration complated.";
$mysqli->close();
?>
