-- Create clients table for multi-tenancy
CREATE TABLE IF NOT EXISTS `clients` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `client_name` varchar(100) NOT NULL,
  `subdomain` varchar(50) NOT NULL,
  `db_name` varchar(100) NOT NULL,
  `db_user` varchar(100) NOT NULL,
  `db_pass` varchar(255) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `subdomain` (`subdomain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Example Insert (You can uncomment and edit this)
-- INSERT INTO `clients` (`client_name`, `subdomain`, `db_name`, `db_user`, `db_pass`) VALUES 
-- ('VibeVision', 'vibevision', 'if0_39430414_vibevision_inventory', 'if0_39430414', 'yFvxr5LUR0O7Nr');
