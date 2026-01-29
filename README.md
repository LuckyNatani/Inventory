# Vibe Vision Inventory & Production System

A comprehensive web-based system for managing inventory, order fulfillment, and factory production costing. Designed for high-efficiency warehouse operations and precise production tracking.

## 🚀 Key Features

### 🏢 Warehouse & Inventory
*   **Inventory Management**: Full CRUD operations for products with support for multiple sizes (S-XXXL).
*   **Rack Location Management**: Track physical storage locations (`rack_locations` table) for efficient picking.
*   **Real-time Stock Tracking**: Visual indicators for Low Stock and Zero Stock items.
*   **Voice Input**: Experimental feature for hands-free return processing.

### 🏭 Factory & Production
*   **Factory Rates**: Manage service rates for different production stages (Stitching, Embroidery, Dying, etc.).
*   **SKU Costing**: Detailed costing breakdown for each SKU, including fabric consumption, wastage, and labor costs.
*   **Rate Logging**: Track historical pricing changes for audits and analytics.
*   **Reports**: Generate production and costing reports.

### 📦 Order Fulfillment (Stocker/Picker)
*   **Picklist Management**: Upload and manage order picklists from various e-commerce platforms.
*   **Mobile Picking Interface**: Optimized mobile view for stockers to pick items directly from the warehouse floor.
*   **Substitutions**: Handle out-of-stock scenarios with a substitution workflow.
*   **Validation**: Ensure correct items and quantities are fulfilled.

### 👥 User Roles & Access Control
The system implements Role-Based Access Control (RBAC):
*   **Admin**: Full access to all features, including User Management and Settings.
*   **Production**: Access to Factory Rates, Costing, and Inventory (Read/Write).
*   **Stocker**: Restricted access focused on Picklists and Inventory (Read-only/Limited Edit).
*   **Viewer**: Read-only access to inventory.

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
│   │   ├── login.php           # Authentication
│   │   └── ...
│   ├── assets/             # Frontend Assets
│   │   ├── js/                 # Application Logic
│   │   │   ├── inventory.js    # Main inventory UI logic
│   │   │   ├── navbar.js       # Dynamic navigation & RBAC
│   │   │   ├── ui.js           # Shared UI utilities (Spinners, Toasts)
│   │   │   └── ...
│   │   └── css/                # Custom Styles
│   ├── stocker/            # Stocker-specific pages
│   │   └── pick.html           # Mobile picking interface
│   ├── config/             # Configuration
│   │   └── db_connect.php      # Database connection settings
│   ├── dashboard.html      # Main admin dashboard
│   ├── inventory.html      # Primary inventory management view
│   ├── factory_rates.html  # Production costing view
│   └── index.html          # Entry point (redirects)
└── README.md           # Project Documentation
```

## ⚙️ Setup Instructions

1.  **Environment**: Requires a standard LAMP/WAMP/XAMPP stack.
2.  **Database**:
    *   Create a MySQL database (e.g., `inventory_system`).
    *   Import the database schema (JSON backup available in `htdocs/u988569002_vibevision.json` or use `setup_db.php` if reinstated).
    *   Configure credentials in `htdocs/config/db_connect.php`.
3.  **Deployment**:
    *   Point your web server document root to the `htdocs` directory.
    *   Ensure PHP has write access to `htdocs/assets/images` for uploads.

## 📝 User Flow

1.  **Login**: Users authenticate via `login.html`.
2.  **Dashboard**: proper landing page based on role (handled by `navbar.js`).
3.  **Core Actions**:
    *   **Admins** manage master data and view analytics.
    *   **Production** staff log new factory rates and calculate SKU costs.
    *   **Stockers** access `My Picklists` to fulfill orders on the go.
