const CONFIG = {
    // Base URL for product images. 
    // If running locally but fetching images from server, use absolute URL.
    // If running on server, you can use relative path '/assets/images/products/' or absolute.
    IMAGE_BASE_URL: "uploads/default/products/"
};

(function () {
    let subdomain = 'default';
    const host = window.location.hostname;
    const parts = host.split('.');

    // Logic matches PHP: if host parts >= 3 (e.g. sub.domain.com), take the first part
    if (parts.length >= 3) {
        subdomain = parts[0];
    }

    CONFIG.IMAGE_BASE_URL = `uploads/${subdomain}/products/`;
})();

// Global Date Formatter (dd/mm/yy hh:mm)
function formatTimestamp(dateString) {
    if (!dateString || dateString === '0000-00-00 00:00:00') return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
}
