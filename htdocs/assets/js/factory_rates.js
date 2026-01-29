const api = {
    baseUrl: 'api/factory_api.php',
    get: async (action, params = {}) => {
        const url = new URL(api.baseUrl, window.location.href);
        url.searchParams.append('action', action);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const res = await fetch(url);
        if (res.status === 401) {
            alert("Session expired. Please login again.");
            window.location.href = '/login.html';
            return;
        }
        return res.json();
    },
    post: async (action, body) => {
        const res = await fetch(`${api.baseUrl}?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.status === 401) {
            alert("Session expired. Please login again.");
            window.location.href = '/login.html';
            return;
        }
        return res.json();
    }
};

// State
let currentSku = null;
let currentHistoryUserId = null;
let masterData = { segments: [], factories: [], fabrics: [] };
let masterDataLoaded = false;

// Elements
const viewInitial = document.getElementById('initialView');
const viewSkuRate = document.getElementById('skuRateView');
const viewSkuCosting = document.getElementById('skuCostingView');
const viewSkuNotes = document.getElementById('skuNotesView'); // New
const skuTabs = document.getElementById('skuTabs');
const skuSearch = document.getElementById('skuSearch');
const costingForm = document.getElementById('costingForm'); // Moved here to avoid Temporal Dead Zone

// Modals
const logRateModal = document.getElementById('logRateModal');
const createMasterModal = document.getElementById('createMasterModal');
const voidConfirmModal = document.getElementById('voidConfirmModal');

// Init
document.addEventListener('DOMContentLoaded', () => {
    // fetchMasterData(); // Lazy loaded now
    checkUrlParams();
    if (typeof controlUIByRole === 'function') controlUIByRole();
});

// Search Logic
const searchResults = document.getElementById('searchResults');
let searchTimeout = null;


skuSearch.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchResults.classList.add('hidden'); // Hide dropdown on enter
        performManualSearch();
    }
});

// Autocomplete
skuSearch.addEventListener('input', function () {
    const term = this.value.trim();
    if (searchTimeout) clearTimeout(searchTimeout);

    if (term.length < 2) {
        searchResults.classList.add('hidden');
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const res = await api.get('search_sku', { term });
            if (res.success && res.results.length > 0) {
                renderSearchResults(res.results);
            } else {
                searchResults.classList.add('hidden');
            }
        } catch (e) { console.error("Search error", e); }
    }, 300); // Debounce
});

function renderSearchResults(results) {
    searchResults.innerHTML = '';
    results.forEach(sku => {
        const div = document.createElement('div');
        div.className = 'px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-50 last:border-0 text-gray-700 font-medium hover:text-indigo-700 transition-colors';
        div.textContent = sku;
        div.onclick = () => {
            skuSearch.value = sku;
            searchResults.classList.add('hidden');
            loadSkuData(sku);
        };
        searchResults.appendChild(div);
    });
    searchResults.classList.remove('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!skuSearch.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }

});

// Clear Filters Logic
if (document.getElementById('clearFiltersBtn')) {
    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
        document.getElementById('filterSegment').value = '';
        document.getElementById('filterFactory').value = '';
        document.getElementById('filterDateStart').value = '';
        document.getElementById('filterDateEnd').value = '';
        document.getElementById('showVoided').checked = false;

        document.getElementById('filterDateStart').type = 'text'; // Revert to placeholder
        document.getElementById('filterDateEnd').type = 'text'; // Revert to placeholder

        if (currentSku) fetchRates(currentSku);
    });
}

function performManualSearch() {
    const sku = skuSearch.value.trim();
    if (sku) loadSkuData(sku);
}

function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const sku = urlParams.get('sku');
    if (sku) {
        skuSearch.value = sku;
        loadSkuData(sku);
    }
}

// Data Loading
async function loadSkuData(sku) {
    currentSku = sku;

    // Ensure master data is loaded before interactions
    await fetchMasterData();

    document.getElementById('currentSku').textContent = sku;
    document.getElementById('modalSkuDisplay').textContent = sku;

    document.getElementById('modalSkuDisplay').textContent = sku;

    viewInitial.classList.add('hidden');
    viewSkuRate.classList.remove('hidden');
    viewSkuCosting.classList.add('hidden');
    skuTabs.classList.remove('hidden');

    // Reset tabs
    switchTab('rates');

    await fetchRates(sku);

    // Fetch Cost Price for Header
    const costRes = await api.get('get_costing', { sku });
    if (costRes.success && costRes.costing) {
        document.getElementById('skuCostPrice').textContent = Number(costRes.costing.total_cost || 0).toFixed(0);
    } else {
        document.getElementById('skuCostPrice').textContent = '0';
    }

    // Load SKU Image
    const skuImg = document.getElementById('skuImage');
    if (skuImg) {
        // Use CONFIG.IMAGE_BASE_URL if available, otherwise default
        const baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.IMAGE_BASE_URL)
            ? CONFIG.IMAGE_BASE_URL
            : "assets/images/products/";

        // Standard logic: Use img1 if available, else fallback to encoded SKU
        // Note: costRes.costing now includes img1 from API update
        const imgName = (costRes.costing && costRes.costing.img1)
            ? costRes.costing.img1
            : encodeURIComponent(sku);

        // Inventory uses .webp.
        const fullImgUrlWebp = `${baseUrl}${imgName}.webp`;

        skuImg.src = fullImgUrlWebp;
        skuImg.classList.remove('hidden');

        skuImg.onerror = function () {
            this.classList.add('hidden');
        };
    }

    // Pass fetched data to avoid double API call
    loadCosting(sku, costRes.success ? costRes.costing : null);
    loadNotes(sku); // Preload notes

    // Render Live Links
    const linksContainer = document.getElementById('skuLinks');
    if (linksContainer) {
        linksContainer.innerHTML = '';
        if (costRes.success && costRes.costing && costRes.costing.live_links) {
            const urls = costRes.costing.live_links.split(',');
            urls.forEach(url => {
                url = url.trim();
                if (!url) return;
                let type = 'link';
                if (url.includes('myntra')) type = 'myntra';
                else if (url.includes('amazon')) type = 'amazon';
                else if (url.includes('flipkart')) type = 'flipkart';
                else if (url.includes('ajio')) type = 'ajio';
                else if (url.includes('snapdeal')) type = 'snapdeal';

                linksContainer.innerHTML += getLinkIcon(url, type);
            });
        }
    }
}

function getLinkIcon(url, type) {
    if (!url) return '';

    // Refined Logic
    let inner = '';
    if (type === 'myntra') inner = `<span class="w-5 h-5 flex items-center justify-center bg-pink-100 rounded-full cursor-pointer hover:scale-110 transition-transform"><img src="https://cdn.iconscout.com/icon/free/png-256/free-myntra-logo-icon-download-in-svg-png-gif-file-formats--shopping-brand-online-application-app-mobile-indian-companies-pack-logos-icons-2249158.png" class="w-3 h-3" alt="M"></span>`;
    else if (type === 'amazon') inner = `<span class="w-5 h-5 flex items-center justify-center bg-yellow-100 rounded-full text-yellow-700 text-xs cursor-pointer hover:scale-110 transition-transform"><i class="fab fa-amazon"></i></span>`;
    else if (type === 'flipkart') inner = `<span class="w-5 h-5 flex items-center justify-center bg-blue-100 rounded-full text-blue-600 font-bold text-[10px] cursor-pointer hover:scale-110 transition-transform">F</span>`;
    else if (type === 'ajio') inner = `<span class="w-5 h-5 flex items-center justify-center bg-gray-800 rounded-full text-white font-bold text-[10px] cursor-pointer hover:scale-110 transition-transform">A</span>`;
    else if (type === 'snapdeal') inner = `<span class="w-5 h-5 flex items-center justify-center bg-red-100 rounded-full text-red-600 font-bold text-[10px] cursor-pointer hover:scale-110 transition-transform">S</span>`;
    else inner = `<span class="w-5 h-5 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 text-xs cursor-pointer hover:scale-110 transition-transform"><i class="fas fa-link"></i></span>`;

    return `<a href="${url}" target="_blank" title="${type}">${inner}</a>`;
}

window.openImageModal = function (src) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    if (modal && modalImg) {
        modalImg.src = src;
        modal.classList.remove('hidden');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('imageModal').classList.add('hidden');
        });
    }
    // Close on background click
    const modal = document.getElementById('imageModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
});

async function fetchRates(sku, page = 1) {
    const showVoided = document.getElementById('showVoided').checked;
    const segmentId = document.getElementById('filterSegment').value;
    const factoryId = document.getElementById('filterFactory').value;
    const dateStart = document.getElementById('filterDateStart').value;
    const dateEnd = document.getElementById('filterDateEnd').value;

    const listContainer = document.getElementById('historyTableBody');
    const summaryContainer = document.getElementById('latestRatesGrid');
    const pagination = document.getElementById('historyPagination');
    const inventoryGrid = document.getElementById('inventoryGrid');

    listContainer.innerHTML = '<tr><td colspan="7" class="text-center p-4">Loading...</td></tr>';

    try {
        const params = { sku, page, voided: showVoided, limit: 10 };
        if (segmentId) params.segment_id = segmentId;
        if (factoryId) params.factory_id = factoryId;
        if (dateStart) params.date_start = dateStart;
        if (dateEnd) params.date_end = dateEnd;

        const data = await api.get('get_rates', params);

        if (data.success) {
            // Render History
            listContainer.innerHTML = '';
            if (data.logs.length === 0) {
                listContainer.innerHTML = '<tr><td colspan="7" class="text-center p-6 text-gray-500">No rate history found for this SKU.</td></tr>';
            } else {
                data.logs.forEach(log => {
                    const isVoided = log.voided_flag == 1;
                    const tr = document.createElement('tr');
                    if (isVoided) tr.className = 'bg-red-50 text-gray-400';
                    tr.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap text-sm">${log.created_at}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${log.segment_name}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">${log.factory_name}</td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold">₹${Number(log.price).toFixed(2)}</td>
                        <td class="px-6 py-4 text-sm max-w-xs truncate" title="${log.note}">${log.note || '-'}
                            ${isVoided ? `<div class="text-red-500 text-xs mt-1 font-bold">Cancel: ${log.void_reason}</div>` : ''}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">${log.created_by_name}</td>
                        <td class="px-6 py-4 text-right">
                             ${!isVoided && canEdit() ? `<button class="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-wider void-btn" data-id="${log.log_id}">Cancel</button>` : ''}
                        </td>
                    `;
                    listContainer.appendChild(tr);
                });
            }

            // Render Pagination
            pagination.innerHTML = '';
            if (data.pagination.total_pages > 1) {
                if (data.pagination.current_page > 1) {
                    const prev = document.createElement('button');
                    prev.className = 'px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50';
                    prev.textContent = 'Previous';
                    prev.onclick = () => fetchRates(sku, data.pagination.current_page - 1);
                    pagination.appendChild(prev);
                }
                if (data.pagination.current_page < data.pagination.total_pages) {
                    const next = document.createElement('button');
                    next.className = 'px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 ml-2';
                    next.textContent = 'Next';
                    next.onclick = () => fetchRates(sku, data.pagination.current_page + 1);
                    pagination.appendChild(next);
                }
            }

            // Render Summary (Only on page 1 usually)
            if (page === 1) {
                summaryContainer.innerHTML = '';
                if (data.summary.length === 0) {
                    summaryContainer.innerHTML = '<div class="col-span-full text-center text-gray-400 p-4 border border-dashed border-gray-200 rounded-lg">No active rates</div>';
                }
                data.summary.forEach(sum => {
                    const card = document.createElement('div');
                    card.className = 'bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition-shadow cursor-default';
                    card.innerHTML = `
                        <div>
                            <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">${sum.segment_name}</p>
                            <p class="text-xl font-bold text-gray-800">₹${Number(sum.price).toFixed(2)}</p>
                            <p class="text-xs text-gray-500 mt-1 truncate max-w-[140px]" title="${sum.factory_name}">${sum.factory_name}</p>
                        </div>
                        <div class="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
                             <i class="fas fa-tag"></i>
                        </div>
                    `;
                    summaryContainer.appendChild(card);
                });
            }

            // Render Inventory Breakdown
            // Inventory Grid
            inventoryGrid.innerHTML = '';
            let totalStock = 0;
            if (data.meta) {
                // document.getElementById('skuTotalStock').textContent = data.meta.quantity || 0; -- Removed
                ['s', 'm', 'l', 'xl', 'xxl', 'xxxl'].forEach(size => {
                    const val = Number(data.meta[size] || 0);
                    totalStock += val;
                    renderInvBox(size.toUpperCase(), val);
                });
                // Add Total Stock Box
                renderInvBox('Total', totalStock, true);
            }
        }
    } catch (e) { console.error(e); alert('Error fetching rates'); }
}

