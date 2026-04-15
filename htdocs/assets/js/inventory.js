// Updated inventory.js with shared components integration

const apiUrl = 'api/inventory.php';
let currentPage = 1;
let currentCategory = 'all';
let currentSearch = '';
let currentStock = '';
let currentRack = '';
let currentSort = 'sku';
let editingId = null;
const limit = 100; // Updated to 100
const userRole = localStorage.getItem('role') || '';

function currentFilters() {
  return {
    search: currentSearch,
    category: currentCategory,
    stock: currentStock,
    rack_location: currentRack,
    sort: currentSort
  };
}

function parseStockInput(raw) {
  const str = String(raw || '').trim();
  if (str === '') return '';

  // Simple number: "10"
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Expression: "10+5" or "10 - 3" or "0+5"
  const match = str.match(/^(\d+)\s*([+-])\s*(\d+)$/);
  if (match) {
    const base = parseInt(match[1], 10);
    const op = match[2];
    const delta = parseInt(match[3], 10);
    const result = op === '+' ? base + delta : base - delta;
    return result < 0 ? 0 : result; // avoid negative stock
  }

  // Plain relative like "+5" or "-3" will be handled elsewhere (needs original)
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
}
function finalizeSizeInput(input) {
  const raw = (input.value || '').trim();

  // If user typed "+5" or "-3" and we have an original value stored
  if (/^[+-]\d+$/.test(raw) && input.dataset.original !== undefined) {
    const old = parseInt(input.dataset.original || '0', 10) || 0;
    const delta = parseInt(raw, 10);
    input.value = String(Math.max(0, old + delta));
    return;
  }

  // If user typed "10+5" etc. parseStockInput handles that
  const final = parseStockInput(raw);
  input.value = String(final);
}

// Global function for Product Type Toggle
window.toggleProductType = function (type) {
  const sizedInputs = document.getElementById('sized_inputs');
  const unitaryInputs = document.getElementById('unitary_inputs');

  if (type === 'sized') {
    sizedInputs.classList.remove('hidden');
    unitaryInputs.classList.add('hidden');
  } else {
    sizedInputs.classList.add('hidden');
    unitaryInputs.classList.remove('hidden');
  }
};



function getLinkIcon(url, type) {
  if (!url) return '';

  const icons = {
    myntra: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Myntra_Logo.png', // Fallback or use text
    amazon: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Amazon_icon.svg',
    flipkart: 'https://upload.wikimedia.org/wikipedia/en/7/7a/Flipkart_logo.svg',
    ajio: 'https://assets.ajio.com/static/img/Ajio-Logo.svg',
    snapdeal: 'https://upload.wikimedia.org/wikipedia/commons/c/c6/Snapdeal_Logo.svg'
  };

  // Safe fallback to initials if generic
  let inner = '';
  if (type === 'myntra') inner = `<img src="https://upload.wikimedia.org/wikipedia/commons/b/bc/Myntra_Logo.png" class="w-4 h-4 object-contain" title="Myntra" onerror="this.style.display='none'"/>`;
  else if (type === 'amazon') inner = `<i class="fab fa-amazon text-yellow-600 text-lg" title="Amazon"></i>`;
  else if (type === 'flipkart') inner = `<img src="https://upload.wikimedia.org/wikipedia/en/7/7a/Flipkart_logo.svg" class="w-4 h-4 object-contain" title="Flipkart" onerror="this.style.display='none'"/>`;
  else if (type === 'ajio') inner = `<span class="bg-gray-800 text-white text-[10px] font-bold px-1 rounded" title="Ajio">A</span>`;
  else if (type === 'snapdeal') inner = `<span class="bg-red-600 text-white text-[10px] font-bold px-1 rounded" title="Snapdeal">S</span>`;
  else inner = `<i class="fas fa-link text-gray-400"></i>`;

  // Refined Logic
  if (type === 'myntra') inner = `<span class="w-5 h-5 flex items-center justify-center bg-pink-100 rounded-full"><img src="https://cdn.iconscout.com/icon/free/png-256/free-myntra-logo-icon-download-in-svg-png-gif-file-formats--shopping-brand-online-application-app-mobile-indian-companies-pack-logos-icons-2249158.png" class="w-3 h-3" alt="M"></span>`;
  if (type === 'amazon') inner = `<span class="w-5 h-5 flex items-center justify-center bg-yellow-100 rounded-full text-yellow-700 text-xs"><i class="fab fa-amazon"></i></span>`;
  if (type === 'flipkart') inner = `<span class="w-5 h-5 flex items-center justify-center bg-blue-100 rounded-full text-blue-600 font-bold text-[10px]">F</span>`;
  if (type === 'ajio') inner = `<span class="w-5 h-5 flex items-center justify-center bg-gray-800 rounded-full text-white font-bold text-[10px]">A</span>`;
  if (type === 'snapdeal') inner = `<span class="w-5 h-5 flex items-center justify-center bg-red-100 rounded-full text-red-600 font-bold text-[10px]">S</span>`;

  return `<a href="${url}" target="_blank" class="hover:opacity-75 transition-opacity" title="${type}">${inner}</a>`;
}

function fetchInventory(filters = {}) {
  const params = new URLSearchParams();
  params.append('action', 'list');
  params.append('page', currentPage);
  params.append('limit', limit);

  if (filters.search) params.append('search', filters.search);
  if (filters.category) params.append('category', filters.category);
  if (filters.stock) params.append('stock', filters.stock);
  if (filters.rack_location) params.append('rack_location', filters.rack_location);
  if (filters.sort) params.append('sort', filters.sort);

  // Use localized spinner for inventory table
  ui.showElementLoading('#inventoryTableContainer');

  fetch(`${apiUrl}?${params.toString()}`, { skipGlobalSpinner: true })
    .then(res => {
      if (res.status === 401) {
        alert("Session expired. Please login again.");
        window.location.href = '/login.html';
        throw new Error("Unauthorized");
      }
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      renderInventory(data);
    })
    .catch(err => {
      console.error("Fetch inventory error:", err);
      const tbody = document.getElementById('inventoryTableBody');
      tbody.innerHTML = `<tr><td colspan="11" class="text-center p-4 text-red-600">Failed to load inventory. Refresh the page.</td></tr>`;
    })
    .finally(() => {
      ui.hideElementLoading('#inventoryTableContainer');
      if (userRole === 'admin') {
        fetchAdminStats();
      }
    });
}

