document.addEventListener('DOMContentLoaded', () => {
    fetchUsers();

    // Ensure role check
    const role = localStorage.getItem('role') || '';
    if (!role.includes('admin')) {
        alert("Access Denied");
        window.location.href = '/dashboard.html';
    }
});

const userModal = document.getElementById('userModal');
const userForm = document.getElementById('userForm');
const modalTitle = document.getElementById('modalTitle');
const passHelp = document.getElementById('passHelp');

// Password Toggle
document.getElementById('togglePasswordBtn').addEventListener('click', function () {
    const input = document.getElementById('inputPassword');
    const icon = this.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
});

async function fetchUsers() {
    try {
        const res = await fetch('api/users.php?action=list');
        const data = await res.json();
        const listContainer = document.getElementById('usersList');

        if (data.success) {
            listContainer.innerHTML = '';
            if (data.data.length === 0) {
                listContainer.innerHTML = '<div class="text-center py-8 text-gray-500">No users found</div>';
                return;
            }

            data.data.forEach(user => {
                const item = document.createElement('div');
                item.className = 'grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-4 md:px-6 md:py-3 bg-white items-start md:items-center hover:bg-gray-50 transition-colors';

                // Format Role badges
                const roles = user.role.split(',').map(r =>
                    `<span class="inline-block bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded border border-indigo-100 capitalize mr-1">${r}</span>`
                ).join('');

                item.innerHTML = `
                    <!-- User Info (Mobile: Header) -->
                    <div class="col-span-1 md:col-span-3 flex items-center w-full">
                        <div class="h-10 w-10 md:h-8 md:w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold mr-3 flex-shrink-0">
                            ${user.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="flex flex-col md:flex-row md:items-center gap-1">
                            <div class="text-sm font-bold md:font-medium text-gray-900">${user.username}</div>
                        </div>
                    </div>

                    <!-- Role -->
                    <div class="col-span-1 md:col-span-2 flex items-center gap-2">
                         <span class="md:hidden text-xs text-gray-500 font-bold uppercase w-20">Role:</span>
                         <div class="flex flex-wrap gap-1">${roles}</div>
                    </div>

                    <!-- Created At -->
                    <div class="col-span-1 md:col-span-2 text-sm text-gray-500 flex items-center gap-2">
                        <span class="md:hidden text-xs text-gray-500 font-bold uppercase w-20">Created:</span>
                        ${user.created_at ? formatTimestamp(user.created_at) : '-'}
                    </div>

                    <!-- Contact -->
                    <div class="col-span-1 md:col-span-2 text-sm text-gray-500 space-y-1">
                        <div class="flex items-center gap-2">
                             <span class="md:hidden text-xs text-gray-500 font-bold uppercase w-20">Mobile:</span>
                             <div>
                                <div><i class="fas fa-phone text-xs w-4"></i> ${user.mobile1 || '-'}</div>
                                ${user.mobile2 ? `<div><i class="fas fa-phone text-xs w-4"></i> ${user.mobile2}</div>` : ''}
                             </div>
                        </div>
                    </div>

                    <!-- Address/UID -->
                    <div class="col-span-1 md:col-span-2 text-sm text-gray-500 flex items-start gap-2 max-w-xs">
                         <span class="md:hidden text-xs text-gray-500 font-bold uppercase w-20 flex-shrink-0">Address:</span>
                         <div>
                            <div class="font-medium text-gray-700 mb-1">UID: ${user.aadhar_number || '-'}</div>
                            <div class="truncate line-clamp-2 md:line-clamp-1" title="${user.address}">${user.address || '-'}</div>
                         </div>
                    </div>

                    <!-- Actions -->
                    <div class="col-span-1 md:col-span-1 flex justify-end md:justify-end gap-3 md:gap-2 mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-0 border-gray-100 w-full md:w-auto">
                        <button onclick="editUser(${user.sno})" class="flex-1 md:flex-none text-indigo-600 hover:text-indigo-900 transition-colors bg-indigo-50 p-2 rounded hover:bg-indigo-100 text-center" title="Edit">
                            <i class="fas fa-edit"></i> <span class="md:hidden ml-1 font-medium">Edit</span>
                        </button>
                        <button onclick="deleteUser(${user.sno})" class="flex-1 md:flex-none text-red-600 hover:text-red-900 transition-colors bg-red-50 p-2 rounded hover:bg-red-100 text-center" title="Delete">
                            <i class="fas fa-trash-alt"></i> <span class="md:hidden ml-1 font-medium">Delete</span>
                        </button>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        }
    } catch (e) {
        console.error(e);
        document.getElementById('usersList').innerHTML = '<div class="text-center py-8 text-red-500">Error loading users</div>';
    }
}

function openUserModal() {
    userForm.reset();
    document.getElementById('userId').value = '';
    modalTitle.textContent = 'Add User';
    passHelp.textContent = 'Required for new users';

    // Reset Password Visibility
    const passInput = document.getElementById('inputPassword');
    const passIcon = document.getElementById('togglePasswordBtn').querySelector('i');
    passInput.type = 'password';
    passIcon.classList.remove('fa-eye-slash');
    passIcon.classList.add('fa-eye');

    // Clear role selection
    Array.from(document.getElementById('inputRole').options).forEach(opt => opt.selected = false);

    userModal.classList.remove('hidden');
}

function closeUserModal() {
    userModal.classList.add('hidden');
}

async function editUser(id) {
    try {
        const res = await fetch(`api/users.php?action=get&id=${id}`);
        const data = await res.json();

        if (data.success) {
            const u = data.data;
            document.getElementById('userId').value = u.sno;
            document.getElementById('inputUsername').value = u.username;
            document.getElementById('inputPassword').value = u.password; // Populate password
            document.getElementById('inputMobile1').value = u.mobile1;
            document.getElementById('inputMobile2').value = u.mobile2;
            document.getElementById('inputAadhar').value = u.aadhar_number;
            document.getElementById('inputAddress').value = u.address;

            // Set Roles
            const roles = u.role.split(',');
            const select = document.getElementById('inputRole');
            Array.from(select.options).forEach(opt => {
                opt.selected = roles.includes(opt.value);
            });

            modalTitle.textContent = 'Edit User';
            passHelp.textContent = 'Modify to change password';
            userModal.classList.remove('hidden');
        }
    } catch (e) { console.error(e); }
}

userForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('userId').value;
    const isEdit = !!id;

    const formData = new FormData(userForm);
    const body = Object.fromEntries(formData.entries());

    // Handle Roles
    const roles = Array.from(userForm.role.selectedOptions).map(o => o.value).join(',');
    body.role = roles;

    if (isEdit) body.id = id;

    const action = isEdit ? 'update' : 'create';

    try {
        const res = await fetch(`api/users.php?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (data.success) {
            closeUserModal();
            fetchUsers();
            ui.showToast(`User ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        } else {
            alert(data.message);
        }
    } catch (e) {
        console.error(e);
        alert('Operation failed');
    }
});

async function deleteUser(id) {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
        const res = await fetch(`api/users.php?action=delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();

        if (data.success) {
            fetchUsers();
            ui.showToast('User deleted', 'info');
        } else {
            alert(data.message);
        }
    } catch (e) { alert('Delete failed'); }
}

// Close on background click
userModal.addEventListener('click', (e) => {
    if (e.target === userModal) closeUserModal();
});
