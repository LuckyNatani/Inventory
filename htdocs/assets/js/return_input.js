
// State
let pendingReturns = [];

// DOM Elements
const skuSearch = document.getElementById('skuSearch');
const searchResults = document.getElementById('searchResults');
const returnForm = document.getElementById('returnForm');
const selectedSku = document.getElementById('selectedSku');
const selectedProductType = document.getElementById('selectedProductType');
const selectedSize = document.getElementById('selectedSize');
const sizeContainer = document.getElementById('sizeContainer');
const quantityContainer = document.getElementById('quantityContainer');
const returnQty = document.getElementById('returnQty');
const pendingTableBody = document.getElementById('pendingTableBody');
const pendingCount = document.getElementById('pendingCount');
const submitInventoryBtn = document.getElementById('submitInventoryBtn');

// Config
const API_URL = 'api/inventory.php';

// Debounce Utility
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 1. Search Logic
skuSearch.addEventListener('input', debounce(function (e) {
    const query = e.target.value.trim();
    if (query.length < 2) {
        searchResults.classList.add('hidden');
        return;
    }

    fetch(`${API_URL}?action=list&search=${encodeURIComponent(query)}&limit=10`)
        .then(res => res.json())
        .then(data => {
            renderSearchResults(data.items || []);
        })
        .catch(err => console.error("Search error", err));
}, 300));

function renderSearchResults(items) {
    searchResults.innerHTML = '';
    if (items.length === 0) {
        searchResults.innerHTML = `<div class="p-3 text-gray-500 text-sm text-center">No products found</div>`;
    } else {
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0 flex justify-between items-center transition-colors';

            const isUnitary = item.product_type === 'unitary';
            div.innerHTML = `
                <div>
                    <div class="font-bold text-gray-800 text-sm">${item.sku}</div>
                    <div class="text-xs text-gray-500">${item.category} <span class="text-indigo-400">|</span> ${isUnitary ? 'Unitary' : 'Sized'}</div>
                </div>
                <i class="fas fa-chevron-right text-gray-300 text-xs"></i>
            `;
            div.onclick = () => selectProduct(item);
            searchResults.appendChild(div);
        });
    }
    searchResults.classList.remove('hidden');
}