const canEdit = () => {
    const role = localStorage.getItem('role') || '';
    const userRoles = role.split(',');
    return ['admin', 'sub-admin', 'production'].some(r => userRoles.includes(r));
};

// UI Events checking
const triggerFetch = () => { if (currentSku) fetchRates(currentSku); };
document.getElementById('showVoided').addEventListener('change', triggerFetch);
document.getElementById('filterSegment').addEventListener('change', triggerFetch);
document.getElementById('filterFactory').addEventListener('change', triggerFetch);
document.getElementById('filterDateStart').addEventListener('change', triggerFetch);
document.getElementById('filterDateEnd').addEventListener('change', triggerFetch);

// Void Logic
let voidIdToProcess = null;
document.getElementById('historyTableBody').addEventListener('click', (e) => {
    if (e.target.classList.contains('void-btn')) {
        voidIdToProcess = e.target.dataset.id;
        document.getElementById('voidConfirmReason').value = '';
        voidConfirmModal.classList.remove('hidden');
    }
});

document.getElementById('cancelVoidBtn').onclick = () => voidConfirmModal.classList.add('hidden');
document.getElementById('doVoidBtn').onclick = async () => {
    const reason = document.getElementById('voidConfirmReason').value.trim();
    if (!reason) { alert('Reason is required'); return; }

    const res = await api.post('void_rate', { log_id: voidIdToProcess, reason });
    if (res.success) {
        voidConfirmModal.classList.add('hidden');
        fetchRates(currentSku);
    } else {
        alert(res.message);
    }
};

