<?php
require_once '../config/db_connect.php';

// Add 'submitted' to the ENUM
$sql = "ALTER TABLE picklists MODIFY COLUMN status ENUM('pending','in_progress','completed','partial','submitted') DEFAULT 'pending'";

if ($mysqli->query($sql) === TRUE) {
    echo "Successfully updated picklists status enum.";
} else {
    echo "Error updating record: " . $mysqli->error;
}
$mysqli->close();
?>
