-- Database Migration for Operational Cost Feature

-- 1. Create operational_expenses table
CREATE TABLE IF NOT EXISTS operational_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    expense_date DATE NOT NULL,
    category VARCHAR(50) DEFAULT 'Other',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create sku_costing_history table
CREATE TABLE IF NOT EXISTS sku_costing_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL,
    field_changed VARCHAR(50) NOT NULL,
    old_value DECIMAL(10,2),
    new_value DECIMAL(10,2),
    changed_by INT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    month_ref VARCHAR(7),
    INDEX (sku),
    INDEX (changed_at)
);

-- Note: The sku_costings table already has 'operational_cost' and 'updated_at' columns based on your current schema, 
-- so no ALTER TABLE commands are needed for it.