// Export
document.getElementById('exportCsvBtn').onclick = () => {
    if (currentSku) window.open(`${api.baseUrl}?action=export_rates&sku=${currentSku}`, '_blank');
};

// Log Rate UI
document.getElementById('logRateBtn').onclick = () => {
    document.getElementById('logRateForm').reset();
    logRateModal.classList.remove('hidden');
};
document.getElementById('closeLogModal').onclick = () => logRateModal.classList.add('hidden');

document.getElementById('logRateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;

    const payload = {
        sku: currentSku,
        segment_id: document.getElementById('logSegment').value,
        factory_id: document.getElementById('logFactory').value,
        price: document.getElementById('logPrice').value,
        note: document.getElementById('logNote').value
    };

    try {
        const res = await api.post('log_rate', payload);
        if (res.success) {
            logRateModal.classList.add('hidden');
            fetchRates(currentSku);

            // WhatsApp Notification
            const factoryId = document.getElementById('logFactory').value;
            const factory = masterData.factories.find(f => f.factory_id == factoryId);

            const segmentId = document.getElementById('logSegment').value;
            const segment = masterData.segments.find(s => s.segment_id == segmentId);
            const segmentName = segment ? segment.name : '';

            const price = document.getElementById('logPrice').value;
            const today = new Date().toLocaleDateString('en-IN');

            const message = `*${segmentName} Rate*\n----------------\nSKU: ${currentSku}\nNew Price: ₹${price}\nDate: ${today}`;
            const encodedMsg = encodeURIComponent(message);

            let waUrl = `https://api.whatsapp.com/send?text=${encodedMsg}`;
            if (factory && factory.contact_info) {
                // Clean up phone number (remove spaces, dashes)
                const phone = factory.contact_info.replace(/\D/g, '');
                if (phone.length >= 10) {
                    waUrl = `https://wa.me/${phone}?text=${encodedMsg}`;
                }
            }

            // Open in new tab
            window.open(waUrl, '_blank');

        } else {
            alert(res.message);
        }
    } catch (err) { console.error(err); }
    finally { btn.disabled = false; }
});


