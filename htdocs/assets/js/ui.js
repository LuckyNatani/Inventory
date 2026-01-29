document.addEventListener('DOMContentLoaded', () => {
    const spinnerDiv = document.createElement('div');
    spinnerDiv.id = 'global-spinner';
    spinnerDiv.classList.add('hidden');
    spinnerDiv.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(spinnerDiv);

    // Apply role-based visibility globally
    if (typeof controlUIByRole === 'function') {
        controlUIByRole();
    }
});

const ui = {
    loadingCount: 0,
    timeoutId: null,
    ensureSpinner: () => {
        if (!document.getElementById('global-spinner')) {
            const spinnerDiv = document.createElement('div');
            spinnerDiv.id = 'global-spinner';
            spinnerDiv.classList.add('hidden');
            spinnerDiv.innerHTML = '<div class="spinner"></div>';
            document.body.appendChild(spinnerDiv);
        }
    },
    showLoading: () => {
        ui.ensureSpinner();
        ui.loadingCount++;
        const spinner = document.getElementById('global-spinner');
        if (spinner) spinner.classList.remove('hidden');

        // Safety timeout: auto-hide after 5 seconds if stuck
        if (ui.timeoutId) clearTimeout(ui.timeoutId);
        ui.timeoutId = setTimeout(() => {
            if (ui.loadingCount > 0) {
                console.warn('Spinner timed out, forcing hide.');
                ui.loadingCount = 0;
                ui.hideLoading();
            }
        }, 5000);
    },
    hideLoading: () => {
        if (ui.loadingCount > 0) ui.loadingCount--;
        if (ui.loadingCount === 0) {
            const spinner = document.getElementById('global-spinner');
            if (spinner) spinner.classList.add('hidden');
            if (ui.timeoutId) {
                clearTimeout(ui.timeoutId);
                ui.timeoutId = null;
            }
        }
    },
    showElementLoading: (selector) => {
        const el = document.querySelector(selector);
        if (!el) return;

        // Ensure relative positioning
        if (getComputedStyle(el).position === 'static') {
            el.classList.add('relative');
        }

        let spinner = el.querySelector('.local-spinner');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.className = 'local-spinner absolute inset-0 bg-white/70 flex justify-center items-center z-10 backdrop-blur-[1px] rounded-lg';
            spinner.innerHTML = '<div class="spinner w-8 h-8 border-4"></div>';
            el.appendChild(spinner);
        }
        spinner.classList.remove('hidden');
    },
    hideElementLoading: (selector) => {
        const el = document.querySelector(selector);
        if (!el) return;
        const spinner = el.querySelector('.local-spinner');
        if (spinner) spinner.classList.add('hidden');
    }
};

// Intercept Fetch requests to show/hide spinner automatically
const originalFetch = window.fetch;
window.fetch = async function (input, init = {}) {
    if (!init.skipGlobalSpinner) {
        ui.showLoading();
    }

    try {
        const response = await originalFetch(input, init);
        return response;
    } catch (error) {
        throw error;
    } finally {
        if (!init.skipGlobalSpinner) {
            ui.hideLoading();
        }
    }
};

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function controlUIByRole() {
    const role = localStorage.getItem('role') || 'viewer';
    const userRoles = role.split(',');

    document.querySelectorAll('[data-role]').forEach(el => {
        const allowedRoles = el.dataset.role.split(',');
        const hasAccess = allowedRoles.some(r => userRoles.includes(r));

        if (hasAccess) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

// Toast Notification System
ui.showToast = (message, type = 'info') => {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-3';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const colors = {
        success: 'bg-green-100 text-green-800 border-green-200',
        error: 'bg-red-100 text-red-800 border-red-200',
        info: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        warning: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };

    const colorClass = colors[type] || colors.info;
    const iconClass = icons[type] || icons.info;

    toast.className = `flex items-center w-full max-w-xs p-4 mb-2 text-gray-500 bg-white rounded-lg shadow border ${colorClass} transition-all duration-300 transform translate-x-full opacity-0`;

    toast.innerHTML = `
        <div class="inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${colorClass}">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="ml-3 text-sm font-normal text-gray-800">${message}</div>
        <button type="button" class="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 text-gray-500" aria-label="Close" onclick="this.parentElement.remove()">
            <span class="sr-only">Close</span>
            <i class="fas fa-times"></i>
        </button>
    `;

    toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });

    // Auto dismiss
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => {
            if (toast.parentElement) toast.parentElement.removeChild(toast);
        }, 300);
    }, 4000);
};
