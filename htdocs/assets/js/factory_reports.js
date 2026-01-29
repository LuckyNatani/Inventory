const api = {
    base: 'api/factory_api.php',
    async request(action, params = {}) {
        const url = new URL(this.base, window.location.href);
        url.searchParams.append('action', action);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const res = await fetch(url);
            return await res.json();
        } catch (e) {
            console.error(e);
            return { success: false, message: 'Network error' };
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    loadMasterData();
    setupSkuAutocomplete();
});

let loadedFactories = [];
let loadedSegments = [];

async function loadMasterData() {
    // Reusing the get_master action from manage_master logic if available, 
    // or we can fetch separate like factory_rates.js does.
    // Let's assume factory_rates approach of fetching lists.
    // Actually factory_api doesn't have a single 'get_master' that returns everything public.
    // We'll use 'get_factories' and 'get_segments' actions if they exist, or just use the ones we added for reports?
    // Let's check factory_api.php. It has separate blocks usually.
    // factory_rates.js uses: action='get_segments' and action='get_factories' (usually).

    // We'll try fetching them.
    const fRes = await api.request('get_factories');
    if (fRes.success) {
        loadedFactories = fRes.factories;
        const sel = document.getElementById('factorySelect');
        sel.innerHTML = '<option value="">Choose Factory...</option>';
        loadedFactories.forEach(f => {
            sel.innerHTML += `<option value="${f.factory_id}">${f.name}</option>`;
        });
    }

    const sRes = await api.request('get_segments');
    if (sRes.success) {
        loadedSegments = sRes.segments;
        const sel = document.getElementById('segmentSelect');
        sel.innerHTML = '<option value="">All Segments</option>';
        loadedSegments.forEach(s => {
            sel.innerHTML += `<option value="${s.segment_id}">${s.name}</option>`;
        });
    }
}

function selectReport(type) {
    // Reset view
    document.getElementById('reportFilters').classList.remove('hidden');
    document.getElementById('reportResults').classList.add('hidden');
    document.querySelectorAll('.filter-group').forEach(el => el.classList.add('hidden'));
    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('resultBody').innerHTML = '';

    // Highlight card
    document.querySelectorAll('.report-card').forEach(el => el.classList.remove('ring-2', 'ring-indigo-500', 'bg-white'));
    event.currentTarget.classList.add('ring-2', 'ring-indigo-500', 'bg-white');
    event.currentTarget.classList.remove('bg-gray-50');

    // Show specific filter
    if (type === 'factory_sku') {
        document.getElementById('currentReportTitle').textContent = 'Factory-wise SKU Report';
        document.getElementById('filterFactorySku').classList.remove('hidden');
    } else if (type === 'factory_dependency') {
        document.getElementById('currentReportTitle').textContent = 'Factory Dependency Risk Report';
        document.getElementById('filterDependency').classList.remove('hidden');
    } else if (type === 'rate_history') {
        document.getElementById('currentReportTitle').textContent = 'SKU Rate History Report';
        document.getElementById('filterRateHistory').classList.remove('hidden');
    }
}

async function runFactorySkuReport() {
    const factoryId = document.getElementById('factorySelect').value;
    if (!factoryId) return alert('Please select a factory');

    const res = await api.request('report_factory_skus', { factory_id: factoryId });
    if (res.success) {
        renderTable(res.data, ['SKU', 'Segments Worked', 'Latest Rate', 'Last Worked Date']);
    } else {
        alert(res.message);
    }
}

async function runDependencyReport() {
    const res = await api.request('report_dependency');
    if (res.success) {
        renderTable(res.data, ['SKU', 'Dependent Factory', 'Total Logs']);
    } else {
        alert(res.message);
    }
}

async function runRateHistoryReport() {
    const sku = document.getElementById('historySkuInput').value;
    const segmentId = document.getElementById('segmentSelect').value;

    if (!sku) return alert('Please enter a SKU');

    const res = await api.request('report_rate_history', { sku, segment_id: segmentId });
    if (res.success) {
        renderTable(res.data, ['Date', 'Factory', 'Segment', 'Price', 'Note', 'User']);
    } else {
        alert(res.message);
    }
}

function renderTable(data, headers) {
    const results = document.getElementById('reportResults');
    const thead = document.getElementById('resultHeaderRow');
    const tbody = document.getElementById('resultBody');
    const empty = document.getElementById('emptyState');

    results.classList.remove('hidden');

    // Set headers
    thead.innerHTML = headers.map(h => `<th class="px-6 py-3 font-medium text-gray-900 whitespace-nowrap">${h}</th>`).join('');

    // Set body
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    data.forEach(row => {
        let tds = '';
        // Map object values based on order or specific keys if we know them. 
        // Ideally the API should return keyed objects and we map strictly, but for generic table render:
        // We'll rely on object inclusion order OR specific handling.
        // Let's rely on flexible row rendering for now, assuming API returns array of objects with keys matching header concepts.
        // Or we strictly map based on known fields from API.

        // Strategy: We pass specific render logic in the run functions? No, let's keep it simple.
        // Just Object.values? No, key order isn't guaranteed.
        // Improve: Let's explicitly build rows in the specific functions, then call a `drawTable(html)` helper.
        // Refactoring run functions below... see updated block.
    });
}