// Master Data Management
async function fetchMasterData(force = false) {
    if (masterDataLoaded && !force) return;

    const res = await api.get('get_master_data');
    if (res.success) {
        masterDataLoaded = true;
        masterData = res;
        populateSelect('logSegment', res.segments, 'segment_id', 'Select Segment...');
        populateSelect('logFactory', res.factories, 'factory_id', 'Select Factory...');
        populateSelect('filterSegment', res.segments, 'segment_id', 'All segments');
        populateSelect('filterFactory', res.factories, 'factory_id', 'All factories');

        // Populate Fabric Dropdowns (By Name, not ID, to maintain string storage)
        const fabricDrops = document.querySelectorAll('.fabric-dropdown');
        fabricDrops.forEach(el => {
            const currentVal = el.value; // Store current if any
            el.innerHTML = '<option value="">Select Fabric...</option>';
            (res.fabrics || []).forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.name; // Use Name as value
                opt.textContent = f.name;
                el.appendChild(opt);
            });
            if (currentVal) el.value = currentVal;
        });
    }
}

function populateSelect(id, items, valKey, defaultText = 'Select...') {
    const el = document.getElementById(id);
    el.innerHTML = `<option value="">${defaultText}</option>`;
    items.forEach(i => {
        const opt = document.createElement('option');
        opt.value = i[valKey];
        opt.textContent = i.name;
        el.appendChild(opt);
    });
}

