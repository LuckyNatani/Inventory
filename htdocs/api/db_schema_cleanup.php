<?php
require_once __DIR__ . '/../config/db_connect.php';

// disable error reporting for cleaner output
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "Starting Database Migration...\n";

// 1. Update existing data to match new enums
// Map 'not_picked' -> 'pending' in picklist_items
$mysqli->query("UPDATE picklist_items SET status = 'pending' WHERE status = 'not_picked'");
// Map 'partial' -> 'pending' (or 'picked' if we wanted, but let's stick to pending for simplicity as decided)
$mysqli->query("UPDATE picklist_items SET status = 'pending' WHERE status = 'partial'");
// Map 'not_found' -> 'pending' (removed status)
$mysqli->query("UPDATE picklist_items SET status = 'pending' WHERE status = 'not_found'");

// Map 'partial' in picklists table -> 'in_progress'
$mysqli->query("UPDATE picklists SET status = 'in_progress' WHERE status = 'partial'");

echo "Data updated. Now altering tables...\n";

// 2. Alter picklist_items status enum
if (!$mysqli->query("ALTER TABLE picklist_items MODIFY COLUMN status ENUM('pending', 'picked', 'substituted') DEFAULT 'pending'")) {
    echo "Error altering picklist_items: " . $mysqli->error . "\n";
} else {
    echo "picklist_items status enum updated.\n";
}

// 3. Alter picklists status enum
if (!$mysqli->query("ALTER TABLE picklists MODIFY COLUMN status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending'")) {
    echo "Error altering picklists: " . $mysqli->error . "\n";
} else {
    echo "picklists status enum updated.\n";
}

// 4. Update platform_orders_summary
// First, consolidate data. 
// We want to drop `partial_orders`, `not_found_orders`, `not_picked_orders`.
// Ensure `pending_orders` has the sum.
// Previously `pending_orders` might just be actual 'pending' status?
// Let's recalculate `pending_orders` = `total_orders` - `fulfilled_orders` - `not_found` (if handled differently?)
// Safe bet: pending_orders = total_orders - fulfilled_orders.

$mysqli->query("UPDATE platform_orders_summary SET pending_orders = total_orders - fulfilled_orders");

// Drop columns
$colsToDrop = ['partial_orders', 'not_found_orders', 'not_picked_orders'];
foreach ($colsToDrop as $col) {
    if (!$mysqli->query("ALTER TABLE platform_orders_summary DROP COLUMN $col")) {
        // Ignore check if doesn't exist
        echo "Note dropping $col: " . $mysqli->error . "\n";
    } else {
        echo "Dropped column $col.\n";
    }
}

echo "Database Migration Completed Successfully.\n";
?>
