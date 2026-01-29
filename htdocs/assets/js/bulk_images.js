
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const dropZone = document.getElementById('dropZone');
    const fileStats = document.getElementById('fileStats');
    const selectedCount = document.getElementById('selectedCount');
    const resultsSection = document.getElementById('resultsSection');
    const logTableBody = document.getElementById('logTableBody');

    let filesToUpload = [];

    // Drag and Drop Effects
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
    }

    function unhighlight(e) {
        dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        filesToUpload = [...files];
        updateUI();
    }

    function updateUI() {
        if (filesToUpload.length > 0) {
            fileStats.classList.remove('hidden');
            selectedCount.textContent = `${filesToUpload.length} files selected`;
            uploadBtn.disabled = false;
        } else {
            fileStats.classList.add('hidden');
        }
    }

    uploadBtn.addEventListener('click', async () => {
        if (filesToUpload.length === 0) return;

        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Uploading...';
        resultsSection.classList.remove('hidden');
        logTableBody.innerHTML = '';

        // Upload one by one to avoid server limits and better progress tracking
        for (let file of filesToUpload) {
            await uploadFile(file);
        }

        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fas fa-upload mr-2"></i> Start Upload';
        filesToUpload = []; // Clear current batch
        fileInput.value = '';
    });

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('image', file);

        // Extract SKU from filename (remove extension)
        const sku = file.name.replace(/\.[^/.]+$/, "");
        formData.append('sku', sku);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${file.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${sku}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600"><i class="fas fa-spinner fa-spin"></i> Processing</td>
        `;
        logTableBody.prepend(row);

        try {
            const response = await fetch('api/bulk_image_upload.php', {
                method: 'POST',
                body: formData
            });

            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }

            const result = await response.json();
            const statusCell = row.querySelectorAll('td')[2];

            if (result.success) {
                statusCell.innerHTML = `<span class="text-green-600"><i class="fas fa-check-circle"></i> Success</span>`;
            } else {
                statusCell.innerHTML = `<span class="text-red-600"><i class="fas fa-times-circle"></i> ${result.error || 'Failed'}</span>`;
            }

        } catch (error) {
            const statusCell = row.querySelectorAll('td')[2];
            statusCell.innerHTML = `<span class="text-red-600"><i class="fas fa-exclamation-triangle"></i> Network Error</span>`;
        }
    }
});
