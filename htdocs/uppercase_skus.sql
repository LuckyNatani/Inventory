-- Normalize all existing SKUs to Uppercase
UPDATE inventory SET sku = UPPER(sku);
UPDATE inventory_audit_log SET sku = UPPER(sku);
UPDATE sku_costings SET sku = UPPER(sku);