function fetchAdminStats() {
  fetch(`${apiUrl}?action=category_stats`)
    .then(res => res.json())
    .then(data => {
      if (data.qty) {
        window.categoryQtyStats = data.qty;
        let totalQ = data.qty.reduce((sum, item) => sum + parseInt(item.total_qty || 0), 0);
        document.getElementById('totalQtyCount').textContent = totalQ.toLocaleString();
        document.getElementById('statTotalQty').classList.remove('hidden');
      }
      if (data.value) {
        window.categoryValueStats = data.value;
        let totalV = data.value.reduce((sum, item) => sum + parseFloat(item.total_value || 0), 0);
        document.getElementById('totalValueCount').textContent = '₹' + totalV.toLocaleString(undefined, { maximumFractionDigits: 0 });
        document.getElementById('statTotalValue').classList.remove('hidden');
      }
    })
    .catch(console.error);
}

function openCategoryQtyModal() {
  const list = document.getElementById('categoryQtyList');
  list.innerHTML = '';
  if (window.categoryQtyStats) {
    window.categoryQtyStats.forEach(item => {
      list.innerHTML += `<tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-800">${item.category}</td>
                <td class="px-4 py-3 text-right text-indigo-600 font-bold">${parseInt(item.total_qty).toLocaleString()}</td>
            </tr>`;
    });
  }
  document.getElementById('categoryQtyModal').classList.remove('hidden');
}

function openCategoryValueModal() {
  const list = document.getElementById('categoryValueList');
  list.innerHTML = '';
  if (window.categoryValueStats) {
    window.categoryValueStats.forEach(item => {
      list.innerHTML += `<tr class="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-800">${item.category}</td>
                <td class="px-4 py-3 text-right text-green-600 font-bold">₹${parseFloat(item.total_value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            </tr>`;
    });
  }
  document.getElementById('categoryValueModal').classList.remove('hidden');
}