// Redefine run functions to handle rendering explicitly
const drawTable = (html, headers) => {
    document.getElementById('resultHeaderRow').innerHTML = headers.map(h => `<th class="px-6 py-3 font-medium text-gray-900 whitespace-nowrap">${h}</th>`).join('');
    document.getElementById('resultBody').innerHTML = html;
    document.getElementById('reportResults').classList.remove('hidden');
    if (!html) document.getElementById('emptyState').classList.remove('hidden');
    else document.getElementById('emptyState').classList.add('hidden');
};

// Overwrite run functions with Render Logic
runFactorySkuReport = async () => {
    const factoryId = document.getElementById('factorySelect').value;
    if (!factoryId) return alert('Please select a factory');

    const container = document.getElementById('resultBody');
    container.innerHTML = '<tr><td colspan="4" class="text-center py-4">Loading...</td></tr>';
    document.getElementById('reportResults').classList.remove('hidden');

    const res = await api.request('report_factory_skus', { factory_id: factoryId });
    if (res.success) {
        if (res.data.length === 0) {
            drawTable('', ['SKU', 'Segments', 'Latest Rate', 'Last Date']);
            return;
        }
        const html = res.data.map(row => `
            <tr class="hover:bg-gray-50 border-b last:border-0 transition-colors">
                <td class="px-6 py-4 font-medium text-gray-900">${row.sku}</td>
                <td class="px-6 py-4">${row.segments}</td>
                <td class="px-6 py-4 font-bold text-indigo-600">₹${row.price}</td>
                <td class="px-6 py-4 text-xs text-gray-700">${row.last_date}</td>
            </tr>
        `).join('');
        drawTable(html, ['SKU', 'Segments', 'Latest Rate', 'Last Date']);
    }
};

runDependencyReport = async () => {
    const container = document.getElementById('resultBody');
    container.innerHTML = '<tr><td colspan="3" class="text-center py-4">Loading...</td></tr>';
    document.getElementById('reportResults').classList.remove('hidden');

    const res = await api.request('report_dependency');
    if (res.success) {
        if (res.data.length === 0) {
            drawTable('', ['SKU', 'Dependent Factory', 'Total Logs']);
            return;
        }
        const html = res.data.map(row => `
            <tr class="hover:bg-rose-50 border-b last:border-0 transition-colors bg-rose-50/10">
                <td class="px-6 py-4 font-medium text-gray-900">${row.sku}</td>
                <td class="px-6 py-4 font-bold text-rose-600">${row.factory_name}</td>
                <td class="px-6 py-4">${row.log_count}</td>
            </tr>
        `).join('');
        drawTable(html, ['SKU', 'Dependent Factory', 'Total Logs']);
    }
};

runRateHistoryReport = async () => {
    const sku = document.getElementById('historySkuInput').value;
    const segmentId = document.getElementById('segmentSelect').value;
    if (!sku) return alert('Please enter a SKU');

    const container = document.getElementById('resultBody');
    container.innerHTML = '<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>';
    document.getElementById('reportResults').classList.remove('hidden');

    const res = await api.request('report_rate_history', { sku, segment_id: segmentId });
    if (res.success) {
        if (res.data.length === 0) {
            drawTable('', ['Date', 'Factory', 'Segment', 'Price', 'Note', 'User']);
            return;
        }
        const html = res.data.map(row => `
            <tr class="hover:bg-gray-50 border-b last:border-0 transition-colors">
                <td class="px-6 py-4 text-xs text-gray-700 whitespace-nowrap">${row.created_at}</td>
                <td class="px-6 py-4 font-medium text-gray-900">${row.factory_name}</td>
                <td class="px-6 py-4"><span class="px-2 py-1 rounded bg-gray-100 text-xs">${row.segment_name}</span></td>
                <td class="px-6 py-4 font-bold text-gray-800">₹${row.price}</td>
                <td class="px-6 py-4 text-xs italic text-gray-700">${row.note || '-'}</td>
                <td class="px-6 py-4 text-xs text-gray-600">${row.created_by_name}</td>
            </tr>
        `).join('');
        drawTable(html, ['Date', 'Factory', 'Segment', 'Price', 'Note', 'User']);
    }
};

// Autocomplete from factory_rates.js logic
function setupSkuAutocomplete() {
    const input = document.getElementById('historySkuInput');
    const resultsDiv = document.getElementById('skuSuggestions');
    let timeout = null;

    input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const term = e.target.value.trim();
        if (term.length < 2) {
            resultsDiv.classList.add('hidden');
            return;
        }
        timeout = setTimeout(async () => {
            const res = await api.request('search_sku', { term });
            if (res.success && res.results.length > 0) {
                resultsDiv.innerHTML = res.results.map(sku =>
                    `<div class="p-2 hover:bg-gray-100 cursor-pointer text-sm" onclick="selectSkuSuggest('${sku}')">${sku}</div>`
                ).join('');
                resultsDiv.classList.remove('hidden');
            } else {
                resultsDiv.classList.add('hidden');
            }
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !resultsDiv.contains(e.target)) {
            resultsDiv.classList.add('hidden');
        }
    });
}

function selectSkuSuggest(sku) {
    document.getElementById('historySkuInput').value = sku;
    document.getElementById('skuSuggestions').classList.add('hidden');
    runRateHistoryReport();
}
