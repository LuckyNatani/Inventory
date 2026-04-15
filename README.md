# EasyInventory & Production System

A comprehensive web-based system for managing inventory, order fulfillment, and factory production costing. Designed for high-efficiency warehouse operations and precise production tracking.

## 🚀 Key Features

### 🏢 Warehouse & Inventory
*   **Inventory Management**: Full CRUD operations for products with support for multiple sizes (S-XXXL).
*   **Rack Location Management**: Track physical storage locations (`rack_locations` table) for efficient picking.
*   **Real-time Stock Tracking**: Visual indicators for Low Stock and Zero Stock items.
*   **Manual Return Input**: Dedicated module (`return_input.html`) for efficient return processing via SKU and size entry.
*   **Public Catalog**: Public-facing portal (`catalog.html`) to showcase the product inventory to clients.

### 🏭 Factory & Production
*   **Factory Rates**: Manage service rates for different production stages (Stitching, Embroidery, Dying, etc.).
*   **SKU Costing**: Detailed costing breakdown for each SKU, including fabric consumption, wastage, and labor costs.
*   **Tailor Management**: Track fabric cuts, assignments, and production progress via the Tailor module (`tailor.html`).
*   **Rate Logging**: Track historical pricing changes for audits and analytics.
*   **Reports**: Generate production and costing reports.

### 📦 Order Fulfillment (Stocker/Picker)
*   **Picklist Management**: Upload and manage order picklists from various e-commerce platforms.
*   **Mobile Picking Interface**: Optimized mobile view for stockers to pick items directly from the warehouse floor.
*   **Substitutions**: Handle out-of-stock scenarios with a substitution workflow.
*   **Validation**: Ensure correct items and quantities are fulfilled.

### 🚀 Bulk Operations
*   **Bulk Image Upload**: Efficiently manage and associate product images in batches.
*   **Bulk Inventory Import**: Import large datasets via CSV/Excel templates.
*   **Bulk Link Updates**: Manage live e-commerce links across the entire inventory.

The system implements Role-Based Access Control (RBAC):
*   **Admin**: Full access to all features, including User Management and Settings.
*   **Sub-Admin**: Broad access across all modules but **restricted from viewing cost prices or manufacturing data**.
*   **Production**: Access to Factory Rates, Costing, and Inventory (Read/Write).
*   **Stocker**: Access to Picklists, Returns, and Inventory (Read-only/Limited Edit).
*   **Tailor**: Access to cutting assignments and production instructions.
*   **Viewer**: Read-only access to inventory and catalog.

## 🛠️ Technology Stack

*   **Backend**: PHP (Vanilla)
*   **Database**: MySQL
*   **Frontend**: HTML5, JavaScript (ES6+), Tailwind CSS (CDN)
*   **Architecture**: REST-like API (`htdocs/api/`) consumed by frontend fetch calls.

## 📂 Project Structure

```
c:\Users\SWATI\Downloads\Inventory\
├── htdocs/
│   ├── api/                # PHP Backend Endpoints
│   │   ├── inventory.php       # Core inventory CRUD
│   │   ├── factory_api.php     # Factory rates & costing logic
│   │   ├── return_input.php    # Returns processing API
│   │   └── ...
│   ├── assets/             # Frontend Assets
│   │   ├── js/                 # Application Logic
│   │   │   ├── inventory.js    # Main inventory UI logic
│   │   │   ├── navbar.js       # Dynamic navigation & RBAC
│   │   │   ├── return_input.js # Return processing logic
│   │   │   └── ...
│   ├── admin/              # Admin/Sub-admin specific pages
│   ├── stocker/            # Stocker-specific pages
│   │   └── pick.html           # Mobile picking interface
│   ├── dashboard.html      # Main analytics dashboard
│   ├── inventory.html      # Primary inventory management view
│   ├── catalog.html        # Public product catalog
│   ├── tailor.html         # Tailor management interface
│   ├── return_input.html   # Manual return processing
│   ├── manage_master.html  # Master data management
│   ├── bulk_inventory.html # Bulk import tool
│   ├── mysql_db_schema.sql # Core database schema
│   └── ...
└── README.md           # Project Documentation
```

## ⚙️ Setup Instructions

1.  **Environment**: Requires a standard LAMP/WAMP/XAMPP stack.
2.  **Database**:
    *   Create a MySQL database (e.g., `inventory_system`).
    *   Import the database schema using `htdocs/mysql_db_schema.sql`.
    *   Configure credentials in `htdocs/config/db_connect.php`.
3.  **Deployment**:
    *   Point your web server document root to the `htdocs` directory.
    *   Ensure PHP has write access to `htdocs/assets/images` for uploads.

## 📝 User Flow

1.  **Login**: Users authenticate via `login.html`.
2.  **Dashboard**: proper landing page based on role (handled by `navbar.js`).
3.  **Core Actions**:
    *   **Admins** manage master data, users, and full analytics.
    *   **Sub-Admins** manage operations and view non-pricing analytics.
    *   **Production** staff log factory rates, calculate SKU costs, and manage tailors.
    *   **Stockers** process returns via `Stock Returns` and fulfill picklists on the go.