// Master Data Modals
let masterType = ''; // 'segment' or 'factory'
const openMaster = (type) => {
    masterType = type;
    document.getElementById('createMasterTitle').textContent = `Create New ${type === 'segment' ? 'Segment' : 'Factory'}`;
    document.getElementById('createMasterName').value = '';
    document.getElementById('createMasterContact').value = '';
    document.getElementById('contactInfoGroup').classList.toggle('hidden', type === 'segment');
    createMasterModal.classList.remove('hidden');
};

document.getElementById('addSegmentLink').onclick = () => openMaster('segment');
document.getElementById('addFactoryLink').onclick = () => openMaster('factory');
// Main buttons on page top
// document.getElementById('manageSegmentsBtn').onclick = () => openMaster('segment');
// document.getElementById('manageFactoriesBtn').onclick = () => openMaster('factory');

const closeMasterModalBtn = document.getElementById('closeMasterModal');
if (closeMasterModalBtn) {
    closeMasterModalBtn.onclick = () => createMasterModal.classList.add('hidden');
}

document.getElementById('createMasterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('createMasterName').value;
    const contact = document.getElementById('createMasterContact').value;

    const endpoint = masterType === 'segment' ? 'manage_segment' : 'manage_factory';
    const body = { sub_action: 'create', name };
    if (masterType === 'factory') body.contact_info = contact;

    const res = await api.post(endpoint, body);
    if (res.success) {
        createMasterModal.classList.add('hidden');
        fetchMasterData(true); // refresh dropdowns
    } else {
        alert(res.message);
    }
});

function renderInvBox(label, value, isTotal = false) {
    const box = document.createElement('div');
    const val = Number(value);

    let colorClass;
    if (isTotal) {
        colorClass = 'bg-blue-50 border-blue-200 text-blue-800 col-span-full mt-2 sm:mt-0 sm:col-auto'; // Mobile: full width next row
    } else {
        // Red for 0, White/Normal for > 0
        colorClass = val > 0 ? 'bg-white border-gray-200 text-gray-800' : 'bg-red-50 border-red-100 text-red-500';
    }

    box.className = `${colorClass} border rounded-lg p-2 text-center shadow-sm`;
    box.innerHTML = `
        <p class="text-[10px] uppercase font-bold text-gray-400 mb-0.5">${label}</p>
        <p class="text-sm font-bold">${val}</p>
    `;
    document.getElementById('inventoryGrid').appendChild(box);
}

