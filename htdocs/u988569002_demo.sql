-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jan 31, 2026 at 10:57 AM
-- Server version: 11.8.3-MariaDB-log
-- PHP Version: 7.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `u988569002_demo`
--

-- --------------------------------------------------------

--
-- Table structure for table `fabrics`
--

CREATE TABLE `fabrics` (
  `fabric_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `factories`
--

CREATE TABLE `factories` (
  `factory_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `contact_info` text DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `contact_2` varchar(50) DEFAULT NULL,
  `contact_3` varchar(50) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `gst_number` varchar(50) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `factory_price_logs`
--

CREATE TABLE `factory_price_logs` (
  `log_id` int(11) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `segment_id` int(11) NOT NULL,
  `segment_name_snapshot` varchar(255) DEFAULT NULL,
  `factory_id` int(11) NOT NULL,
  `factory_name_snapshot` varchar(255) DEFAULT NULL,
  `price` decimal(15,2) NOT NULL,
  `note` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `voided_flag` tinyint(1) DEFAULT 0,
  `void_reason` text DEFAULT NULL,
  `voided_by` int(11) DEFAULT NULL,
  `voided_at` datetime DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory`
--

CREATE TABLE `inventory` (
  `id` int(11) NOT NULL,
  `s` int(11) DEFAULT 0,
  `m` int(11) DEFAULT 0,
  `l` int(11) DEFAULT 0,
  `xl` int(11) DEFAULT 0,
  `xxl` int(11) DEFAULT 0,
  `xxxl` int(11) DEFAULT 0,
  `quantity` int(11) DEFAULT 0,
  `category` varchar(100) NOT NULL,
  `xs` int(11) DEFAULT 0,
  `img1` text NOT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `product_type` enum('sized','unitary') NOT NULL DEFAULT 'sized',
  `rack_location` varchar(80) DEFAULT NULL,
  `purchase_cost` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(11) DEFAULT NULL,
  `min_stock_alert` int(11) DEFAULT 10,
  `status` enum('active','discontinued','archived') DEFAULT 'active',
  `live_links` text DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_audit_log`
--

CREATE TABLE `inventory_audit_log` (
  `log_id` int(11) NOT NULL,
  `inventory_id` int(11) DEFAULT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `action` enum('add','update','pick','substitute','adjust') DEFAULT NULL,
  `field_changed` varchar(50) DEFAULT NULL,
  `old_value` varchar(255) DEFAULT NULL,
  `new_value` varchar(255) DEFAULT NULL,
  `quantity_change` int(11) DEFAULT NULL,
  `changed_by` int(11) DEFAULT NULL,
  `changed_at` datetime DEFAULT current_timestamp(),
  `reference_type` enum('manual','picklist','substitution','return') DEFAULT NULL,
  `reference_id` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `picklists`
--

CREATE TABLE `picklists` (
  `picklist_id` int(11) NOT NULL,
  `platform` varchar(255) DEFAULT NULL,
  `upload_date` datetime DEFAULT current_timestamp(),
  `uploaded_by` int(11) DEFAULT NULL,
  `total_items` int(11) DEFAULT NULL,
  `picked_items` int(11) DEFAULT 0,
  `pending_items` int(11) DEFAULT NULL,
  `status` enum('pending','in_progress','completed') DEFAULT 'pending',
  `assigned_to` int(11) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `total_quantity` int(11) DEFAULT 0,
  `picked_quantity` int(11) DEFAULT 0,
  `substituted_quantity` int(11) DEFAULT 0
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `picklist_items`
--

CREATE TABLE `picklist_items` (
  `item_id` int(11) NOT NULL,
  `picklist_id` int(11) DEFAULT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `size` enum('xs','s','m','l','xl','xxl','xxxl') DEFAULT NULL,
  `quantity_required` int(11) NOT NULL,
  `quantity_picked` int(11) DEFAULT 0,
  `quantity_return` int(11) DEFAULT 0,
  `quantity_pending` int(11) DEFAULT NULL,
  `status` enum('pending','picked','substituted') DEFAULT 'pending',
  `rack_location` varchar(80) DEFAULT NULL,
  `picked_at` datetime DEFAULT NULL,
  `picked_by` int(11) DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_categories`
--

CREATE TABLE `product_categories` (
  `category_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `rack_locations`
--

CREATE TABLE `rack_locations` (
  `rack_id` int(11) NOT NULL,
  `rack_code` varchar(20) NOT NULL,
  `rack_section` varchar(10) DEFAULT NULL,
  `bin_number` varchar(10) DEFAULT NULL,
  `floor_level` int(11) DEFAULT NULL,
  `zone` varchar(50) DEFAULT NULL,
  `capacity` int(11) DEFAULT NULL,
  `current_items` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `notes` text DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `segments`
--

CREATE TABLE `segments` (
  `segment_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sku_costings`
--

CREATE TABLE `sku_costings` (
  `costing_id` int(11) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `top_fabric` varchar(100) DEFAULT NULL,
  `top_cut` decimal(10,2) DEFAULT 0.00,
  `top_rate` decimal(10,2) DEFAULT 0.00,
  `top_shortage` decimal(10,2) DEFAULT 0.00,
  `top_total` decimal(10,2) DEFAULT 0.00,
  `bottom_fabric` varchar(100) DEFAULT NULL,
  `bottom_cut` decimal(10,2) DEFAULT 0.00,
  `bottom_rate` decimal(10,2) DEFAULT 0.00,
  `bottom_shortage` decimal(10,2) DEFAULT 0.00,
  `bottom_total` decimal(10,2) DEFAULT 0.00,
  `astar_fabric` varchar(100) DEFAULT NULL,
  `astar_cut` decimal(10,2) DEFAULT 0.00,
  `astar_rate` decimal(10,2) DEFAULT 0.00,
  `astar_shortage` decimal(10,2) DEFAULT 0.00,
  `astar_total` decimal(10,2) DEFAULT 0.00,
  `top_bottom_fabric` varchar(255) DEFAULT NULL,
  `top_bottom_cut` decimal(10,2) DEFAULT 0.00,
  `top_bottom_rate` decimal(10,2) DEFAULT 0.00,
  `top_bottom_shortage` decimal(10,2) DEFAULT 0.00,
  `top_bottom_total` decimal(10,2) DEFAULT 0.00,
  `embroidery_fabric` varchar(100) DEFAULT NULL,
  `embroidery_cut` decimal(10,2) DEFAULT 0.00,
  `embroidery_rate` decimal(10,2) DEFAULT 0.00,
  `embroidery_shortage` decimal(10,2) DEFAULT 0.00,
  `embroidery_total` decimal(10,2) DEFAULT 0.00,
  `dupatta_fabric` varchar(255) DEFAULT NULL,
  `dupatta_cut` decimal(10,2) DEFAULT 0.00,
  `dupatta_rate` decimal(10,2) DEFAULT 0.00,
  `dupatta_shortage` decimal(10,2) DEFAULT 0.00,
  `dupatta_total` decimal(10,2) DEFAULT 0.00,
  `stitching_cost` decimal(10,2) DEFAULT 0.00,
  `stitching_rate` decimal(10,2) DEFAULT 0.00,
  `stitching_markup` decimal(10,2) DEFAULT 0.00,
  `dupatta_cost` decimal(10,2) DEFAULT 0.00,
  `operational_cost` decimal(10,2) DEFAULT 0.00,
  `extra_cost` decimal(10,2) DEFAULT 0.00,
  `final_markup` decimal(10,2) DEFAULT 0.00,
  `dying_rate` decimal(10,2) DEFAULT 0.00,
  `dying_markup` decimal(10,2) DEFAULT 0.00,
  `dying_total` decimal(10,2) DEFAULT 0.00,
  `knit_rate` decimal(10,2) DEFAULT 0.00,
  `knit_markup` decimal(10,2) DEFAULT 0.00,
  `knit_total` decimal(10,2) DEFAULT 0.00,
  `press_rate` decimal(10,2) DEFAULT 0.00,
  `press_markup` decimal(10,2) DEFAULT 0.00,
  `press_total` decimal(10,2) DEFAULT 0.00,
  `total_cost` decimal(10,2) DEFAULT 0.00,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `digital_print_fabric` varchar(255) DEFAULT NULL,
  `digital_print_cut` decimal(10,2) DEFAULT 0.00,
  `digital_print_rate` decimal(10,2) DEFAULT 0.00,
  `digital_print_shortage` decimal(10,2) DEFAULT 0.00,
  `digital_print_total` decimal(10,2) DEFAULT 0.00,
  `digital_print_dupatta_fabric` varchar(255) DEFAULT NULL,
  `digital_print_dupatta_cut` decimal(10,2) DEFAULT 0.00,
  `digital_print_dupatta_rate` decimal(10,2) DEFAULT 0.00,
  `digital_print_dupatta_shortage` decimal(10,2) DEFAULT 0.00,
  `digital_print_dupatta_total` decimal(10,2) DEFAULT 0.00
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sku_cuts`
--

CREATE TABLE `sku_cuts` (
  `id` int(11) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `remark` text DEFAULT NULL,
  `g1_top_bottom` varchar(255) DEFAULT '',
  `g1_top` varchar(255) DEFAULT '',
  `g1_bottom` varchar(255) DEFAULT '',
  `g1_work` varchar(255) DEFAULT '',
  `g1_lace1` varchar(255) DEFAULT '',
  `g1_lace2` varchar(255) DEFAULT '',
  `g2_top_bottom` varchar(255) DEFAULT '',
  `g2_top` varchar(255) DEFAULT '',
  `g2_bottom` varchar(255) DEFAULT '',
  `g2_work` varchar(255) DEFAULT '',
  `g2_lace1` varchar(255) DEFAULT '',
  `g2_lace2` varchar(255) DEFAULT '',
  `g3_top_bottom` varchar(255) DEFAULT '',
  `g3_top` varchar(255) DEFAULT '',
  `g3_bottom` varchar(255) DEFAULT '',
  `g3_work` varchar(255) DEFAULT '',
  `g3_lace1` varchar(255) DEFAULT '',
  `g3_lace2` varchar(255) DEFAULT '',
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `updated_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sku_cuts_logs`
--

CREATE TABLE `sku_cuts_logs` (
  `id` int(11) NOT NULL,
  `sku` varchar(255) NOT NULL,
  `change_type` varchar(50) NOT NULL,
  `changes_json` text DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sku_notes`
--

CREATE TABLE `sku_notes` (
  `note_id` int(11) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `note` text NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `substitutions`
--

CREATE TABLE `substitutions` (
  `substitution_id` int(11) NOT NULL,
  `original_item_id` int(11) DEFAULT NULL,
  `original_sku` varchar(50) DEFAULT NULL,
  `original_size` enum('xs','s','m','l','xl','xxl','xxxl') DEFAULT NULL,
  `original_quantity` int(11) DEFAULT NULL,
  `substitute_sku` varchar(50) DEFAULT NULL,
  `substitute_size` enum('xs','s','m','l','xl','xxl','xxxl') DEFAULT NULL,
  `substitute_quantity` int(11) DEFAULT NULL,
  `substituted_by` int(11) DEFAULT NULL,
  `substituted_at` datetime DEFAULT current_timestamp(),
  `reason` text DEFAULT NULL,
  `approval_status` enum('pending','approved','rejected') DEFAULT 'approved'
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `sno` int(11) NOT NULL,
  `username` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(255) NOT NULL DEFAULT 'viewer',
  `created_at` datetime DEFAULT NULL,
  `mobile1` varchar(20) DEFAULT NULL,
  `mobile2` varchar(20) DEFAULT NULL,
  `aadhar_number` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `fabrics`
--
ALTER TABLE `fabrics`
  ADD PRIMARY KEY (`fabric_id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `factories`
--
ALTER TABLE `factories`
  ADD PRIMARY KEY (`factory_id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `factory_price_logs`
--
ALTER TABLE `factory_price_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `factory_id` (`factory_id`),
  ADD KEY `sku` (`sku`),
  ADD KEY `created_at` (`created_at`),
  ADD KEY `segment_id` (`segment_id`,`factory_id`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `voided_by` (`voided_by`),
  ADD KEY `created_by_2` (`created_by`),
  ADD KEY `voided_by_2` (`voided_by`),
  ADD KEY `created_by_3` (`created_by`),
  ADD KEY `voided_by_3` (`voided_by`);

--
-- Indexes for table `inventory`
--
ALTER TABLE `inventory`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`);

--
-- Indexes for table `inventory_audit_log`
--
ALTER TABLE `inventory_audit_log`
  ADD PRIMARY KEY (`log_id`);

--
-- Indexes for table `picklists`
--
ALTER TABLE `picklists`
  ADD PRIMARY KEY (`picklist_id`);

--
-- Indexes for table `picklist_items`
--
ALTER TABLE `picklist_items`
  ADD PRIMARY KEY (`item_id`),
  ADD KEY `picklist_id` (`picklist_id`);

--
-- Indexes for table `product_categories`
--
ALTER TABLE `product_categories`
  ADD PRIMARY KEY (`category_id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `rack_locations`
--
ALTER TABLE `rack_locations`
  ADD PRIMARY KEY (`rack_id`),
  ADD UNIQUE KEY `rack_code` (`rack_code`);

--
-- Indexes for table `segments`
--
ALTER TABLE `segments`
  ADD PRIMARY KEY (`segment_id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `sku_costings`
--
ALTER TABLE `sku_costings`
  ADD PRIMARY KEY (`costing_id`),
  ADD UNIQUE KEY `sku_2` (`sku`),
  ADD UNIQUE KEY `sku_3` (`sku`),
  ADD UNIQUE KEY `sku_4` (`sku`),
  ADD KEY `sku` (`sku`),
  ADD KEY `updated_by` (`updated_by`),
  ADD KEY `updated_by_2` (`updated_by`),
  ADD KEY `updated_by_3` (`updated_by`);

--
-- Indexes for table `sku_cuts`
--
ALTER TABLE `sku_cuts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`);

--
-- Indexes for table `sku_cuts_logs`
--
ALTER TABLE `sku_cuts_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sku` (`sku`),
  ADD KEY `created_at` (`created_at`);

--
-- Indexes for table `sku_notes`
--
ALTER TABLE `sku_notes`
  ADD PRIMARY KEY (`note_id`),
  ADD KEY `sku` (`sku`),
  ADD KEY `created_by` (`created_by`),
  ADD KEY `created_by_2` (`created_by`),
  ADD KEY `created_by_3` (`created_by`);

--
-- Indexes for table `substitutions`
--
ALTER TABLE `substitutions`
  ADD PRIMARY KEY (`substitution_id`),
  ADD KEY `original_item_id` (`original_item_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`sno`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `fabrics`
--
ALTER TABLE `fabrics`
  MODIFY `fabric_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `factories`
--
ALTER TABLE `factories`
  MODIFY `factory_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `factory_price_logs`
--
ALTER TABLE `factory_price_logs`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory`
--
ALTER TABLE `inventory`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_audit_log`
--
ALTER TABLE `inventory_audit_log`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `picklists`
--
ALTER TABLE `picklists`
  MODIFY `picklist_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `picklist_items`
--
ALTER TABLE `picklist_items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_categories`
--
ALTER TABLE `product_categories`
  MODIFY `category_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rack_locations`
--
ALTER TABLE `rack_locations`
  MODIFY `rack_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `segments`
--
ALTER TABLE `segments`
  MODIFY `segment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sku_costings`
--
ALTER TABLE `sku_costings`
  MODIFY `costing_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sku_cuts`
--
ALTER TABLE `sku_cuts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sku_cuts_logs`
--
ALTER TABLE `sku_cuts_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sku_notes`
--
ALTER TABLE `sku_notes`
  MODIFY `note_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `substitutions`
--
ALTER TABLE `substitutions`
  MODIFY `substitution_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `sno` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
