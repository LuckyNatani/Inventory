import pandas as pd
import os

# Define columns based on database schema and user instructions
columns = [
    'sku',              # VARCHAR(50) - Required
    'category',         # VARCHAR(100)
    's',                # INT (Stock quantity)
    'm',                # INT
    'l',                # INT
    'xl',               # INT
    'xxl',              # INT
    'xxxl',             # INT
    'rack_location',    # VARCHAR(80)
    'purchase_cost',    # DECIMAL(10,2)
    'min_stock_alert',  # INT
    'status',           # ENUM('active','discontinued','archived')
    'live_links',       # TEXT
    'image_url'         # TEXT (Dropbox/Drive Link)
]

# Create an empty DataFrame with these columns
df = pd.DataFrame(columns=columns)

# Add a sample row to help users understand the format
sample_data = {
    'sku': 'SAMPLE-SKU-001',
    'category': 'Kurta Set',
    's': 10,
    'm': 15,
    'l': 20,
    'xl': 15,
    'xxl': 10,
    'xxxl': 5,
    'rack_location': 'A-01-01',
    'purchase_cost': 450.50,
    'min_stock_alert': 5,
    'status': 'active',
    'live_links': 'https://example.com/product',
    'image_url': 'https://drive.google.com/file/d/FILE_ID/view?usp=sharing'
}

df = pd.concat([df, pd.DataFrame([sample_data])], ignore_index=True)

# Ensure output directory exists (script is run from htdocs root usually, but let's be safe)
output_dir = 'templates'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

output_file = os.path.join(output_dir, 'bulk_inventory_template.xlsx')

# Write to Excel
try:
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='InventoryTemplate')
        
        # Access the workbook and sheet to add some formatting (optional but nice)
        workbook = writer.book
        worksheet = writer.sheets['InventoryTemplate']
        
        # Adjust column widths
        for column in df.columns:
            column_length = max(df[column].astype(str).map(len).max(), len(column))
            col_idx = df.columns.get_loc(column)
            worksheet.column_dimensions[chr(65 + col_idx)].width = column_length + 2

    print(f"Successfully created template at {output_file}")
except Exception as e:
    print(f"Error creating excel template: {e}")