// Stats & Tabs Logic
// Stats & Tabs Logic
// Stats & Tabs Logic
// Stats & Tabs Logic
function switchTab(tab) {
    const ratesTab = document.getElementById('rates-tab');
    const costingTab = document.getElementById('costing-tab');
    const notesTab = document.getElementById('notes-tab');

    const ratesView = document.getElementById('skuRateView');
    const costingView = document.getElementById('skuCostingView');
    const notesView = document.getElementById('skuNotesView');

    // Helper to reset - Remove active pill styles, add inactive text color
    [ratesTab, costingTab, notesTab].forEach(t => {
        if (t) {
            t.classList.remove('active-tab', 'bg-slate-700', '!text-white', 'shadow-md');
            t.classList.add('text-gray-500');
        }
    });

    [ratesView, costingView, notesView].forEach(v => {
        if (v) v.classList.add('hidden');
    });

    // Helper to activate
    const activate = (t, v) => {
        t.classList.add('active-tab', 'bg-slate-700', '!text-white', 'shadow-md');
        t.classList.remove('text-gray-500');
        v.classList.remove('hidden');
    };

    if (tab === 'rates') {
        activate(ratesTab, ratesView);
    } else if (tab === 'costing') {
        activate(costingTab, costingView);
    } else if (tab === 'notes') {
        activate(notesTab, notesView);
    }
}

document.getElementById('rates-tab').addEventListener('click', () => switchTab('rates'));
document.getElementById('costing-tab').addEventListener('click', () => switchTab('costing'));
if (document.getElementById('notes-tab')) document.getElementById('notes-tab').addEventListener('click', () => switchTab('notes'));

// Costing Logic
// const costingForm = document.getElementById('costingForm'); // Moved to top
const costInputs = document.querySelectorAll('.cost-input');

costInputs.forEach(input => {
    input.addEventListener('input', calculateCosting);
});

