
document.addEventListener('DOMContentLoaded', () => {
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const previewSection = document.getElementById('previewSection');
    const previewTableBody = document.getElementById('previewTableBody');
    const previewSummary = document.getElementById('previewSummary');
    const resultsSection = document.getElementById('resultsSection');
    const statProcessed = document.getElementById('statProcessed');
    const statSuccess = document.getElementById('statSuccess');
    const statFailed = document.getElementById('statFailed');
    const logTableBody = document.getElementById('logTableBody');

    let selectedFile = null;
    let parsedData = []; // Holds validated rows ready to submit

    const sizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

    // --- Step 1: Download Template ---
    downloadTemplateBtn.addEventListener('click', async () => {
        downloadTemplateBtn.disabled = true;
        downloadTemplateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Generating...';

        try {
            // Fetch all inventory items (no pagination)
            const response = await fetch('api/inventory.php?action=list&page=1&limit=99999', { skipGlobalSpinner: true });
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            const data = await response.json();
            const items = data.items || [];

            if (items.length === 0) {
                ui.showToast('No inventory items found.', 'warning');
                return;
            }

            // Build rows: each SKU expands into SKU_Size rows
            const rows = [];
            items.forEach(item => {
                const sku = item.sku || '';
                sizes.forEach(size => {
                    const sizeKey = size.toLowerCase();
                    const currentQty = Number(item[sizeKey] || 0);
                    const compositeSku = `${sku}_${size}`;
                    rows.push({
                        'SKU': compositeSku,
                        'Current Stock': currentQty,
                        'Increase': '',
                        'Decrease': ''
                    });
                });
            });

            // Create workbook
            const ws = XLSX.utils.json_to_sheet(rows);

            // Set column widths
            ws['!cols'] = [
                { wch: 30 },  // SKU
                { wch: 15 },  // Current Stock
                { wch: 12 },  // Increase
                { wch: 12 }   // Decrease
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Inventory Update');

            // Download
            XLSX.writeFile(wb, `inventory_update_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
            ui.showToast('Template downloaded successfully!', 'success');

        } catch (err) {
            console.error('Template download error:', err);
            ui.showToast('Failed to generate template. Please try again.', 'error');
        } finally {
            downloadTemplateBtn.disabled = false;
            downloadTemplateBtn.innerHTML = '<i class="fas fa-file-excel mr-2"></i> Download Current Inventory Template';
        }
    });

    // --- Step 2: File Selection & Parse ---
    fileInput.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        parsedData = [];
        previewSection.classList.add('hidden');
        resultsSection.classList.add('hidden');

        if (!selectedFile) {
            processBtn.disabled = true;
            return;
        }

        // Parse the file immediately for preview
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

                parsedData = validateAndParse(jsonData);

                if (parsedData.length > 0) {
                    renderPreview(parsedData);
                    previewSection.classList.remove('hidden');
                    processBtn.disabled = false;
                } else {
                    ui.showToast('No valid rows found in the file. Check column headers (SKU, Increase, Decrease).', 'warning');
                    processBtn.disabled = true;
                }
            } catch (err) {
                console.error('File parse error:', err);
                ui.showToast('Failed to parse file. Please ensure it is a valid Excel/CSV.', 'error');
                processBtn.disabled = true;
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    });

    function validateAndParse(jsonData) {
        const validRows = [];

        jsonData.forEach((row, index) => {
            // Normalize keys to lowercase
            const normalized = {};
            Object.keys(row).forEach(k => {
                normalized[k.toLowerCase().trim()] = row[k];
            });

            const rawSku = String(normalized['sku'] || '').trim();
            if (!rawSku) return; // Skip rows without SKU

            const increase = normalized['increase'] !== undefined && normalized['increase'] !== '' ? Number(normalized['increase']) : null;
            const decrease = normalized['decrease'] !== undefined && normalized['decrease'] !== '' ? Number(normalized['decrease']) : null;

            // Skip if both are empty
            if (increase === null && decrease === null) return;

            // Validate: not both filled
            if (increase !== null && decrease !== null) {
                validRows.push({
                    rawSku,
                    action: 'error',
                    quantity: 0,
                    error: 'Both Increase and Decrease filled',
                    rowIndex: index + 2 // 1-indexed + header
                });
                return;
            }

            // Validate: quantity must be positive
            const qty = increase !== null ? increase : decrease;
            if (isNaN(qty) || qty <= 0) {
                validRows.push({
                    rawSku,
                    action: 'error',
                    quantity: 0,
                    error: 'Invalid quantity',
                    rowIndex: index + 2
                });
                return;
            }

            // Parse SKU: last part is size, rest is the actual SKU
            // e.g. "5014_Navy_Blue_L" -> sku="5014_Navy_Blue", size="L"
            const parts = rawSku.split('_');
            const lastPart = (parts[parts.length - 1] || '').toUpperCase();

            if (!sizes.includes(lastPart)) {
                validRows.push({
                    rawSku,
                    action: 'error',
                    quantity: 0,
                    error: `Invalid size suffix "${lastPart}". Expected one of: ${sizes.join(', ')}`,
                    rowIndex: index + 2
                });
                return;
            }

            const actualSku = parts.slice(0, -1).join('_');
            const size = lastPart.toLowerCase();
            const action = increase !== null ? 'increase' : 'decrease';

            validRows.push({
                rawSku,
                sku: actualSku,
                size,
                action,
                quantity: Math.floor(qty),
                rowIndex: index + 2
            });
        });

        return validRows;
    }

    function renderPreview(data) {
        previewTableBody.innerHTML = '';
        let increaseCount = 0;
        let decreaseCount = 0;
        let errorCount = 0;

        data.forEach(row => {
            const tr = document.createElement('tr');

            if (row.action === 'error') {
                errorCount++;
                tr.className = 'bg-red-50';
                tr.innerHTML = `
                    <td class="px-4 py-2 text-sm font-medium text-gray-900">${row.rawSku}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">-</td>
                    <td class="px-4 py-2 text-center"><span class="text-red-600 text-xs font-medium"><i class="fas fa-times-circle mr-1"></i>${row.error}</span></td>
                    <td class="px-4 py-2 text-center text-sm text-gray-500">-</td>
                `;
            } else {
                if (row.action === 'increase') increaseCount++;
                else decreaseCount++;

                const actionBadge = row.action === 'increase'
                    ? '<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium"><i class="fas fa-arrow-up mr-1"></i>Increase</span>'
                    : '<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium"><i class="fas fa-arrow-down mr-1"></i>Decrease</span>';

                tr.innerHTML = `
                    <td class="px-4 py-2 text-sm font-medium text-gray-900">${row.sku}</td>
                    <td class="px-4 py-2 text-sm text-gray-600 uppercase">${row.size}</td>
                    <td class="px-4 py-2 text-center">${actionBadge}</td>
                    <td class="px-4 py-2 text-center text-sm font-semibold ${row.action === 'increase' ? 'text-green-700' : 'text-red-700'}">${row.action === 'increase' ? '+' : '-'}${row.quantity}</td>
                `;
            }
            previewTableBody.appendChild(tr);
        });

        const parts = [];
        if (increaseCount > 0) parts.push(`<span class="text-green-600 font-medium">${increaseCount} increase(s)</span>`);
        if (decreaseCount > 0) parts.push(`<span class="text-red-600 font-medium">${decreaseCount} decrease(s)</span>`);
        if (errorCount > 0) parts.push(`<span class="text-red-500 font-medium">${errorCount} error(s) - will be skipped</span>`);
        previewSummary.innerHTML = parts.join(' &middot; ') || 'No valid changes';
    }

    // --- Step 3: Process & Upload ---
    processBtn.addEventListener('click', async () => {
        const validItems = parsedData.filter(r => r.action !== 'error');
        if (validItems.length === 0) {
            ui.showToast('No valid items to process.', 'warning');
            return;
        }

        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';
        resultsSection.classList.remove('hidden');
        logTableBody.innerHTML = '';

        let processed = 0;
        let success = 0;
        let failed = 0;

        // Send in chunks
        const chunkSize = 50;
        for (let i = 0; i < validItems.length; i += chunkSize) {
            const chunk = validItems.slice(i, i + chunkSize);

            try {
                const response = await fetch('api/bulk_stock_update.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: chunk })
                });

                if (response.status === 401) {
                    window.location.href = '/login.html';
                    return;
                }

                const result = await response.json();

                (result.results || []).forEach(res => {
                    processed++;
                    if (res.success) {
                        success++;
                    } else {
                        failed++;
                    }
                    addLog(res);
                });

            } catch (err) {
                console.error(err);
                chunk.forEach(row => {
                    processed++;
                    failed++;
                    addLog({ sku: row.rawSku || 'Unknown', success: false, message: 'Network/Server Error' });
                });
            }

            statProcessed.textContent = processed;
            statSuccess.textContent = success;
            statFailed.textContent = failed;
        }

        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Process & Update';
        fileInput.value = '';
        selectedFile = null;
        parsedData = [];

        ui.showToast(`Bulk update complete: ${success} succeeded, ${failed} failed.`, success > 0 ? 'success' : 'warning');
    });

    function addLog(res) {
        const row = document.createElement('tr');
        const colorClass = res.success ? 'text-green-600' : 'text-red-600';
        const icon = res.success ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>';

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${res.sku}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${colorClass}">${icon} ${res.success ? 'Success' : 'Failed'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${res.message}</td>
        `;
        logTableBody.prepend(row);
    }
});
