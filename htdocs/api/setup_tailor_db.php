<?php
require_once '../config/db_connect.php';

// Drop if exists (since user said they dropped it, but to be safe and clean)
// $mysqli->query("DROP TABLE IF EXISTS sku_cuts");

$sql = "CREATE TABLE IF NOT EXISTS sku_cuts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(255) NOT NULL UNIQUE,
    remark TEXT,
    
    -- Group 1: S-3XL
    g1_top_bottom VARCHAR(255) DEFAULT '',
    g1_top VARCHAR(255) DEFAULT '',
    g1_bottom VARCHAR(255) DEFAULT '',
    g1_work VARCHAR(255) DEFAULT '',
    g1_lace1 VARCHAR(255) DEFAULT '',
    g1_lace2 VARCHAR(255) DEFAULT '',

    -- Group 2: M-3XL
    g2_top_bottom VARCHAR(255) DEFAULT '',
    g2_top VARCHAR(255) DEFAULT '',
    g2_bottom VARCHAR(255) DEFAULT '',
    g2_work VARCHAR(255) DEFAULT '',
    g2_lace1 VARCHAR(255) DEFAULT '',
    g2_lace2 VARCHAR(255) DEFAULT '',

    -- Group 3: S-2XL
    g3_top_bottom VARCHAR(255) DEFAULT '',
    g3_top VARCHAR(255) DEFAULT '',
    g3_bottom VARCHAR(255) DEFAULT '',
    g3_work VARCHAR(255) DEFAULT '',
    g3_lace1 VARCHAR(255) DEFAULT '',
    g3_lace2 VARCHAR(255) DEFAULT '',

    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT
)";

if ($mysqli->query($sql) === TRUE) {
    echo "Table 'sku_cuts' created successfully.<br>";
    echo "Columns: id, sku, g1_*(5), g2_*(5), g3_*(5), updated_at, updated_by.";
} else {
    echo "Error creating table: " . $mysqli->error;
}

$mysqli->close();
?>