function calculateCosting() {
    const fd = new FormData(costingForm);

    // Helpers
    const getVal = (name) => Number(fd.get(name) || 0);
    const setVal = (name, val) => {
        const el = costingForm.querySelector(`[name="${name}"]`);
        if (el) el.value = val.toFixed(2);

        // Update summary total
        const summaryId = `summary_${name}`;
        const summaryEl = document.getElementById(summaryId);
        if (summaryEl) {
            summaryEl.textContent = val.toFixed(2);
            if (val > 0) {
                summaryEl.classList.remove('text-gray-500', 'bg-gray-100');
                summaryEl.classList.add('text-indigo-600', 'bg-indigo-100');
            } else {
                summaryEl.classList.add('text-gray-500', 'bg-gray-100');
                summaryEl.classList.remove('text-indigo-600', 'bg-indigo-100');
            }
        }
    };

    // Calculate generic section with Cut * Rate + Shortage
    const calcFabric = (prefix, ignoreCut = false) => {
        const cut = getVal(`${prefix}_cut`);
        const rate = getVal(`${prefix}_rate`);
        const shortage = getVal(`${prefix}_shortage`);
        let base = ignoreCut ? rate : (cut * rate);

        let total = base;
        if (shortage > 0 && shortage < 100) {
            total = base / ((100 - shortage) / 100);
        } else if (shortage >= 100) {
            // Avoid division by zero or negative
            total = base;
        }

        total = Math.ceil(total);
        setVal(`${prefix}_total`, total);
        return total;
    };

    // Calculate service section with Rate + Markup
    const calcService = (prefix) => {
        const rate = getVal(`${prefix}_rate`);
        const markup = getVal(`${prefix}_markup`);

        let total = rate;
        if (markup > 0 && markup < 100) {
            total = rate / ((100 - markup) / 100);
        }

        total = Math.ceil(total);
        setVal(`${prefix}_total`, total);
        return total;
    };

    // 1. Top+Bottom Exclusivity Logic
    // If Top+Bottom has any inputs, we use that and disable Top & Bottom
    // Actually, let's look at the result. If Top+Bottom (Combined) > 0, we prioritize it.
    // Or better: inputs triggers.

    // We calculate "Top+Bottom" first
    const tbTotal = calcFabric('top_bottom');

    const topInputDiv = document.getElementById('detailsTop');
    const bottomInputDiv = document.getElementById('detailsBottom');

    let topTotal = 0;
    let bottomTotal = 0;

    // Logic: If Top+Bottom Cut or Rate is Entered, disable separate Top/Bottom
    const tbCut = getVal('top_bottom_cut');
    const tbRate = getVal('top_bottom_rate');
    const isTbActive = (tbCut > 0 || tbRate > 0);

    if (isTbActive) {
        // Disable separate sections
        if (topInputDiv) {
            topInputDiv.classList.add('opacity-50', 'pointer-events-none');
            // Clear values internally for calculation (visuals remain but ignored in grand total)
        }
        if (bottomInputDiv) {
            bottomInputDiv.classList.add('opacity-50', 'pointer-events-none');
        }
    } else {
        // Enable separate sections
        if (topInputDiv) topInputDiv.classList.remove('opacity-50', 'pointer-events-none');
        if (bottomInputDiv) bottomInputDiv.classList.remove('opacity-50', 'pointer-events-none');

        // Calculate Only if enabled
        topTotal = calcFabric('top');
        bottomTotal = calcFabric('bottom');
    }

    // Other Fabrics
    const dupTotal = calcFabric('dupatta');
    const astarTotal = calcFabric('astar');
    const embTotal = calcFabric('embroidery', true);
    const dpTotal = calcFabric('digital_print');
    const dpDupTotal = calcFabric('digital_print_dupatta');

    // Services
    const stitchTotal = calcService('stitching');
    const dyingTotal = calcService('dying');
    const knitTotal = calcService('knit');
    const pressTotal = calcService('press');

    // Misc
    const ops = getVal('operational_cost');
    const extra = getVal('extra_cost');

    // Update Misc Summary
    const miscTotal = ops + extra;
    const miscSummary = document.getElementById('summary_misc_total');
    if (miscSummary) {
        miscSummary.textContent = miscTotal.toFixed(2);
        if (miscTotal > 0) {
            miscSummary.classList.remove('text-gray-500', 'bg-gray-100');
            miscSummary.classList.add('text-indigo-600', 'bg-indigo-100');
        } else {
            miscSummary.classList.add('text-gray-500', 'bg-gray-100');
            miscSummary.classList.remove('text-indigo-600', 'bg-indigo-100');
        }
    }

    // Grand Total
    // If TB active, use TB. Else use Top + Bottom.
    let baseCost = 0;
    if (isTbActive) {
        baseCost += tbTotal;
    } else {
        baseCost += topTotal + bottomTotal;
    }

    baseCost += dupTotal + astarTotal + embTotal + dpTotal + dpDupTotal + stitchTotal + dyingTotal + knitTotal + pressTotal;

    // Apply Global Markup to Base Cost ONLY
    const finalMarkup = getVal('final_markup');
    let markedUpCost = baseCost;
    if (finalMarkup > 0 && finalMarkup < 100) {
        markedUpCost = baseCost / ((100 - finalMarkup) / 100);
    }

    // Add Misc (Ops + Extra) AFTER markup
    let grand = markedUpCost + ops + extra;

    // Final Rounding
    grand = Math.ceil(grand / 5) * 5;

    document.getElementById('grandTotal').value = grand.toFixed(0);
}

async function loadCosting(sku, providedData = null) {
    costingForm.reset();
    // Reset read-onlys
    costingForm.querySelectorAll('[readonly]').forEach(i => i.value = '');

    let data = providedData;
    if (!data) {
        const res = await api.get('get_costing', { sku });
        if (res.success && res.costing) {
            data = res.costing;
        }
    }

    if (data) {
        Object.keys(data).forEach(key => {
            const input = costingForm.querySelector(`[name="${key}"]`);
            if (input) input.value = data[key];
        });
        calculateCosting(); // Ensure totals match
    }
}

