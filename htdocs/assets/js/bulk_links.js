document.addEventListener('DOMContentLoaded', () => {
    // Check Permissions (Simple role check, backend will verify too)
    const role = localStorage.getItem('role') || '';
    if (!role.includes('admin') && !role.includes('production') && !role.includes('sub-admin')) {
        alert("Access Denied: You do not have permission to view this page.");
        window.location.href = '/inventory.html';
        return;
    }

    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            processBtn.disabled = false;
        } else {
            processBtn.disabled = true;
        }
    });

    processBtn.addEventListener('click', handleUpload);
});

async function handleUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) return;

    ui.showLoading("Parsing Excel file...");

    try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        // Assume first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to array of arrays
        // header: 1 gives us raw array of arrays
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length === 0) {
            throw new Error("Excel file appears to be empty.");
        }

        // Process Data
        // Row structure: [SKU, Link1, Link2, Link3, Link4]
        // We skip header if it looks like a header (optional, but good practice to just scan all if user didn't specify)
        // Let's assume Row 0 might be header. If Col 0 is "SKU" (case insensitive), skip it.

        let startRow = 0;
        if (rows[0] && typeof rows[0][0] === 'string' && rows[0][0].toLowerCase().includes('sku')) {
            startRow = 1;
        }

        const payload = [];

        for (let i = startRow; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;

            const sku = row[0] ? String(row[0]).trim() : null;
            if (!sku) continue; // Skip empty SKUs

            // Collect links from col 1 to 4 (or more)
            const links = [];
            for (let c = 1; c < row.length; c++) {
                if (row[c]) {
                    const link = String(row[c]).trim();
                    if (link.startsWith('http')) {
                        links.push(link);
                    }
                }
            }

            if (links.length > 0) {
                payload.push({
                    sku: sku,
                    new_links: links
                });
            }
        }

        if (payload.length === 0) {
            throw new Error("No valid data found. Ensure Column A is SKU and subsequent columns are Links.");
        }

        ui.showLoading(`Uploading ${payload.length} items...`);
        await sendBatch(payload);

    } catch (err) {
        console.error(err);
        ui.showToast(err.message, "error");
    } finally {
        ui.hideLoading();
    }
}

async function sendBatch(items) {
    // Send to API
    try {
        const res = await fetch('api/bulk_update_links.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items, user_id: localStorage.getItem('userId') })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || "Server error occurred.");
        }

        renderResults(data);

    } catch (err) {
        ui.showToast("Upload failed: " + err.message, "error");
    }
}

function renderResults(data) {
    const section = document.getElementById('resultsSection');
    section.classList.remove('hidden');

    document.getElementById('statProcessed').textContent = data.total_processed || 0;
    document.getElementById('statSuccess').textContent = data.success_count || 0;
    document.getElementById('statFailed').textContent = data.error_count || 0;

    const tbody = document.getElementById('logTableBody');
    tbody.innerHTML = '';

    // data.results = [{sku, status: 'success'|'error'|'skipped', message}]
    if (data.results && Array.isArray(data.results)) {
        data.results.forEach(r => {
            const tr = document.createElement('tr');
            const statusColor = r.status === 'success' ? 'text-green-600' : (r.status === 'skipped' ? 'text-orange-500' : 'text-red-600');

            tr.innerHTML = `
                <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-900">${r.sku}</td>
                <td class="px-6 py-2 whitespace-nowrap text-sm font-bold ${statusColor}">${r.status.toUpperCase()}</td>
                <td class="px-6 py-2 whitespace-nowrap text-sm text-gray-500">${r.message}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}
