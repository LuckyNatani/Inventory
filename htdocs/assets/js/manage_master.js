// manage_master.js

document.addEventListener('DOMContentLoaded', () => {
    // Current User ID (assuming stored in localStorage from login)
    const userId = localStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'login.html';
        return;
    }

    // Global Cache
    window.masterData = null;
    window.currentSection = null;

    // Initial Fetch
    fetchMaster();

    // --- Main Actions ---

    window.openSection = async (type) => {
        window.currentSection = type;
        const modal = document.getElementById('sectionModal');
        const backdrop = document.getElementById('sectionModalBackdrop');
        const panel = document.getElementById('sectionModalPanel');

        // Open Modal
        modal.classList.remove('hidden');
        // Small delay for transition
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            // Slide in
            panel.classList.remove('translate-x-full');
        }, 10);

        // Load Content
        if (!window.masterData) await fetchMaster();
        renderSection(type);
    };

    window.closeSectionModal = () => {
        const modal = document.getElementById('sectionModal');
        const backdrop = document.getElementById('sectionModalBackdrop');
        const panel = document.getElementById('sectionModalPanel');

        backdrop.classList.add('opacity-0');
        panel.classList.add('translate-x-full');

        setTimeout(() => {
            modal.classList.add('hidden');
            window.currentSection = null;
        }, 300);
    }

    // --- Data Loading ---

    async function fetchMaster() {
        try {
            const res = await fetch('api/factory_api.php?action=get_master_data&all=true');
            const data = await res.json();
            if (data.success) {
                window.masterData = data;
                // If a section is currently open, re-render it to show updates
                if (window.currentSection && !document.getElementById('sectionModal').classList.contains('hidden')) {
                    renderSection(window.currentSection);
                }
            }
        } catch (e) { console.error('Fetch error', e); }
    }

    // --- Rendering Logic ---

    function renderSection(type) {
        const titleEl = document.getElementById('modalSectionTitle');
        const descEl = document.getElementById('modalSectionDesc');
        const contentEl = document.getElementById('modalContentArea');
        const addBtn = document.getElementById('modalAddBtn');

        // Reset
        contentEl.innerHTML = '';
        addBtn.classList.add('hidden');
        addBtn.onclick = null;

        if (type === 'segment') {
            titleEl.textContent = 'Segments';
            descEl.textContent = 'Manage garment types like Kurta, Pant, Shirt.';
            addBtn.classList.remove('hidden');
            addBtn.onclick = () => openFormModal('segment');
            contentEl.innerHTML = getSegmentsHTML(window.masterData.segments);
        }
        else if (type === 'factory') {
            titleEl.textContent = 'Factories';
            descEl.textContent = 'Manage manufacturing units and contact details.';
            addBtn.classList.remove('hidden');
            addBtn.onclick = () => openFormModal('factory');
            contentEl.innerHTML = getFactoriesHTML(window.masterData.factories);
        }
        else if (type === 'category') {
            titleEl.textContent = 'Categories';
            descEl.textContent = 'Product categories for inventory grouping.';
            addBtn.classList.remove('hidden');
            addBtn.onclick = () => openFormModal('category');
            contentEl.innerHTML = getCategoriesHTML(window.masterData.categories || []);
        }
        else if (type === 'fabric') {
            titleEl.textContent = 'Fabrics';
            descEl.textContent = 'Types of fabrics used in production.';
            addBtn.classList.remove('hidden');
            addBtn.onclick = () => openFormModal('fabric');
            contentEl.innerHTML = getFabricsHTML(window.masterData.fabrics || []);
        }
        else if (type === 'expense') {
            titleEl.textContent = 'Operational Costs';
            descEl.textContent = 'Track monthly expenses.';
            // Expense has a different add button location inside the view usually, but we can use the top one too.
            // For this design, let's keep the inner logic for ops or adapt.
            // Let's adapt to use the same top button for adding expense.
            addBtn.classList.remove('hidden');
            addBtn.onclick = () => openFormModal('expense'); // Custom expense modal
            renderOpsView(contentEl); // Expenses need async fetch for specific month
        }
        else if (type === 'logic') {
            titleEl.textContent = 'Stock Logic';
            descEl.textContent = 'Configure thresholds for auto-stock status.';
            renderStockLogic(contentEl);
        }
    }

    // --- HTML Generators (Grid Cards inside Modal) ---

    function getSegmentsHTML(list) {
        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${list.map(s => `
                    <div class="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group ${s.status === 'inactive' ? 'opacity-60 grayscale' : ''}">
                        <div class="flex items-center gap-3">
                             <div class="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <i class="fas fa-layer-group"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800">${s.name}</h4>
                                <span class="text-[10px] font-bold uppercase tracking-wider ${s.status === 'active' ? 'text-green-600' : 'text-gray-400'}">${s.status}</span>
                            </div>
                        </div>
                         <div class="flex items-center gap-2">
                             <button onclick='openFormModal("segment", ${JSON.stringify(s)})' class="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            ${getToggleHTML('segment', s)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function getFactoriesHTML(list) {
        return `
             <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${list.map(f => `
                    <div class="p-5 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group ${f.status === 'inactive' ? 'opacity-60 grayscale' : ''}">
                        <div class="flex justify-between items-start mb-3">
                             <div class="flex items-center gap-3">
                                <div class="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600">
                                    <i class="fas fa-industry"></i>
                                </div>
                                <div>
                                    <h4 class="font-bold text-gray-800">${f.name}</h4>
                                    <span class="text-[10px] font-bold uppercase tracking-wider ${f.status === 'active' ? 'text-green-600' : 'text-gray-400'}">${f.status}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-1">
                                <button onclick='openFormModal("factory", ${JSON.stringify(f)})' class="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                ${getToggleHTML('factory', f)}
                            </div>
                        </div>
                        <div class="space-y-1 pl-13">
                             ${f.contact_info ? `<div class="text-sm text-gray-600 flex items-center gap-2"><i class="fas fa-phone text-xs text-gray-400 w-4"></i>${f.contact_info}</div>` : ''}
                             ${f.address ? `<div class="text-sm text-gray-600 flex items-center gap-2"><i class="fas fa-map-marker-alt text-xs text-gray-400 w-4"></i><span class="truncate max-w-[200px]">${f.address}</span></div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function getCategoriesHTML(list) {
        return `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${list.map(c => `
                    <div class="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group ${c.status === 'inactive' ? 'opacity-60 grayscale' : ''}">
                        <div class="flex items-center gap-3">
                             <div class="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                                <i class="fas fa-tags"></i>
                            </div>
                            <h4 class="font-bold text-gray-800">${c.name}</h4>
                        </div>
                         <div class="flex items-center gap-2">
                             <button onclick='openFormModal("category", ${JSON.stringify(c)})' class="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            ${getToggleHTML('category', c)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function getFabricsHTML(list) {
        return `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                ${list.map(f => `
                    <div class="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow flex justify-between items-center group">
                        <div class="flex items-center gap-3">
                             <div class="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                                <i class="fas fa-scroll"></i>
                            </div>
                            <h4 class="font-bold text-gray-800">${f.name}</h4>
                        </div>
                         <div class="flex items-center gap-2">
                             <button onclick='openFormModal("fabric", ${JSON.stringify(f)})' class="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // --- Complex Views (Ops & Logic) ---

    async function renderOpsView(container) {
        container.innerHTML = `
            <div class="flex flex-col space-y-6">
                <!-- Month Selector & Stats -->
                <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-center justify-between">
                     <div class="flex items-center gap-3">
                        <label class="font-semibold text-gray-700 text-sm">Target Month</label>
                        <input type="month" id="opsMonth" class="p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none">
                     </div>
                     <div class="flex gap-8 text-sm items-center">
                        <div class="text-right">
                            <span class="block text-gray-400 text-[10px] uppercase font-bold tracking-wider">Total Exp</span>
                            <span class="block font-bold text-gray-900 text-lg" id="opStatTotal">...</span>
                        </div>
                        <div class="text-right">
                            <span class="block text-gray-400 text-[10px] uppercase font-bold tracking-wider">Units Sold</span>
                            <span class="block font-bold text-blue-600 text-lg" id="opStatSold">...</span>
                        </div>
                        <div class="text-right">
                             <span class="block text-gray-400 text-[10px] uppercase font-bold tracking-wider">Cost/Unit</span>
                            <span class="block font-bold text-green-600 text-lg" id="opStatCost">...</span>
                        </div>
                        <button id="btnApplyCost" onclick="applyOpsCost()" disabled class="disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                            Apply to All
                        </button>
                     </div>
                </div>

                <!-- List -->
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table class="w-full text-sm text-left">
                        <thead class="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                            <tr>
                                <th class="px-6 py-4">Date</th>
                                <th class="px-6 py-4">Expense</th>
                                <th class="px-6 py-4">Category</th>
                                <th class="px-6 py-4 text-right">Amount</th>
                                <th class="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody id="opsTableBody">
                            <tr><td colspan="5" class="p-6 text-center text-gray-400">Loading...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        const d = new Date();
        const monthInput = document.getElementById('opsMonth');
        monthInput.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

        const loadMonthData = async () => {
            const m = monthInput.value;
            try {
                const [resStats, resList] = await Promise.all([
                    fetch(`api/operational_cost.php?action=stats&month=${m}`).then(r => r.json()),
                    fetch(`api/operational_cost.php?action=list&month=${m}`).then(r => r.json())
                ]);

                // Stats
                document.getElementById('opStatTotal').textContent = '₹' + (resStats.total_expenses || 0).toLocaleString();
                document.getElementById('opStatSold').textContent = (resStats.total_sold || 0).toLocaleString();
                document.getElementById('opStatCost').textContent = '₹' + (resStats.cost_per_unit || 0);

                // Enable/Disable Apply Button
                const btnApply = document.getElementById('btnApplyCost');
                if (resStats.cost_per_unit > 0) {
                    btnApply.disabled = false;
                    btnApply.dataset.cost = resStats.cost_per_unit;
                    btnApply.dataset.month = m;
                } else {
                    btnApply.disabled = true;
                }

                // List
                const tbody = document.getElementById('opsTableBody');
                if (!resList || resList.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400 italic">No expenses found for this month.</td></tr>';
                } else {
                    tbody.innerHTML = resList.map(item => `
                            <tr class="hover:bg-gray-50 border-b border-gray-50 last:border-0 group">
                                <td class="px-6 py-3 text-gray-600">${item.expense_date}</td>
                                <td class="px-6 py-3 font-medium text-gray-900">${item.expense_name}</td>
                                <td class="px-6 py-3"><span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">${item.category}</span></td>
                                <td class="px-6 py-3 text-right font-medium">₹${Number(item.amount).toLocaleString()}</td>
                                <td class="px-6 py-3 text-center">
                                    <button onclick="deleteExpense(${item.id})" class="text-red-300 hover:text-red-600 transition-colors"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('');
                }

            } catch (e) { console.error(e); }
        };

        monthInput.addEventListener('change', loadMonthData);
        loadMonthData(); // Initial load
    }

    async function renderStockLogic(container) {
        container.innerHTML = `
            <div class="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <form id="stockLogicForm" class="space-y-8">
                     <!-- Populated by JS -->
                     <div class="animate-pulse space-y-4">
                        <div class="h-4 bg-gray-100 rounded w-3/4"></div>
                        <div class="h-10 bg-gray-100 rounded"></div>
                     </div>
                </form>
            </div>
        `;

        try {
            const res = await fetch(`api/settings.php?action=get_all&user_id=${userId}`);
            const json = await res.json();
            const s = json.data || {};

            document.getElementById('stockLogicForm').innerHTML = `
                <!-- Slow Moving -->
                <div class="flex gap-5 items-start">
                    <div class="w-12 h-12 rounded-xl bg-yellow-50 flex items-center justify-center text-yellow-600 shrink-0"><i class="fas fa-hourglass-half text-xl"></i></div>
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800">Slow Moving</h4>
                        <p class="text-xs text-gray-500 mb-3">Thresholds for slow moving status.</p>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Max Units</label>
                                <input type="number" id="slow_moving_qty" value="${s.slow_moving_qty || 100}" class="w-full p-2 border border-gray-200 rounded-lg text-sm">
                            </div>
                             <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Days</label>
                                <input type="number" id="slow_moving_days" value="${s.slow_moving_days || 90}" class="w-full p-2 border border-gray-200 rounded-lg text-sm">
                            </div>
                        </div>
                    </div>
                </div>

                 <!-- Dead Stock -->
                <div class="flex gap-5 items-start">
                    <div class="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shrink-0"><i class="fas fa-ban text-xl"></i></div>
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800">Dead Stock</h4>
                        <p class="text-xs text-gray-500 mb-3">Thresholds for dead stock status.</p>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Max Units</label>
                                <input type="number" id="dead_stock_qty" value="${s.dead_stock_qty || 0}" class="w-full p-2 border border-gray-200 rounded-lg text-sm">
                            </div>
                             <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Days</label>
                                <input type="number" id="dead_stock_days" value="${s.dead_stock_days || 90}" class="w-full p-2 border border-gray-200 rounded-lg text-sm">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="pt-4 flex justify-end">
                    <button type="submit" class="bg-black text-white px-6 py-2 rounded-lg font-bold hover:shadow-lg transition-shadow">Save Configuration</button>
                </div>
             `;

            // Attach listener
            document.getElementById('stockLogicForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button');
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Saving...';

                const settings = {
                    slow_moving_qty: document.getElementById('slow_moving_qty').value,
                    slow_moving_days: document.getElementById('slow_moving_days').value,
                    dead_stock_qty: document.getElementById('dead_stock_qty').value,
                    dead_stock_days: document.getElementById('dead_stock_days').value,
                };

                try {
                    const res = await fetch(`api/settings.php?action=update&user_id=${userId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ settings })
                    });
                    alert('Settings updated');
                } catch (err) { console.error(err); alert('Error saving'); }

                btn.disabled = false;
                btn.textContent = originalText;
            });

        } catch (e) { console.error(e); }
    }

    // --- Nested Form Modal (Add/Edit) ---

    window.openFormModal = (type, data = null) => {
        const modal = document.getElementById('formModal');
        const panel = document.getElementById('formModalPanel');
        const form = document.getElementById('dynamicForm');
        const title = document.getElementById('formModalTitle');
        const btn = document.getElementById('formSubmitBtn');

        modal.classList.remove('hidden');
        setTimeout(() => {
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        }, 10);

        title.textContent = data ? `Edit ${capitalize(type)}` : `Add New ${capitalize(type)}`;
        btn.textContent = data ? 'Update' : 'Save';

        // Build Form
        let html = '';
        if (type === 'segment') {
            html = `
                <input type="hidden" name="segment_id" value="${data?.segment_id || ''}">
                <input type="hidden" name="sub_action" value="${data ? 'update' : 'create'}">
                <input type="hidden" name="context_type" value="manage_segment">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Segment Name</label>
                    <input type="text" name="name" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value="${data?.name || ''}" required>
                </div>
            `;
        } else if (type === 'factory') {
            html = `
                <input type="hidden" name="factory_id" value="${data?.factory_id || ''}">
                <input type="hidden" name="sub_action" value="${data ? 'update' : 'create'}">
                <input type="hidden" name="context_type" value="manage_factory">
                <div class="grid grid-cols-1 gap-3">
                     <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Factory Name</label>
                        <input type="text" name="name" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value="${data?.name || ''}" required>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                        <input type="text" name="contact_info" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value="${data?.contact_info || ''}">
                    </div>
                     <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Address</label>
                        <textarea name="address" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" rows="2">${data?.address || ''}</textarea>
                    </div>
                </div>
            `;
        } else if (type === 'category') {
            html = `
                <input type="hidden" name="category_id" value="${data?.category_id || ''}">
                <input type="hidden" name="sub_action" value="${data ? 'update' : 'create'}">
                <input type="hidden" name="context_type" value="manage_category">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Category Name</label>
                    <input type="text" name="name" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value="${data?.name || ''}" required>
                </div>
            `;
        } else if (type === 'fabric') {
            html = `
                <input type="hidden" name="fabric_id" value="${data?.fabric_id || ''}">
                <input type="hidden" name="sub_action" value="${data ? 'update' : 'create'}">
                <input type="hidden" name="context_type" value="manage_fabric">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Fabric Name</label>
                    <input type="text" name="name" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value="${data?.name || ''}" required>
                </div>
            `;
        } else if (type === 'expense') {
            const m = document.getElementById('opsMonth')?.value || new Date().toISOString().slice(0, 7);
            html = `
                <input type="hidden" name="context_type" value="expense">
                <input type="hidden" name="date" value="${m}-01">
                <div class="space-y-3">
                     <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Expense Name</label>
                        <input type="text" name="name" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Rent" required>
                    </div>
                     <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Amount</label>
                        <input type="number" step="0.01" name="amount" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" required>
                    </div>
                     <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                         <select name="category" class="w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                             ${['Rent', 'Salary', 'Marketing', 'Utilities', 'Logistics', 'Packaging', 'Other'].map(o => `<option value="${o}">${o}</option>`).join('')}
                         </select>
                    </div>
                </div>
            `;
        }

        form.innerHTML = html;
        form.dataset.currentType = type;
    };

    window.closeFormModal = () => {
        const modal = document.getElementById('formModal');
        const panel = document.getElementById('formModalPanel');

        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');

        setTimeout(() => {
            modal.classList.add('hidden');
        }, 200);
    };

    window.submitDynamicForm = async () => {
        const form = document.getElementById('dynamicForm');
        const fd = new FormData(form);
        const payload = {};
        fd.forEach((v, k) => payload[k] = v);

        const btn = document.getElementById('formSubmitBtn');
        const orgText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Saving...';

        let url = 'api/factory_api.php?action=' + payload.context_type;
        if (payload.context_type === 'expense') {
            url = 'api/operational_cost.php?action=add';
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                closeFormModal();
                // Refresh Data
                if (payload.context_type === 'expense') {
                    // Re-trigger month change event to reload table
                    const m = document.getElementById('opsMonth');
                    if (m) m.dispatchEvent(new Event('change'));
                } else {
                    await fetchMaster();
                }
            } else {
                alert(data.message || data.error || 'Error saving');
            }
        } catch (e) { console.error(e); alert('System Error'); }

        btn.disabled = false;
        btn.textContent = orgText;
    };

    // --- Helpers ---

    function getToggleHTML(type, item) {
        const id = type === 'segment' ? item.segment_id : (type === 'factory' ? item.factory_id : item.category_id);
        const isActive = item.status === 'active';
        return `
            <label class="relative inline-flex items-center cursor-pointer ml-2" onclick="event.stopPropagation()">
                <input type="checkbox" class="sr-only peer" ${isActive ? 'checked' : ''} onchange="toggleStatus('${type}', ${id}, '${item.status}')">
                <div class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0px] after:left-[0px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
            </label>
        `;
    }

    window.toggleStatus = async (type, id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const endpoint = type === 'segment' ? 'manage_segment' : (type === 'factory' ? 'manage_factory' : 'manage_category');
        const idKey = type === 'segment' ? 'segment_id' : (type === 'factory' ? 'factory_id' : 'category_id');

        try {
            await fetch(`api/factory_api.php?action=${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sub_action: 'toggle_status', [idKey]: id, status: newStatus })
            });
            await fetchMaster();
        } catch (e) { console.error(e); }
    };

    window.deleteExpense = async (id) => {
        if (!confirm('Delete this expense?')) return;
        try {
            const fd = new FormData();
            fd.append('id', id);
            await fetch('api/operational_cost.php?action=delete', { method: 'POST', body: fd });
            const m = document.getElementById('opsMonth');
            if (m) m.dispatchEvent(new Event('change'));
        } catch (e) { console.error(e); }
    }

    function capitalize(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }

    window.applyOpsCost = async () => {
        const btn = document.getElementById('btnApplyCost');
        if (btn.disabled) return;

        const cost = btn.dataset.cost;
        const month = btn.dataset.month;

        if (!confirm(`WARNING: You are about to update the Operational Cost for ALL SKUs to ₹${cost}/unit.\n\nThis will recalculate the Total Cost for every item. This action CANNOT be reversed.\n\nAre you sure you want to proceed?`)) return;

        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Applying...';

        try {
            const res = await fetch('api/operational_cost.php?action=apply_to_all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cost_per_unit: cost, month: month, user_id: userId })
            });
            const data = await res.json();
            if (data.success) {
                alert('Operational cost applied successfully to all SKUs.');
            } else {
                alert('Error: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            alert('System Error');
        }

        btn.disabled = false;
        btn.textContent = originalText;
    };
});
