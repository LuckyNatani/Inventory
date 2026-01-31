
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const processBtn = document.getElementById('processBtn');
    const resultsSection = document.getElementById('resultsSection');
    const statProcessed = document.getElementById('statProcessed');
    const statSuccess = document.getElementById('statSuccess');
    const statFailed = document.getElementById('statFailed');
    const logTableBody = document.getElementById('logTableBody');

    let selectedFile = null;

    fileInput.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        processBtn.disabled = !selectedFile;
    });

    processBtn.addEventListener('click', () => {
        if (!selectedFile) return;
        processBtn.disabled = true;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Processing...';

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }); // Use empty string for missing cells

            uploadData(jsonData);
        };
        reader.readAsArrayBuffer(selectedFile);
    });

    async function uploadData(data) {
        resultsSection.classList.remove('hidden');
        logTableBody.innerHTML = '';

        let processed = 0;
        let success = 0;
        let failed = 0;

        // Process in chunks to avoid timeout/memory issues
        // Detect if images are present to adjust chunk size
        const hasImages = data.some(row => row['Image URL'] || row['image_url'] || row['image link'] || row['image']);
        const chunkSize = hasImages ? 10 : 50; // Reduce to 10 if processing images

        for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);

            try {
                const response = await fetch('api/bulk_inventory_import.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: chunk })
                });

                if (response.status === 401) {
                    window.location.href = '/login.html';
                    return;
                }

                const result = await response.json();

                // Process results
                result.results.forEach(res => {
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
                // Log generic error for this chunk
                chunk.forEach(row => {
                    processed++;
                    failed++;
                    addLog({ sku: row.SKU || row.sku || 'Unknown', success: false, message: 'Network/Server Error' });
                });
            }

            // Update stats
            statProcessed.textContent = processed;
            statSuccess.textContent = success;
            statFailed.textContent = failed;
        }

        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fas fa-upload mr-2"></i> Process & Upload';
        fileInput.value = '';
        selectedFile = null;
    }

    function addLog(res) {
        const row = document.createElement('tr');
        const colorClass = res.success ? 'text-green-600' : 'text-red-600';
        const icon = res.success ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>';

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${res.sku}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${colorClass}">${icon} ${res.success ? 'Success' : 'Failed'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${res.message}</td>
        `;
        logTableBody.prepend(row); // Newest on top
    }
});
