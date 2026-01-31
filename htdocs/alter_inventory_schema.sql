-- Migration to add support for unitary products
-- Author: Antigravity

-- 1. Add product_type column (default to 'sized' for backward compatibility)
ALTER TABLE `inventory`
ADD COLUMN `product_type` ENUM('sized', 'unitary') NOT NULL DEFAULT 'sized' AFTER `sku`;

-- 2. Add quantity column for unitary products
ALTER TABLE `inventory`
ADD COLUMN `quantity` INT(11) DEFAULT 0 AFTER `xxxl`;

-- Migration to add support for XS (Extra Small) size

-- 3. Add 'xs' column to inventory table
-- Placing it after 'category' to be the first size column (before 's' if possible visually)
ALTER TABLE `inventory`
ADD COLUMN `xs` INT(11) DEFAULT 0 AFTER `category`;

-- 4. Update Picklist Items Enum
-- Old: enum('s','m','l','xl','xxl','xxxl')
-- New: enum('xs','s','m','l','xl','xxl','xxxl')
ALTER TABLE `picklist_items`
MODIFY COLUMN `size` ENUM('xs','s','m','l','xl','xxl','xxxl') DEFAULT NULL;

-- 5. Update Substitutions Enums
ALTER TABLE `substitutions`
MODIFY COLUMN `original_size` ENUM('xs','s','m','l','xl','xxl','xxxl') DEFAULT NULL,
MODIFY COLUMN `substitute_size` ENUM('xs','s','m','l','xl','xxl','xxxl') DEFAULT NULL;
