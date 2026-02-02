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
        const tbody = document.getElementById('usersTableBody');

        if (data.success) {
            tbody.innerHTML = '';
            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">No users found</td></tr>';
                return;
            }

            data.data.forEach(user => {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0';

                // Format Role badges
                const roles = user.role.split(',').map(r =>
                    `<span class="inline-block bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded border border-indigo-100 capitalize mr-1">${r}</span>`
                ).join('');

                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <div class="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold mr-3">
                                ${user.username.charAt(0).toUpperCase()}
                            </div>
                            <div class="text-sm font-medium text-gray-900">${user.username}</div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        ${roles}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        ${user.created_at ? formatTimestamp(user.created_at) : '-'}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                        <div><i class="fas fa-phone text-xs w-4"></i> ${user.mobile1 || '-'}</div>
                        ${user.mobile2 ? `<div><i class="fas fa-phone text-xs w-4"></i> ${user.mobile2}</div>` : ''}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        <div class="font-medium text-gray-700 mb-1">UID: ${user.aadhar_number || '-'}</div>
                        <div class="truncate" title="${user.address}">${user.address || '-'}</div>
                    </td>
                    <td class="px-6 py-4 text-right text-sm font-medium">
                        <button onclick="editUser(${user.sno})" class="text-indigo-600 hover:text-indigo-900 mr-3 transition-colors bg-indigo-50 p-2 rounded hover:bg-indigo-100" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteUser(${user.sno})" class="text-red-600 hover:text-red-900 transition-colors bg-red-50 p-2 rounded hover:bg-red-100" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error(e);
        document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading users</td></tr>';
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
