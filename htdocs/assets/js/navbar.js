// Authentication Check
(function () {
    const token = localStorage.getItem('token');
    const path = window.location.pathname;
    // List of public pages that don't require login
    const publicPages = ['login.html', 'index.html'];

    const isPublic = publicPages.some(page => path.endsWith(page));

    if (!token && !isPublic) {
        // Redirect to login if no token and not on a public page
        window.location.href = '/login.html';
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role') || '';
    const username = localStorage.getItem('username') || 'User';
    const userRoles = role.split(',');

    // Define menu items based on role
    const menuItems = [
        { name: 'Dashboard', icon: 'fas fa-home', link: '/dashboard.html', roles: ['admin', 'sub-admin', 'production'] },
        { name: 'Inventory', icon: 'fas fa-boxes', link: '/inventory.html', roles: ['admin', 'sub-admin', 'stocker', 'viewer', 'production'] },
        { name: 'Upload Picklist', icon: 'fas fa-cloud-upload-alt', link: '/admin/upload-picklist.html', roles: ['admin', 'sub-admin', 'production'] },
        { name: 'Picklists', icon: 'fas fa-clipboard-list', link: '/admin/picklists.html', roles: ['admin', 'sub-admin', 'production'] },
        { name: 'Pending Orders', icon: 'fas fa-clock', link: '/admin/pending-orders.html', roles: ['admin', 'sub-admin', 'production'] },
        { name: 'Factory Rates', icon: 'fas fa-industry', link: '/factory_rates.html', roles: ['admin', 'production'] },
        { name: 'Return Input', icon: 'fas fa-microphone', link: '/voice_input.html', roles: ['admin', 'sub-admin', 'stocker'] },
        { name: 'Costing Export', icon: 'fas fa-file-excel', link: '/costing_export.html', roles: ['admin', 'production'] },
        { name: 'Tailors Cut', icon: 'fas fa-cut', link: '/tailor.html', roles: ['admin', 'production', 'tailor'] },
        { name: 'Utilities', icon: 'fas fa-tools', link: '/utilities.html', roles: ['admin', 'sub-admin', 'production'] },
        { name: 'My Picklists', icon: 'fas fa-list-check', link: '/stocker/my-picklists.html', roles: ['stocker'] },
        { name: 'Settings', icon: 'fas fa-cog', link: '/settings.html', roles: ['admin', 'production'] }
    ];

    const sidebarHtml = `
        <div class="sidebar flex flex-col transition-all duration-300 collapsed" id="sidebar">
            <div class="h-16 flex items-center justify-center border-b border-gray-200 relative">
                <a href="/dashboard.html" class="nav-logo flex items-center gap-3 text-2xl font-bold text-slate-800 tracking-tighter transition-all">
                    <img src="/img/eazyinventory_logo.jpeg" alt="Logo" class="w-8 h-8 rounded-lg shadow-sm">
                    <span class="logo-text">EazyInventory</span>
                </a>
                <button id="desktopCollapseBtn" class="hidden md:flex absolute right-0 top-0 h-full w-8 items-center justify-center text-gray-400 hover:text-gray-600">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            
            <div class="p-4 border-b border-gray-100 user-info">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        ${username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p class="font-semibold text-gray-800">${username}</p>
                        <p class="text-xs text-gray-500 capitalize">${role}</p>
                    </div>
                </div>
            </div>

            <nav class="flex-1 overflow-y-auto py-4">
                <ul class="space-y-1 px-2">
                    ${menuItems.map(item => {
        if (item.roles.some(r => userRoles.includes(r))) {
            const isActive = window.location.pathname === item.link || (item.link !== '/inventory.html' && window.location.pathname.startsWith(item.link.replace('.html', '')));
            return `
                                <li>
                                    <a href="${item.link}" class="sidebar-link flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}" title="${item.name}">
                                        <i class="${item.icon} w-5 text-center text-lg"></i>
                                        <span class="sidebar-text">${item.name}</span>
                                    </a>
                                </li>
                            `;
        }
        return '';
    }).join('')}
                </ul>
            </nav>

            <div class="p-4 border-t border-gray-200">
                <button id="logoutBtn" class="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Logout">
                    <i class="fas fa-sign-out-alt w-5 text-center text-lg"></i>
                    <span class="sidebar-text">Logout</span>
                </button>
            </div>
        </div>

        <!-- Mobile Header -->
        <!-- Mobile Header -->
        <div class="md:hidden fixed top-0 left-0 w-full bg-white/80 backdrop-blur-md h-16 shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-40 flex items-center justify-center px-6 relative">
            <button id="mobileMenuBtn" class="absolute left-6 w-10 h-10 flex items-center justify-center rounded-full active:bg-gray-100 transition-colors text-gray-600 focus:outline-none">
                <i class="fas fa-bars text-xl"></i>
            </button>
            <div class="flex items-center gap-2">
                <img src="/img/eazyinventory_logo.jpeg" alt="Logo" class="w-8 h-8 rounded-lg">
                <h1 class="text-lg font-bold mobile-header-text leading-none">EazyInventory</h1>
            </div>
        </div>
        
        <!-- Mobile Overlay -->
        <div id="mobileOverlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden md:hidden glass-card"></div>
    `;

    // Inject Sidebar
    const body = document.body;
    const div = document.createElement('div');
    div.innerHTML = sidebarHtml;
    while (div.firstChild) {
        body.insertBefore(div.firstChild, body.firstChild);
    }

    // Add margin to main content
    const mainContent = document.querySelector('.container') || document.querySelector('div'); // Fallback
    if (mainContent) {
        mainContent.classList.add('main-content');
        mainContent.classList.add('pt-3'); // Add top padding for mobile header
        mainContent.classList.add('md:pt-8'); // Reset top padding on desktop
        mainContent.classList.add('expanded'); // Default to expanded (collapsed sidebar)
    }

    // Event Listeners
    const sidebar = document.getElementById('sidebar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');

    function closeSidebar() {
        sidebar.classList.remove('open');
        mobileOverlay.classList.add('hidden');
    }

    const desktopCollapseBtn = document.getElementById('desktopCollapseBtn');
    // mainContent is already defined above

    if (desktopCollapseBtn) {
        desktopCollapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            if (mainContent) mainContent.classList.toggle('expanded');

            // Rotate icon
            const icon = desktopCollapseBtn.querySelector('i');
            if (sidebar.classList.contains('collapsed')) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
            }
        });
    }

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            mobileOverlay.classList.toggle('hidden');
        });
    }

    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', closeSidebar);
    }

    // Close sidebar when clicking a link on mobile
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                closeSidebar();
            }
        });
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }


});