function renderInventory(data) {
  const tbody = document.getElementById('inventoryTableBody');
  tbody.innerHTML = '';

  const baseImgUrl = data.image_base_url || ((typeof CONFIG !== 'undefined' && CONFIG.IMAGE_BASE_URL) ? CONFIG.IMAGE_BASE_URL : "assets/images/products/");

  if (data.items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" class="text-center p-8 text-gray-500">No items found matching your criteria.</td></tr>';
  } else {
    data.items.forEach(item => {
      // Dynamic Image URL Construction
      // We use item.img1 if available, otherwise fallback to encoded SKU
      const imgPath = item.img1 || encodeURIComponent(item.sku || '').replace(/%20/g, '%2520');
      const fullImgUrl = `${baseImgUrl}${imgPath}.webp`;

      const isUnitary = item.product_type === 'unitary';
      const totalQty = isUnitary ? (item.quantity || 0) : (Number(item.xs || 0) + Number(item.s || 0) + Number(item.m || 0) + Number(item.l || 0) + Number(item.xl || 0) + Number(item.xxl || 0) + Number(item.xxxl || 0));

      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50 transition-colors';
      row.innerHTML = `
          <td class="sticky left-0 z-10 bg-white border-r border-gray-100 px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-xs md:text-base text-gray-800 font-medium shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
            ${item.sku || '-'} <span class="text-[10px] text-gray-400 block">${isUnitary ? '(Unitary)' : ''}</span>

          </td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center">
            <div class="grid grid-cols-3 gap-2 w-fit mx-auto">
                ${(item.live_links || '').split(',').map(url => {
        url = url.trim();
        if (!url) return '';
        let type = 'link';
        if (url.includes('myntra')) type = 'myntra';
        else if (url.includes('amazon')) type = 'amazon';
        else if (url.includes('flipkart')) type = 'flipkart';
        else if (url.includes('ajio')) type = 'ajio';
        else if (url.includes('snapdeal')) type = 'snapdeal';
        return getLinkIcon(url, type);
      }).join('')}
            </div>
          </td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base text-gray-600">
            ${(item.rack_location || '-').split(',').map(loc =>
        `<span class="bg-gray-100 px-1 py-0.5 md:px-2 md:py-1 rounded inline-block m-0.5 text-[10px] md:text-sm border border-gray-200">${loc.trim()}</span>`
      ).join('')}
          </td>
          ${isUnitary ?
          `<td colspan="7" class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base text-gray-400 italic">N/A</td>` :
          `<td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base ${formatSize(item.xs, item.min_stock_alert).cls}">${formatSize(item.xs, item.min_stock_alert).text}</td>
             <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base ${formatSize(item.s, item.min_stock_alert).cls}">${formatSize(item.s, item.min_stock_alert).text}</td>
             <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base ${formatSize(item.m, item.min_stock_alert).cls}">${formatSize(item.m, item.min_stock_alert).text}</td>
             <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base ${formatSize(item.l, item.min_stock_alert).cls}">${formatSize(item.l, item.min_stock_alert).text}</td>
             <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base ${formatSize(item.xl, item.min_stock_alert).cls}">${formatSize(item.xl, item.min_stock_alert).text}</td>
             <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base ${formatSize(item.xxl, item.min_stock_alert).cls}">${formatSize(item.xxl, item.min_stock_alert).text}</td>
             <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base ${formatSize(item.xxxl, item.min_stock_alert).cls}">${formatSize(item.xxxl, item.min_stock_alert).text}</td>`
        }
          <td class="px-1 py-2 md:px-3 md:py-4 text-center font-bold text-gray-700 bg-gray-50 text-xs md:text-base">${totalQty}</td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base text-gray-600" data-role="admin,production">
              <div class="flex items-center justify-center gap-1 group">
                 <span>${item.cost_price ? Number(item.cost_price).toFixed(0) : '-'}</span>
                 ${item.cost_price ? `<i class="fas fa-history text-xs text-indigo-300 hover:text-indigo-600 cursor-pointer transition-colors" onclick="openCostPriceHistory('${item.sku}')" title="View Cost History"></i>` : ''}
              </div>
          </td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base text-gray-600" data-role="admin,production">${item.cost_price ? '-' : (item.purchase_cost ? Number(item.purchase_cost).toFixed(2) : '-')}</td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base text-gray-600 font-medium" data-role="admin">${(item.cost_price || item.purchase_cost) ? '₹' + Math.round(totalQty * Number(item.cost_price || item.purchase_cost)).toLocaleString() : '-'}</td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-base font-medium ${item.sold_30d > 0 ? 'text-indigo-600 font-bold' : 'text-gray-400'}">
              ${Number(item.sold_30d) > 0 ? Number(item.sold_30d).toLocaleString() : '-'}
          </td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center">
            <img src="${fullImgUrl}" onerror="this.src='fallback.jpg'" class="w-8 h-8 md:w-10 md:h-10 object-cover rounded cursor-pointer preview-img shadow-sm hover:scale-110 transition-transform" data-src="${fullImgUrl}" />
          </td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center text-[10px] md:text-sm text-gray-500">${item.updated_at ? formatTimestamp(item.updated_at) : '-'}</td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center text-[10px] md:text-sm text-gray-500">${item.updated_by_name || item.updated_by || '-'}</td>
          <td class="px-1 py-2 md:px-3 md:py-4 text-center text-xs md:text-sm">
             <button class="text-blue-500 hover:text-blue-700 hover:underline" onclick="openHistoryModal('${item.sku}')">Show</button>
          </td>
          <td class="px-2 py-2 md:px-6 md:py-4 text-right">
            <button class="text-indigo-600 hover:text-indigo-900 edit-btn p-1 md:p-2 rounded hover:bg-indigo-50 transition-colors" data-role="stocker,admin,sub-admin,production" data-id="${item.id}"><i class="fas fa-edit"></i></button>
          </td>
        `;
      tbody.appendChild(row);
    });
  }

  document.getElementById('totalProducts').textContent = data.stats.total;
  document.getElementById('lowStockCount').textContent = data.stats.low;
  document.getElementById('zeroStockCount').textContent = data.stats.zero;
  document.getElementById('activeStockCount').textContent = data.stats.active || 0;
  // New Stats
  if (document.getElementById('slowStockCount')) document.getElementById('slowStockCount').textContent = data.stats.slow || 0;
  if (document.getElementById('deadStockCount')) document.getElementById('deadStockCount').textContent = data.stats.dead || 0;

  setupPagination(data.total);
  controlUIByRole();
  highlightActiveCard();
}

// ...existing code...

// --- Event Listeners and Fixes ---


// Filter Cards Logic
const cardMap = {
  'statActiveStock': 'active',
  'statLowStock': 'low',
  'statZeroStock': 'zero',
  'statSlowStock': 'slow',
  'statDeadStock': 'dead',
  'statTotal': ''
};

Object.keys(cardMap).forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', () => {
      currentStock = cardMap[id];
      currentPage = 1;
      fetchInventory(currentFilters());
      highlightActiveCard();
    });
  }
});

function highlightActiveCard() {
  // Styles Map (Accent Colors)
  const styles = {
    'active': { color: 'green', shadow: 'shadow-[0_4px_20px_-2px_rgba(22,163,74,0.2)]' },
    'low': { color: 'amber', shadow: 'shadow-[0_4px_20px_-2px_rgba(217,119,6,0.2)]' },
    'zero': { color: 'red', shadow: 'shadow-[0_4px_20px_-2px_rgba(220,38,38,0.2)]' },
    'slow': { color: 'yellow', shadow: 'shadow-[0_4px_20px_-2px_rgba(202,138,4,0.2)]' },
    'dead': { color: 'gray', shadow: 'shadow-[0_4px_20px_-2px_rgba(75,85,99,0.2)]' },
    'default': { color: 'blue', shadow: 'shadow-[0_4px_20px_-2px_rgba(37,99,235,0.2)]' }
  };

  // Reset all cards
  Object.keys(cardMap).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Reset Card Styles
    el.className = el.className.replace(/\bbg-\w+-50\b/g, 'bg-white'); // Remove tinted bg
    el.classList.remove('border-t-4'); // Remove top border
    // Remove dynamic border colors and shadows
    el.classList.remove('border-green-500', 'border-amber-500', 'border-red-500', 'border-yellow-500', 'border-gray-500', 'border-indigo-500', 'border-blue-500', 'border-slate-500');
    el.classList.remove('border-t-green-500', 'border-t-amber-500', 'border-t-red-500', 'border-t-yellow-500', 'border-t-gray-500', 'border-t-indigo-500', 'border-t-blue-500');
    el.classList.remove('shadow-[0_4px_20px_-2px_rgba(22,163,74,0.2)]', 'shadow-[0_4px_20px_-2px_rgba(217,119,6,0.2)]', 'shadow-[0_4px_20px_-2px_rgba(220,38,38,0.2)]', 'shadow-[0_4px_20px_-2px_rgba(202,138,4,0.2)]', 'shadow-[0_4px_20px_-2px_rgba(75,85,99,0.2)]', 'shadow-[0_4px_20px_-2px_rgba(79,70,229,0.2)]', 'shadow-[0_4px_20px_-2px_rgba(37,99,235,0.2)]', 'shadow-[0_4px_20px_-2px_rgba(100,116,139,0.2)]');
    el.style.transform = '';

    // Add default border back if missing (simplified reset)
    el.classList.add('border', 'border-gray-100');

    // Reset Icon Styles (Find the rounded-full div)
    const iconContainer = el.querySelector('div.rounded-full');
    if (iconContainer) {
      // Reset BG intensity and Text intensity
      // We assume default state is bg-{color}-50 and text-{color}-600
      // Selected state will be bg-{color}-100 and text-{color}-700
      const colorClass = iconContainer.className.match(/text-(\w+)-600/);
      if (colorClass) {
        const color = colorClass[1];
        iconContainer.classList.remove(`bg-${color}-100`, `text-${color}-700`);
        iconContainer.classList.add(`bg-${color}-50`, `text-${color}-600`);
        iconContainer.classList.remove('scale-110');
      }
    }
  });

  // Identify Active Card
  let activeId = 'statTotal';
  let config = styles['default'];

  if (currentStock === 'active') { activeId = 'statActiveStock'; config = styles['active']; }
  else if (currentStock === 'low') { activeId = 'statLowStock'; config = styles['low']; }
  else if (currentStock === 'zero') { activeId = 'statZeroStock'; config = styles['zero']; }
  else if (currentStock === 'slow') { activeId = 'statSlowStock'; config = styles['slow']; }
  else if (currentStock === 'dead') { activeId = 'statDeadStock'; config = styles['dead']; }

  // Apply Active Styles
  const activeEl = document.getElementById(activeId);
  if (activeEl) {
    const c = config.color;

    // Card Container
    activeEl.classList.remove('bg-white', 'border', 'border-gray-100'); // Remove white bg and default border
    activeEl.classList.add(`bg-${c}-50`); // Tinted BG
    activeEl.classList.add('border-t-4', `border-t-${c}-500`); // Top Accent
    // Side borders? Let's keep it clean or add transparent side borders if needed for layout stability. 
    // Usually removing border might shift layout by 1px. To prevent shift, we can use border-transparent.
    activeEl.classList.add('border-x', 'border-b', 'border-transparent');

    activeEl.classList.add(config.shadow); // Soft Glow

    // Icon Boost
    const iconIcon = activeEl.querySelector('div.rounded-full');
    if (iconIcon) {
      // Ideally we match the color of the card for the icon boost
      // The icon might have a different color class in HTML (like statTotal is text-indigo-600)
      // We force the boost on the existing color logic or just use the config color
      iconIcon.classList.remove(`bg-${c}-50`, `text-${c}-600`);
      iconIcon.classList.add(`bg-${c}-100`, `text-${c}-700`, 'scale-110', 'transition-transform', 'duration-300');
    }
  }
}


function formatSize(val, minStock) {
  if (val === null || val === undefined || val === '') return { cls: 'text-gray-300', text: '-' };
  const num = Number(val);
  if (num === 0) return { cls: 'text-red-600 font-bold', text: '0' };
  if (num <= Number(minStock)) return { cls: 'text-yellow-600 font-semibold', text: num };
  return { cls: '', text: num };
}

function setupPagination(total) {
  const totalPages = Math.ceil(total / limit);
  const showingFrom = (currentPage - 1) * limit + 1;
  const showingTo = Math.min(currentPage * limit, total);

  document.getElementById('showing-from').textContent = total === 0 ? 0 : showingFrom;
  document.getElementById('showing-to').textContent = total === 0 ? 0 : showingTo;
  document.getElementById('total-items').textContent = total;

  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  const paginationNumbers = document.getElementById('pagination-numbers');

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      fetchInventory(currentFilters());
    }
  };

  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      fetchInventory(currentFilters());
    }
  };

  // Render Page Numbers
  paginationNumbers.innerHTML = '';

  // Logic to show limited page numbers with ellipsis if needed
  // For simplicity, let's show max 5 pages around current page
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);

  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  if (startPage > 1) {
    addPageButton(1, paginationNumbers);
    if (startPage > 2) {
      const span = document.createElement('span');
      span.className = 'px-2 py-1 text-gray-500';
      span.textContent = '...';
      paginationNumbers.appendChild(span);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    addPageButton(i, paginationNumbers);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const span = document.createElement('span');
      span.className = 'px-2 py-1 text-gray-500';
      span.textContent = '...';
      paginationNumbers.appendChild(span);
    }
    addPageButton(totalPages, paginationNumbers);
  }
}

function addPageButton(page, container) {
  const btn = document.createElement('button');
  btn.textContent = page;
  btn.className = `px-3 py-1 border border-gray-300 rounded-md transition-colors ${page === currentPage
    ? 'bg-indigo-600 text-white border-indigo-600'
    : 'bg-white text-gray-700 hover:bg-gray-50'
    }`;
  btn.onclick = () => {
    if (currentPage !== page) {
      currentPage = page;
      fetchInventory(currentFilters());
    }
  };
  container.appendChild(btn);
}

document.getElementById('sortFilter').addEventListener('change', function (e) {
  currentSort = e.target.value;
  currentPage = 1;
  fetchInventory(currentFilters());
});

document.getElementById('exportDropdown').addEventListener('change', function (e) {
  const type = e.target.value;
  if (!type) return;

  const params = new URLSearchParams();
  params.append('action', 'export');

  if (type === 'visible') {
    if (currentSearch) params.append('search', currentSearch);
    if (currentCategory !== 'all') params.append('category', currentCategory);
    if (currentStock) params.append('stock', currentStock);
    if (currentRack) params.append('rack_location', currentRack);
  }
  // if type === 'all', we pass no extra filters, just action=export

  window.open(`${apiUrl}?${params.toString()}`, '_blank');

  // Reset dropdown
  e.target.value = '';
});

document.getElementById('productForm').addEventListener('submit', function (e) {
  e.preventDefault();
  const saveBtn = this.querySelector('button[type="submit"]');
  saveBtn.disabled = true;
  // finalize size inputs (convert expressions to numbers)
  ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl'].forEach(id => {
    const input = document.getElementById(id);
    if (input) finalizeSizeInput(input);
  });

  const formData = new FormData();
  formData.append('sku', document.getElementById('sku').value);
  formData.append('category', document.getElementById('category').value);
  formData.append('rack_location', document.getElementById('rack_location').value);
  formData.append('xs', document.getElementById('xs').value);
  formData.append('s', document.getElementById('s').value);
  formData.append('m', document.getElementById('m').value);
  formData.append('l', document.getElementById('l').value);
  formData.append('xl', document.getElementById('xl').value);
  formData.append('xxl', document.getElementById('xxl').value);
  formData.append('xxxl', document.getElementById('xxxl').value);
  formData.append('quantity', +document.getElementById('quantity').value);

  const productType = document.querySelector('input[name="product_type"]:checked').value;
  formData.append('product_type', productType);

  formData.append('min_stock_alert', +document.getElementById('min_stock_alert').value);
  formData.append('purchase_cost', document.getElementById('purchase_cost').value);
  formData.append('status', document.getElementById('status').value);
  formData.append('live_links', document.getElementById('live_links').value); // Add this
  formData.append('user_id', localStorage.getItem('userId'));

  // Image
  const fileInput = document.getElementById('imageUpload');
  if (fileInput && fileInput.files[0]) {
    formData.append('image', fileInput.files[0]);
  }

  const url = editingId ? `${apiUrl}?action=update` : `${apiUrl}?action=add`;
  if (editingId) formData.append('editingId', editingId);

  fetch(url, {
    method: 'POST',
    body: formData
  }).then(res => {
    if (res.status === 401) {
      ui.showToast("Session expired. Please login again.", "error");
      window.location.href = '/login.html';
      throw new Error("Unauthorized");
    }
    return res.json().then(data => ({ status: res.status, body: data }));
  })
    .then(({ status, body }) => {
      if (status >= 400 || body.error) {
        ui.showToast(body.error || "An error occurred", "error");
      } else {
        ui.showToast("Product saved successfully!", "success");
        resetForm();
        fetchInventory(currentFilters());
      }
      saveBtn.disabled = false;
    })
    .catch(err => {
      console.error(err);
      ui.showToast("Failed to save product. See console for details.", "error");
      saveBtn.disabled = false;
    });
});

function resetForm() {
  document.getElementById('productForm').reset();
  document.getElementById('cancelEdit').classList.add('hidden');
  document.getElementById('formTitle').textContent = 'Add Product';
  editingId = null;
  const preview = document.getElementById('imagePreview');
  if (preview) {
    preview.src = '';
    preview.classList.add('hidden');
  }
  // Clear tags
  currentTags = [];
  // Clear tags
  currentTags = [];
  renderRackTags();

  // Reset Product Type
  const sizedRadio = document.querySelector('input[name="product_type"][value="sized"]');
  if (sizedRadio) {
    sizedRadio.checked = true;
    toggleProductType('sized');
  }
  document.getElementById('quantity').value = '';

  // Clear Link Tags
  currentLinks = [];
  renderLinkTags();

  // Enable purchase cost by default
  const pcInput = document.getElementById('purchase_cost');
  if (pcInput) {
    pcInput.disabled = false;
    pcInput.title = "";
  }
}

document.getElementById('cancelEdit').onclick = resetForm;

document.getElementById('imageUpload').addEventListener('change', function (e) {
  const preview = document.getElementById('imagePreview');
  const file = e.target.files[0];
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = function (e) {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
    }
    reader.readAsDataURL(file);
  }
});

document.getElementById('inventoryTableBody').addEventListener('click', function (e) {
  const editBtn = e.target.closest('.edit-btn');
  if (editBtn) {
    const id = editBtn.dataset.id;
    fetch(`${apiUrl}?action=get&id=${id}`)
      .then(res => {
        if (res.status === 401) {
          alert("Session expired. Please login again.");
          window.location.href = '/login.html';
          throw new Error("Unauthorized");
        }
        return res.json();
      })
      .then(product => {
        if (!product) return;
        document.getElementById('sku').value = product.sku || '';
        document.getElementById('category').value = product.category;

        // Populate Rack Tags
        currentTags = product.rack_location ? product.rack_location.split(',').map(t => t.trim()).filter(t => t) : [];
        renderRackTags();

        document.getElementById('xs').value = product.xs;
        document.getElementById('xs').dataset.original = product.xs;
        document.getElementById('s').value = product.s;
        document.getElementById('s').dataset.original = product.s;
        document.getElementById('xs').value = product.xs;
        document.getElementById('xs').dataset.original = product.xs;
        document.getElementById('m').value = product.m;
        document.getElementById('m').dataset.original = product.m;
        document.getElementById('l').value = product.l;
        document.getElementById('l').dataset.original = product.l;
        document.getElementById('xl').value = product.xl;
        document.getElementById('xl').dataset.original = product.xl;
        document.getElementById('xxl').value = product.xxl;
        document.getElementById('xxl').dataset.original = product.xxl;
        document.getElementById('xxxl').value = product.xxxl;
        document.getElementById('xxxl').value = product.xxxl;
        document.getElementById('xxxl').dataset.original = product.xxxl;

        // Product Type & Quantity
        const pType = product.product_type || 'sized';
        const radio = document.querySelector(`input[name="product_type"][value="${pType}"]`);
        if (radio) {
          radio.checked = true;
          toggleProductType(pType);
        }
        document.getElementById('quantity').value = product.quantity || 0;

        // Populate Live Links
        currentLinks = product.live_links ? product.live_links.split(',').filter(l => l.trim()) : [];
        renderLinkTags();
        if (linkInput) linkInput.value = ''; // clear input


        // Image Preview
        const preview = document.getElementById('imagePreview');
        if (preview) {
          const baseImgUrl = (typeof CONFIG !== 'undefined' && CONFIG.IMAGE_BASE_URL) ? CONFIG.IMAGE_BASE_URL : "assets/images/products/";
          let src = '';
          if (product.img1 && (product.img1.startsWith('http') || product.img1.startsWith('data:'))) {
            src = product.img1;
          } else {
            const imgPath = product.img1 || encodeURIComponent(product.sku || '').replace(/%20/g, '%2520');
            src = `${baseImgUrl}${imgPath}.webp`;
          }
          preview.src = src;
          preview.classList.remove('hidden');
        }

        document.getElementById('min_stock_alert').value = product.min_stock_alert || 10;
        document.getElementById('cost_price').value = product.cost_price || '';
        document.getElementById('purchase_cost').value = product.purchase_cost || '';

        // Mutual Exclusivity Logic
        const mCost = parseFloat(product.cost_price || 0);
        const pInput = document.getElementById('purchase_cost');
        if (mCost > 0) {
          pInput.disabled = true;
          pInput.title = "Disabled because Manufacture Cost exists";
        } else {
          pInput.disabled = false;
          pInput.title = "";
        }
        document.getElementById('status').value = product.status || 'active';

        editingId = id;
        document.getElementById('formTitle').textContent = 'Edit Product';
        document.getElementById('cancelEdit').classList.remove('hidden');

        // Auto-expand the form
        toggleAddProduct(true);

        const form = document.getElementById('productForm');
        const offset = 100;
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = form.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      });
  }

  if (e.target.classList.contains('preview-img')) {
    document.getElementById('modalImage').src = e.target.dataset.src;
    document.getElementById('imageModal').classList.remove('hidden');
  }
});

document.getElementById('closeModal').onclick = () => {
  document.getElementById('imageModal').classList.add('hidden');
};

document.getElementById('searchInput').addEventListener('input', debounce(function (e) {
  currentSearch = e.target.value;
  currentPage = 1;
  fetchInventory(currentFilters());
}, 500));

document.getElementById('categoryFilter').addEventListener('change', function (e) {
  currentCategory = e.target.value;
  currentPage = 1;
  fetchInventory(currentFilters());
});

document.getElementById('rackFilter').addEventListener('input', function (e) {
  currentRack = e.target.value;
  currentPage = 1;
  fetchInventory(currentFilters());
});

// Redundant listeners removed. cardMap logic handles this.


document.addEventListener('keydown', function (e) {
  if (e.ctrlKey && e.key === 'e') {
    e.preventDefault();
    window.open(`${apiUrl}?action=export`, '_blank');
  }
});
document.querySelectorAll("#xs, #s, #m, #l, #xl, #xxl, #xxxl").forEach(input => {
  input.addEventListener("focus", function () {
    // store currently shown numeric value as original
    this.dataset.original = String(this.value || '0');
  });

  input.addEventListener("input", function () {
    const val = this.value.trim();
    // If user typed a pure relative change like "+5" or "-3", show the calculated number live
    if (/^[+-]\d+$/.test(val)) {
      const change = parseInt(val, 10);
      const oldValue = parseInt(this.dataset.original || '0', 10) || 0;
      const newValue = Math.max(0, oldValue + change);
      this.value = String(newValue);
    }
    // otherwise leave as-is (we'll finalize on submit)
  });
});

function controlUIByRole() {
  const userRoles = (userRole || '').split(',');
  document.querySelectorAll('[data-role]').forEach(el => {
    const allowedRoles = el.getAttribute('data-role').split(',');
    const hasAccess = allowedRoles.some(r => userRoles.includes(r));
    if (!hasAccess) {
      el.style.display = 'none';
    }
  });
}

// Fetch Categories and Rack Locations
Promise.all([
  fetch(`${apiUrl}?action=rack_locations`),
  fetch('api/factory_api.php?action=get_master_data')
])
  .then(async ([resRacks, resMaster]) => {
    if (resRacks.status === 401 || resMaster.status === 401) {
      window.location.href = '/login.html';
      throw new Error("Unauthorized");
    }
    const racks = await resRacks.json();
    const master = await resMaster.json();
    return { racks, master };
  })
  .then(({ racks, master }) => {
    // Populate Racks
    const dl = document.getElementById('rackList');
    if (dl) {
      racks.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.rack_code;
        dl.appendChild(opt);
      });
    }

    // Populate Categories
    const catSelect = document.getElementById('category');
    const catFilter = document.getElementById('categoryFilter');

    if (master.success && master.categories) {
      master.categories.forEach(c => {
        // Add to Form
        if (catSelect) {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.name;
          catSelect.appendChild(opt);
        }
        // Add to Filter
        if (catFilter) {
          const opt = document.createElement('option');
          opt.value = c.name;
          opt.textContent = c.name;
          catFilter.appendChild(opt);
        }
      });
    }
  })
  .catch(console.error);


// Rack Tag Logic
const rackInput = document.getElementById('rackInput');
const rackTags = document.getElementById('rackTags');
const rackHidden = document.getElementById('rack_location');
let currentTags = [];

function updateRackHidden() {
  if (rackHidden) rackHidden.value = currentTags.join(',');
}

function renderRackTags() {
  if (!rackTags) return;
  rackTags.innerHTML = '';
  currentTags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-sm flex items-center gap-1 border border-indigo-200';
    span.innerHTML = `
      ${tag}
      <button type="button" class="hover:text-indigo-900 focus:outline-none" onclick="removeRackTag('${tag}')">
        <i class="fas fa-times text-xs"></i>
      </button>
    `;
    rackTags.appendChild(span);
  });
  updateRackHidden();
}

function addRackTag(tag) {
  tag = tag.trim().toUpperCase();
  if (tag && !currentTags.includes(tag)) {
    currentTags.push(tag);
    renderRackTags();
  }
  if (rackInput) rackInput.value = '';
}

window.removeRackTag = function (tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderRackTags();
};

if (rackInput) {
  rackInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRackTag(this.value);
    } else if (e.key === 'Backspace' && !this.value && currentTags.length > 0) {
      currentTags.pop();
      renderRackTags();
    }
  });

  // Also handle selection from datalist or blur
  rackInput.addEventListener('change', function () {
    addRackTag(this.value);
  });
}


// --- Live Link Tag Logic ---
const linkInput = document.getElementById('linkInput');
const linkTags = document.getElementById('linkTags');
const linkHidden = document.getElementById('live_links');
let currentLinks = [];

function updateLinkHidden() {
  if (linkHidden) linkHidden.value = currentLinks.join(',');
}

function renderLinkTags() {
  if (!linkTags) return;
  linkTags.innerHTML = '';
  currentLinks.forEach((url, index) => {
    // Detect type for icon
    let type = 'link';
    if (url.includes('myntra')) type = 'myntra';
    else if (url.includes('amazon')) type = 'amazon';
    else if (url.includes('flipkart')) type = 'flipkart';
    else if (url.includes('ajio')) type = 'ajio';
    else if (url.includes('snapdeal')) type = 'snapdeal';

    const span = document.createElement('span');
    span.className = 'group bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-sm flex items-center gap-2 border border-indigo-100 max-w-full overflow-hidden hover:bg-indigo-100 transition-colors';
    span.title = url; // Show full URL on hover

    // Truncate URL for display
    const shortUrl = url.length > 20 ? url.substring(0, 20) + '...' : url;

    span.innerHTML = `
      <!-- Move Left -->
      <button type="button" class="text-gray-400 hover:text-indigo-600 focus:outline-none flex-shrink-0 ${index === 0 ? 'invisible' : ''}" onclick="moveLinkTag(${index}, -1)" title="Move Left">
        <i class="fas fa-chevron-left text-[10px]"></i>
      </button>

      <span class="flex items-center gap-1 truncate pointer-events-none select-none">
        ${getLinkIcon(url, type)} 
        <span class="text-xs text-gray-600 truncate">${shortUrl}</span>
      </span>

      <!-- Move Right -->
      <button type="button" class="text-gray-400 hover:text-indigo-600 focus:outline-none flex-shrink-0 ${index === currentLinks.length - 1 ? 'invisible' : ''}" onclick="moveLinkTag(${index}, 1)" title="Move Right">
        <i class="fas fa-chevron-right text-[10px]"></i>
      </button>

      <!-- Remove -->
      <div class="h-3 w-px bg-indigo-200 mx-1"></div>
      <button type="button" class="text-gray-400 hover:text-red-600 focus:outline-none flex-shrink-0" onclick="removeLinkTag(${index})" title="Remove">
        <i class="fas fa-times text-xs"></i>
      </button>
    `;
    linkTags.appendChild(span);
  });
  updateLinkHidden();
}

function addLinkTag(url) {
  url = url.trim();
  if (url && !currentLinks.includes(url)) {
    currentLinks.push(url);
    renderLinkTags();
  }
  if (linkInput) linkInput.value = '';
}

window.moveLinkTag = function (index, direction) {
  if (direction === -1 && index > 0) {
    // Swap with previous
    [currentLinks[index], currentLinks[index - 1]] = [currentLinks[index - 1], currentLinks[index]];
  } else if (direction === 1 && index < currentLinks.length - 1) {
    // Swap with next
    [currentLinks[index], currentLinks[index + 1]] = [currentLinks[index + 1], currentLinks[index]];
  }
  renderLinkTags();
};

window.removeLinkTag = function (index) {
  currentLinks.splice(index, 1);
  renderLinkTags();
};

if (linkInput) {
  linkInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLinkTag(this.value);
    } else if (e.key === 'Backspace' && !this.value && currentLinks.length > 0) {
      currentLinks.pop();
      renderLinkTags();
    }
  });

  linkInput.addEventListener('change', function () {
    addLinkTag(this.value);
  });

  // Paste handler to split by commas if pasting multiple
  linkInput.addEventListener('paste', function (e) {
    setTimeout(() => {
      const val = this.value;
      if (val.includes(',')) {
        val.split(',').forEach(u => addLinkTag(u));
        this.value = '';
      }
    }, 10);
  });
}

if (rackInput) {
  rackInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRackTag(this.value);
    } else if (e.key === 'Backspace' && !this.value && currentTags.length > 0) {
      currentTags.pop();
      renderRackTags();
    }
  });

  // Also handle selection from datalist or blur
  rackInput.addEventListener('change', function () {
    addRackTag(this.value);
  });
}




// --- Collapsible Form Logic ---
function toggleAddProduct(expand = null) {
  const content = document.getElementById('addProductContent');
  const icon = document.querySelector('#toggleProductFormBtn i');

  if (!content) return;

  const isHidden = content.classList.contains('hidden');
  const shouldExpand = expand === null ? isHidden : expand;

  if (shouldExpand) {
    content.classList.remove('hidden');
    if (icon) {
      icon.classList.remove('fa-plus-circle');
      icon.classList.add('fa-minus-circle');
    }
  } else {
    content.classList.add('hidden');
    if (icon) {
      icon.classList.remove('fa-minus-circle');
      icon.classList.add('fa-plus-circle');
    }
  }
}

// --- History Modal Logic ---
let historySku = '';
let historyPage = 1;
let historyLoading = false;
let historyHasMore = true;

window.openHistoryModal = function (sku) {
  historySku = sku;
  historyPage = 1;
  historyHasMore = true;
  // Mark as Audit History
  document.getElementById('historyList').dataset.mode = 'audit';

  document.getElementById('historyModalTitle').textContent = `History for SKU: ${sku}`;
  document.getElementById('historyList').innerHTML = ''; // Clear prev
  document.getElementById('historyModal').classList.remove('hidden');

  fetchHistory();
};

window.openCostPriceHistory = (sku) => {
  // Mark as Cost History
  document.getElementById('historyList').dataset.mode = 'cost';

  document.getElementById('historyModalTitle').textContent = `Cost History for SKU: ${sku}`;
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  document.getElementById('historyModal').classList.remove('hidden');

  document.getElementById('historyLoading').classList.remove('hidden');

  // Fetch from operational_cost API
  fetch(`api/operational_cost.php?action=history_log&sku=${sku}`)
    .then(res => res.json())
    .then(data => {
      renderCostHistoryItems(data);
    })
    .catch(err => {
      console.error(err);
      list.innerHTML = `<div class="text-red-500 text-center">Failed to load history.</div>`;
    })
    .finally(() => {
      document.getElementById('historyLoading').classList.add('hidden');
    });
};

function renderCostHistoryItems(items) {
  const list = document.getElementById('historyList');
  if (!items || items.length === 0) {
    list.innerHTML = `<div class="text-gray-400 text-center py-4">No cost history found.</div>`;
    return;
  }

  // 1. Group items by timestamp (and user, just in case)
  const groups = {};
  items.forEach(log => {
    // Create a key based on time and user
    // We assume timestamps are identical for the same transaction
    const key = `${log.changed_at}_${log.changed_by}`;
    if (!groups[key]) {
      groups[key] = {
        timestamp: log.changed_at,
        user: log.username || 'User ' + log.changed_by,
        changes: []
      };
    }
    groups[key].changes.push(log);
  });

  // 2. Convert to array and sort desc by timestamp
  const sortedGroups = Object.values(groups).sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // 3. Render Groups
  sortedGroups.forEach(group => {
    const card = document.createElement('div');
    card.className = `p-3 rounded-lg border bg-white border-blue-100 shadow-sm flex flex-col gap-2`;

    // Header: Time and User
    card.innerHTML = `
        <div class="flex justify-between items-center border-b border-blue-50 pb-2 mb-1">
            <span class="text-xs text-gray-500 font-medium">
                <i class="far fa-clock mr-1"></i> ${formatTimestamp(group.timestamp)}
            </span>
            <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                ${group.user}
            </span>
        </div>
        <div class="space-y-2">
            ${group.changes.map(log => `
                <div class="flex justify-between items-center text-sm">
                    <span class="font-semibold text-gray-700 capitalize w-1/3 truncate" title="${log.field_changed.replace(/_/g, ' ')}">
                        ${log.field_changed.replace(/_/g, ' ')}
                    </span>
                    <div class="flex items-center gap-2 text-gray-600">
                        <span class="line-through text-xs text-gray-400">${Number(log.old_value).toFixed(2)}</span>
                        <i class="fas fa-arrow-right text-[10px] text-blue-400"></i>
                        <span class="font-bold text-gray-800">${Number(log.new_value).toFixed(2)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    list.appendChild(card);
  });
}

document.getElementById('closeHistoryModal').onclick = () => {
  document.getElementById('historyModal').classList.add('hidden');
};

function fetchHistory() {
  if (document.getElementById('historyList').dataset.mode === 'cost') return; // Don't fetch audit history if in cost mode
  if (historyLoading || !historyHasMore) return;

  historyLoading = true;
  document.getElementById('historyLoading').classList.remove('hidden');

  fetch(`${apiUrl}?action=audit_log&sku=${historySku}&page=${historyPage}&limit=20`)
    .then(res => res.json())
    .then(data => {
      const items = data.items || [];
      historyHasMore = data.hasMore;
      renderHistoryItems(items);
      if (historyHasMore) historyPage++;
    })
    .catch(err => console.error("History fetch error:", err))
    .finally(() => {
      historyLoading = false;
      document.getElementById('historyLoading').classList.add('hidden');
    });
}

function renderHistoryItems(items) {
  const list = document.getElementById('historyList');
  if (items.length === 0 && historyPage === 1) {
    list.innerHTML = `<div class="text-gray-400 text-center py-4">No history found.</div>`;
    return;
  }

  items.forEach(log => {
    const div = document.createElement('div');
    const change = Number(log.quantity_change);
    let colorClass = 'bg-gray-50 border-gray-200';
    let changeText = '';

    if (change > 0) {
      colorClass = 'bg-green-50 border-green-100 text-green-800';
      changeText = `<span class="font-bold text-green-600">+${change}</span>`;
    } else if (change < 0) {
      colorClass = 'bg-red-50 border-red-100 text-red-800';
      changeText = `<span class="font-bold text-red-600">${change}</span>`;
    } else {
      // Non-quantity update
      changeText = `<span class="text-gray-500">-</span>`;
    }

    div.className = `p-3 rounded-lg border flex flex-col gap-1 text-sm ${colorClass}`;
    div.innerHTML = `
            <div class="flex justify-between items-start">
                <span class="font-semibold capitalize">${log.action} (${log.field_changed})</span>
                <span class="text-xs text-gray-500">${formatTimestamp(log.changed_at)}</span>
            </div>
            <div class="flex justify-between items-center mt-1">
                <span>Value: <span class="line-through text-gray-400">${log.old_value}</span> <i class="fas fa-arrow-right text-xs mx-1"></i> <span class="font-medium">${log.new_value}</span></span>
                ${changeText}
            </div>
            ${log.notes ? `<div class="text-xs text-gray-400 italic mt-1 border-t border-black/5 pt-1">${log.notes}</div>` : ''}
        `;
    list.appendChild(div);
  });
}

// Infinite Scroll
document.getElementById('historyList').addEventListener('scroll', function () {
  if (document.getElementById('historyList').dataset.mode === 'cost') return; // Disable infinite scroll for cost mode (all loaded at once)
  if (this.scrollTop + this.clientHeight >= this.scrollHeight - 50) {
    fetchHistory();
  }
});
window.toggleAddProduct = toggleAddProduct; // Make globally accessible

fetchInventory(currentFilters());

// Cursor Fix: Move cursor to end on focus for stock inputs
['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'quantity'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('focus', function () {
      // Use setTimeout to ensure browser default selection is overridden
      setTimeout(() => {
        const len = this.value.length;
        this.setSelectionRange(len, len);
      }, 0);
    });
  }
});

// Auto-uppercase SKU
const skuInput = document.getElementById('sku');
if (skuInput) {
  skuInput.addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });
}

