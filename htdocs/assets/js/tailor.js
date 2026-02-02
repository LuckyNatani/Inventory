document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('tailorTableBody');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const rackFilter = document.getElementById('rackFilter');
    const sortFilter = document.getElementById('sortFilter');
    const exportBtn = document.getElementById('exportBtn');

    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const showingFrom = document.getElementById('showing-from');
    const showingTo = document.getElementById('showing-to');
    const totalItemsSpan = document.getElementById('total-items');

    // State
    let currentPage = 1;
    let limit = 20;
    let totalItems = 0;

    // Fetch Data
    function fetchData() {
        const params = new URLSearchParams({
            action: 'list',
            page: currentPage,
            limit: limit,
            search: searchInput.value,
            category: categoryFilter.value,
            rack_location: rackFilter.value,
            sort: sortFilter.value
        });

        fetch(`api/tailor.php?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error("API Error");
                return res.json();
            })
            .then(data => {
                renderTable(data.items);
                totalItems = parseInt(data.total);
                updatePagination();
            })
            .catch(err => {
                console.error(err);
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Error loading data</td></tr>`;
            });
    }

    function renderTable(items) {
        tableBody.innerHTML = '';
        if (items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="25" class="text-center py-4 text-gray-500">No items found</td></tr>`;
            return;
        }

        const baseImgUrl = (typeof CONFIG !== 'undefined' && CONFIG.IMAGE_BASE_URL) ? CONFIG.IMAGE_BASE_URL : "assets/images/products/";

        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50 transition-colors group";

            // Image URL construction
            const imgPath = item.img1 || encodeURIComponent(item.sku || '').replace(/%20/g, '%2520');
            const imageUrl = `${baseImgUrl}${imgPath}.webp`;

            // Helper for cut cells (more compact)
            const cutCell = (val, extraClasses = '') => `<td class="px-1 py-2 whitespace-nowrap text-[10px] md:text-xs text-center text-gray-600 border-r border-gray-100 ${val ? 'font-medium text-gray-800' : 'text-gray-400'} ${extraClasses}">${val || '-'}</td>`;

            tr.innerHTML = `
                <td class="px-2 py-2 whitespace-nowrap text-[10px] md:text-xs font-bold text-gray-900 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] group-hover:bg-gray-50">
                    ${item.sku}
                </td>
                <td class="px-2 py-2 whitespace-nowrap text-center">
                    <img src="${imageUrl}" alt="${item.sku}" 
                         class="h-6 w-6 md:h-8 md:w-8 rounded-full object-cover cursor-pointer hover:scale-110 transition-transform shadow-sm mx-auto"
                         onclick="openImageModal('${imageUrl}')">
                </td>
                <td class="px-2 py-2 whitespace-nowrap text-[10px] md:text-xs text-gray-500">
                     ${item.category || '-'}
                </td>
                <td class="px-2 py-2 whitespace-nowrap text-[10px] md:text-xs text-gray-500 border-r-2 border-gray-300">
                     ${item.rack_location || '-'}
                </td>
                
                <!-- Group 1 -->
                ${cutCell(item.g1_top_bottom)}
                ${cutCell(item.g1_top)}
                ${cutCell(item.g1_bottom)}
                ${cutCell(item.g1_work)}
                ${cutCell(item.g1_lace1)}
                ${cutCell(item.g1_lace2, '!border-r-2 !border-gray-300')}

                <!-- Group 2 -->
                ${cutCell(item.g2_top_bottom)}
                ${cutCell(item.g2_top)}
                ${cutCell(item.g2_bottom)}
                ${cutCell(item.g2_work)}
                ${cutCell(item.g2_lace1)}
                ${cutCell(item.g2_lace2, '!border-r-2 !border-gray-300')}

                <!-- Group 3 -->
                ${cutCell(item.g3_top_bottom)}
                ${cutCell(item.g3_top)}
                ${cutCell(item.g3_bottom)}
                ${cutCell(item.g3_work)}
                ${cutCell(item.g3_lace1)}
                ${cutCell(item.g3_lace2)}

                <td class="px-2 py-2 whitespace-nowrap text-[10px] md:text-xs text-gray-500 max-w-[100px] truncate" title="${item.remark || ''}">
                    ${item.remark || '-'}
                </td>

                <td class="px-2 py-2 whitespace-nowrap text-[10px] md:text-xs text-gray-400">
                    ${item.updated_at ? formatTimestamp(item.updated_at) : '-'}
                </td>
                <td class="px-2 py-2 whitespace-nowrap text-right text-xs font-medium">
                    <button class="edit-btn text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors border border-indigo-200"
                            data-sku="${item.sku}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;

            // Attach item data to the button for easy access
            const editBtn = tr.querySelector('.edit-btn');
            editBtn.itemData = item;
            editBtn.addEventListener('click', () => openEditModal(item));

            tableBody.appendChild(tr);
        });
    }

    // --- Edit Modal Logic ---
    const editModal = document.getElementById('editCutModal');
    const closeEditModalBtn = document.getElementById('closeEditModal');
    const cancelEditBtn = document.getElementById('cancelEdit');
    const saveEditBtn = document.getElementById('saveEdit');
    const editSkuInput = document.getElementById('editSku');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    function openEditModal(item) {
        editSkuInput.value = item.sku;
        document.getElementById('editModalTitle').textContent = `Edit Cuts: ${item.sku}`;

        // Helper to safely set value
        const setVal = (id, val) => document.getElementById(id).value = val || '';

        setVal('editRemark', item.remark);

        // Group 1
        setVal('g1_top_bottom', item.g1_top_bottom);
        setVal('g1_top', item.g1_top);
        setVal('g1_bottom', item.g1_bottom);
        setVal('g1_work', item.g1_work);
        setVal('g1_lace1', item.g1_lace1);
        setVal('g1_lace2', item.g1_lace2);

        // Group 2
        setVal('g2_top_bottom', item.g2_top_bottom);
        setVal('g2_top', item.g2_top);
        setVal('g2_bottom', item.g2_bottom);
        setVal('g2_work', item.g2_work);
        setVal('g2_lace1', item.g2_lace1);
        setVal('g2_lace2', item.g2_lace2);

        // Group 3
        setVal('g3_top_bottom', item.g3_top_bottom);
        setVal('g3_top', item.g3_top);
        setVal('g3_bottom', item.g3_bottom);
        setVal('g3_work', item.g3_work);
        setVal('g3_lace1', item.g3_lace1);
        setVal('g3_lace2', item.g3_lace2);

        // Reset to first tab
        switchTab('g1');

        // Check dependencies
        checkDependency('g1');
        checkDependency('g2');
        checkDependency('g3');

        editModal.classList.remove('hidden');
    }

    function checkDependency(prefix) {
        const tb = document.getElementById(`${prefix}_top_bottom`);
        const top = document.getElementById(`${prefix}_top`);
        const bot = document.getElementById(`${prefix}_bottom`);

        if (tb.value.trim() !== '') {
            top.disabled = true;
            bot.disabled = true;
            top.classList.add('bg-gray-100', 'cursor-not-allowed');
            bot.classList.add('bg-gray-100', 'cursor-not-allowed');
        } else {
            top.disabled = false;
            bot.disabled = false;
            top.classList.remove('bg-gray-100', 'cursor-not-allowed');
            bot.classList.remove('bg-gray-100', 'cursor-not-allowed');
        }
    }

    // Attach listeners for dependencies
    ['g1', 'g2', 'g3'].forEach(prefix => {
        document.getElementById(`${prefix}_top_bottom`).addEventListener('input', () => checkDependency(prefix));
    });

    function closeEditModal() {
        editModal.classList.add('hidden');
    }

    if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    function switchTab(tabId) {
        // Update Buttons
        tabBtns.forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active-tab', 'text-indigo-600', 'border-indigo-600');
                btn.classList.remove('text-gray-500', 'border-transparent');
            } else {
                btn.classList.remove('active-tab', 'text-indigo-600', 'border-indigo-600');
                btn.classList.add('text-gray-500', 'border-transparent');
            }
        });

        // Update Content
        tabContents.forEach(content => {
            if (content.id === `${tabId}-content`) {
                content.classList.remove('hidden');
                content.classList.add('block');
            } else {
                content.classList.add('hidden');
                content.classList.remove('block');
            }
        });
    }

    // Save Logic
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => {
            const sku = editSkuInput.value;
            const btn = saveEditBtn;
            const originalText = btn.innerHTML;

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            const data = {
                sku: sku,
                remark: document.getElementById('editRemark').value,
                // G1
                g1_top_bottom: document.getElementById('g1_top_bottom').value,
                g1_top: document.getElementById('g1_top').value,
                g1_bottom: document.getElementById('g1_bottom').value,
                g1_work: document.getElementById('g1_work').value,
                g1_lace1: document.getElementById('g1_lace1').value,
                g1_lace2: document.getElementById('g1_lace2').value,
                // G2
                g2_top_bottom: document.getElementById('g2_top_bottom').value,
                g2_top: document.getElementById('g2_top').value,
                g2_bottom: document.getElementById('g2_bottom').value,
                g2_work: document.getElementById('g2_work').value,
                g2_lace1: document.getElementById('g2_lace1').value,
                g2_lace2: document.getElementById('g2_lace2').value,
                // G3
                g3_top_bottom: document.getElementById('g3_top_bottom').value,
                g3_top: document.getElementById('g3_top').value,
                g3_bottom: document.getElementById('g3_bottom').value,
                g3_work: document.getElementById('g3_work').value,
                g3_lace1: document.getElementById('g3_lace1').value,
                g3_lace2: document.getElementById('g3_lace2').value,
            };

            fetch('api/tailor.php?action=update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
                .then(async res => {
                    const isJson = res.headers.get('content-type')?.includes('application/json');
                    const data = isJson ? await res.json() : null;
                    const text = !isJson ? await res.text() : '';

                    if (!res.ok) {
                        const error = (data && data.error) || text || res.statusText;
                        throw new Error(error);
                    }
                    return data;
                })
                .then(response => {
                    if (response.success) {
                        btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                        btn.classList.add('bg-green-600', 'hover:bg-green-700');
                        btn.innerHTML = '<i class="fas fa-check"></i> Saved';

                        setTimeout(() => {
                            closeEditModal();
                            fetchData(); // Refresh table
                            // Reset button style
                            btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
                            btn.classList.remove('bg-green-600', 'hover:bg-green-700');
                            btn.innerHTML = originalText;
                            btn.disabled = false;
                        }, 1000);
                    } else {
                        alert('Error: ' + (response.error || 'Update failed'));
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert('Save failed: ' + err.message);
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                });
        });
    }

    function updatePagination() {
        const totalPages = Math.ceil(totalItems / limit);
        const start = (currentPage - 1) * limit + 1;
        const end = Math.min(currentPage * limit, totalItems);

        showingFrom.textContent = totalItems === 0 ? 0 : start;
        showingTo.textContent = end;
        totalItemsSpan.textContent = totalItems;

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;

        // Render Page Numbers (Simplified)
        const paginationNumbers = document.getElementById('pagination-numbers');
        paginationNumbers.innerHTML = `
            <span class="px-2 py-1 text-gray-500">Page ${currentPage} of ${totalPages || 1}</span>
        `;
    }

    // Modal Logic
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const closeModal = document.getElementById('closeModal');

    window.openImageModal = function (src) {
        modalImage.src = src;
        imageModal.classList.remove('hidden');
    }

    closeModal.addEventListener('click', () => {
        imageModal.classList.add('hidden');
    });

    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.classList.add('hidden');
        }
    });

    // --- Filter Event Listeners ---

    // Search (Debounced)
    let timeout = null;
    searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            currentPage = 1;
            fetchData();
        }, 500);
    });

    categoryFilter.addEventListener('change', () => {
        currentPage = 1;
        fetchData();
    });

    rackFilter.addEventListener('input', () => {
        // You can debounce this too if you like
        currentPage = 1;
        fetchData();
    });

    sortFilter.addEventListener('change', () => {
        currentPage = 1;
        fetchData();
    });

    // Export
    exportBtn.addEventListener('click', () => {
        const params = new URLSearchParams({
            action: 'export',
            search: searchInput.value,
            category: categoryFilter.value,
            rack_location: rackFilter.value,
            sort: sortFilter.value
        });
        window.open(`api/tailor.php?${params.toString()}`, '_blank');
    });

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchData();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(totalItems / limit);
        if (currentPage < totalPages) {
            currentPage++;
            fetchData();
        }
    });


    // --- Initialization: Fetch Filters ---
    // Fetch Categories using factory API or inventory API if available
    // We'll use factory_api.php?action=get_master_data as inventory.js does
    fetch('api/factory_api.php?action=get_master_data')
        .then(res => res.json())
        .then(master => {
            if (master.success && master.categories) {
                master.categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.name;
                    opt.textContent = c.name;
                    categoryFilter.appendChild(opt);
                });
            }
        })
        .catch(err => console.log('Failed to load categories', err));

    // Check Role for Logs
    const userRole = localStorage.getItem('role') || '';
    if (userRole.includes('admin') || userRole.includes('sub-admin')) {
        const viewLogsBtn = document.getElementById('viewLogsBtn');
        viewLogsBtn.classList.remove('hidden');

        const logModal = document.getElementById('changeLogModal');
        const logTableBody = document.getElementById('logTableBody');
        const logSearchInput = document.getElementById('logSearchInput');

        viewLogsBtn.addEventListener('click', () => {
            logModal.classList.remove('hidden');
            fetchLogs();
        });

        document.getElementById('closeLogModal').addEventListener('click', () => {
            logModal.classList.add('hidden');
        });

        // Search in logs
        logSearchInput.addEventListener('input', debounce(() => {
            fetchLogs(logSearchInput.value);
        }, 300));

        window.fetchLogs = function (search = '') {
            logTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Loading logs...</td></tr>';

            fetch(`api/tailor.php?action=get_logs&search=${encodeURIComponent(search)}`)
                .then(res => res.json())
                .then(data => {
                    logTableBody.innerHTML = '';

                    if (data.error) {
                        throw new Error(data.error);
                    }

                    if (!Array.isArray(data) || data.length === 0) {
                        logTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No logs found</td></tr>';
                        return;
                    }

                    data.forEach(log => {
                        let changesHtml = '';
                        try {
                            const changes = JSON.parse(log.changes_json);
                            if (Object.keys(changes).length > 0) {
                                changesHtml = '<ul class="list-disc list-inside text-xs space-y-1">';
                                for (const [key, val] of Object.entries(changes)) {
                                    // Make key readable
                                    let readableKey = key.replace(/_/g, ' ').toUpperCase();
                                    readableKey = readableKey.replace('G1', 'S-3XL :');
                                    readableKey = readableKey.replace('G2', 'M-3XL :');
                                    readableKey = readableKey.replace('G3', 'S-2XL :');

                                    changesHtml += `<li><strong>${readableKey}</strong> "${val.old}" &rarr; <span class="font-bold text-indigo-600">"${val.new}"</span></li>`;
                                }
                                changesHtml += '</ul>';
                            } else {
                                changesHtml = '<span class="text-gray-400 italic">No specific field changes recorded</span>';
                            }
                        } catch (e) {
                            changesHtml = '<span class="text-red-400">Error parsing changes</span>';
                        }

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500">${formatTimestamp(log.created_at)}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">${log.sku}</td>
                            <td class="px-6 py-4 text-sm text-gray-600">${changesHtml}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.username || 'Unknown'}</td>
                        `;
                        logTableBody.appendChild(tr);
                    });
                })
                .catch(err => {
                    console.error(err);
                    logTableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Error fetching logs: ${err.message}</td></tr>`;
                });
        };
    }

    // Debounce Helper if not imported
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initial Load
    fetchData();
});
