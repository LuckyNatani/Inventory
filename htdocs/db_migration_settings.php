<?php
require_once 'config/db_connect.php';

// Create user_settings table
$sql = "CREATE TABLE IF NOT EXISTS `user_settings` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11) NOT NULL,
    `setting_key` varchar(50) NOT NULL,
    `setting_value` text,
    `setting_group` varchar(50) DEFAULT 'general',
    `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_setting` (`user_id`, `setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

if ($mysqli->query($sql) === TRUE) {
    echo "Table 'user_settings' created or already exists successfully.<br>";
} else {
    echo "Error creating table: " . $mysqli->error . "<br>";
}

// Add default settings for existing users (optional, logic can be handled in fetch)
echo "Migration completed.";
?>