document.getElementById('saveCostingBtn').addEventListener('click', async function () {
    this.disabled = true;
    this.textContent = 'Saving...';

    const fd = new FormData(costingForm);
    const body = { sku: currentSku };
    fd.forEach((val, key) => body[key] = val);

    // Ensure totals are included (disabled/readonly inputs might not be in FormData on some browsers depending on submit way, but we are building manually)
    // Actually FormData includes readonly.

    try {
        const res = await api.post('save_costing', body);
        if (res.success) {
            alert('Costing saved successfully!');
        } else {
            alert('Error: ' + res.message);
        }
    } catch (e) {
        console.error(e);
        alert('Save failed');
    } finally {
        this.disabled = false;
        this.textContent = 'Save Costing';
    }
});

// Note Logic
const addNoteForm = document.getElementById('addNoteForm');
if (addNoteForm) {
    addNoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('noteContent').value.trim();
        if (!content) return;

        // Disable button
        const btn = addNoteForm.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Adding...';

        try {
            const res = await api.post('add_note', { sku: currentSku, note: content });
            if (res.success) {
                document.getElementById('noteContent').value = '';
                loadNotes(currentSku);
            } else {
                alert(res.message);
            }
        } catch (e) { console.error(e); alert('Failed to add note'); }
        finally {
            btn.disabled = false;
            btn.textContent = 'Add Note';
        }
    });
}

async function loadNotes(sku) {
    const list = document.getElementById('notesList');
    if (!list) return;

    list.innerHTML = '<p class="text-center text-gray-400 py-8">Loading...</p>';

    try {
        const res = await api.get('get_notes', { sku });
        if (res.success) {
            list.innerHTML = '';
            if (res.notes.length === 0) {
                list.innerHTML = '<p class="text-center text-gray-400 py-8 border border-dashed rounded-lg bg-gray-50">No notes yet for this SKU.</p>';
                return;
            }

            res.notes.forEach(note => {
                const item = document.createElement('div');
                item.className = 'bg-gray-50 p-4 rounded-lg border border-gray-100 group';
                item.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="font-bold text-gray-700 text-sm">${note.created_by_name || 'Unknown'}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400">${note.created_at}</span>
                            ${canEdit() ? `
                                <button onclick="editNote(${note.note_id}, this)" class="text-gray-400 hover:text-indigo-600 transition-colors">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="deleteNote(${note.note_id})" class="text-gray-400 hover:text-red-600 transition-colors">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <p class="text-gray-800 text-sm whitespace-pre-wrap note-text-${note.note_id}">${note.note}</p>
                `;
                list.appendChild(item);
            });
        }
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p class="text-center text-red-400 py-8">Error loading notes</p>';
    }
}

// Edit/Delete Note Actions
window.editNote = function (id, btn) {
    const p = document.querySelector(`.note-text-${id}`);
    if (!p) return;

    const currentText = p.textContent;
    const container = p.parentElement;

    // Switch to edit mode
    container.innerHTML = `
        <div class="mb-2">
            <textarea id="edit-note-${id}" rows="3" class="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 mb-2">${currentText}</textarea>
            <div class="flex justify-end gap-2">
                <button onclick="loadNotes(currentSku)" class="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                <button onclick="saveNoteEdit(${id})" class="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
            </div>
        </div>
    `;
};

window.saveNoteEdit = async function (id) {
    const text = document.getElementById(`edit-note-${id}`).value.trim();
    if (!text) return alert('Note cannot be empty');

    try {
        const res = await api.post('edit_note', { note_id: id, note: text, sku: currentSku });
        if (res.success) {
            loadNotes(currentSku);
        } else {
            alert(res.message);
        }
    } catch (e) { console.error(e); alert('Update failed'); }
};

window.deleteNote = async function (id) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
        const res = await api.post('delete_note', { note_id: id, sku: currentSku });
        if (res.success) {
            loadNotes(currentSku);
        } else {
            alert(res.message);
        }
    } catch (e) { console.error(e); alert('Delete failed'); }
};