// Close search on outside click
document.addEventListener('click', (e) => {
    if (!skuSearch.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

// 2. Select Product
function selectProduct(item) {
    selectedSku.value = item.sku;
    selectedProductType.value = item.product_type || 'sized';
    searchResults.classList.add('hidden');
    skuSearch.value = ''; // Clear search

    // Handle Unitary UI
    if (item.product_type === 'unitary') {
        sizeContainer.classList.add('hidden', 'opacity-50', 'pointer-events-none');
        quantityContainer.classList.remove('col-span-1');
        quantityContainer.classList.add('col-span-2');
        selectedSize.value = '';
        selectedSize.removeAttribute('required');
    } else {
        sizeContainer.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
        quantityContainer.classList.add('col-span-1');
        quantityContainer.classList.remove('col-span-2');
        selectedSize.value = ''; // Reset selection
        selectedSize.setAttribute('required', 'true');
    }

    returnQty.value = '';
    returnQty.focus();
}

// 3. Add to List
returnForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const sku = selectedSku.value;
    if (!sku) {
        ui.showToast("Please select a product first", "error");
        return;
    }

    const type = selectedProductType.value;
    const size = type === 'unitary' ? 'unitary' : selectedSize.value;
    const qty = parseInt(returnQty.value);

    // Backend Validation Checks
    if (type !== 'unitary' && !size) {
        ui.showToast("Please select a size for this product", "error");
        return;
    }

    if (!qty || qty <= 0) {
        ui.showToast("Please enter a valid quantity", "error");
        return;
    }

    // Add to internal list
    addReturnItem(sku, type, size, qty);

    // Reset relevant form parts (keep SKU for quick multi-size entry maybe? User said "quickly note down return sku", usually same sku diff sizes is common, but implies new sku per entry. Let's reset SKU to force next search to be safe/clear, or keep it?
    // "User search for existing sku selects size... enters quantity... click on add button" -> If they have same SKU another size, they'd have to search again if I clear. 
    // Let's CLEAR SKU to avoid accidental double entry of wrong product. User "notes down return sku" usually implies picking from pile.
    resetEntryForm();
});

function addReturnItem(sku, type, size, qty) {
    // Check if already exists in list?
    // If exists, merge? 
    // "stores in array on client side only so that he can edit or delete" -> Merging is cleaner UI.
    const existingIndex = pendingReturns.findIndex(i => i.sku === sku && i.size === size);

    if (existingIndex > -1) {
        pendingReturns[existingIndex].qty += qty;
        ui.showToast(`Updated quantity for ${sku} (${size})`, "info");
    } else {
        pendingReturns.push({
            id: Date.now().toString(), // temp id for UI
            sku,
            type,
            size,
            qty
        });
        ui.showToast(`Added ${sku} to list`, "success");
    }

    renderList();
    checkSubmitButton();
}

function resetEntryForm() {
    selectedSku.value = '';
    selectedProductType.value = '';
    selectedSize.value = '';
    returnQty.value = '';
    // Reset UI state to default sized look
    sizeContainer.classList.remove('hidden', 'opacity-50', 'pointer-events-none');
    quantityContainer.classList.add('col-span-1');
    quantityContainer.classList.remove('col-span-2');
    skuSearch.focus();
}

// 4. Render Table
function renderList() {
    pendingTableBody.innerHTML = '';

    if (pendingReturns.length === 0) {
        pendingTableBody.innerHTML = `
            <tr class="text-center text-gray-400 italic">
                <td colspan="4" class="p-8">No items added yet.</td>
            </tr>`;
        pendingCount.textContent = '0';
        return;
    }

    // Sort by most recent? Or SKU?
    // Let's show most recent on top
    const displayList = [...pendingReturns].reverse();

    displayList.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-50 hover:bg-gray-50 transition-colors group';

        const sizeDisplay = item.type === 'unitary'
            ? '<span class="text-gray-400 text-xs italic">Unitary</span>'
            : `<span class="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs uppercase">${item.size}</span>`;

        row.innerHTML = `
            <td class="p-3 font-medium text-gray-800">${item.sku}</td>
            <td class="p-3 text-center">${sizeDisplay}</td>
            <td class="p-3 text-center font-bold text-indigo-600">${item.qty}</td>
            <td class="p-3 text-right">
                <button onclick="deleteItem('${item.id}')" class="text-gray-400 hover:text-red-500 transition-colors p-2" title="Remove">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </td>
        `;
        pendingTableBody.appendChild(row);
    });

    pendingCount.textContent = pendingReturns.length;
}

// 5. Delete Item
window.deleteItem = function (id) {
    pendingReturns = pendingReturns.filter(i => i.id !== id);
    renderList();
    checkSubmitButton();
};

document.getElementById('clearListBtn').addEventListener('click', () => {
    if (confirm("Are you sure you want to clear the entire list?")) {
        pendingReturns = [];
        renderList();
        checkSubmitButton();
    }
});

function checkSubmitButton() {
    submitInventoryBtn.disabled = pendingReturns.length === 0;
}

// 6. Submit to Backend
window.submitInventory = function () {
    if (pendingReturns.length === 0) return;

    if (!confirm(`Are you sure you want to add these ${pendingReturns.length} items to inventory?`)) return;

    submitInventoryBtn.disabled = true;
    submitInventoryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    // Prepare Payload
    // Backend expects: [{ sku, size, quantity }]
    // My list: { id, sku, type, size, qty } -> Map to backend format
    const payload = pendingReturns.map(item => ({
        sku: item.sku,
        size: item.size === 'unitary' ? null : item.size, // Send null or empty for unitary
        quantity: item.qty
    }));

    fetch(`${API_URL}?action=bulk_add_stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                ui.showToast(`Successfully added ${data.updated_count} items to inventory!`, "success");

                // Show errors if any
                if (data.errors && data.errors.length > 0) {
                    // Keep failed items in list?
                    // For now just clear and show alert
                    alert(`Warning: ${data.errors.length} items failed.\nCheck console or audit logs.`);
                    console.error("Bulk Add Errors:", data.errors);
                }

                pendingReturns = [];
                renderList();
            } else {
                ui.showToast(data.error || "Failed to update inventory", "error");
            }
        })
        .catch(err => {
            console.error(err);
            ui.showToast("Network error occurred", "error");
        })
        .finally(() => {
            submitInventoryBtn.disabled = false;
            submitInventoryBtn.innerHTML = '<i class="fas fa-check-circle"></i> Add to Inventory';
            checkSubmitButton(); // Disables it because list is empty
        });
};
