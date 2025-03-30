// Check if user is admin and authenticated
const checkAuth = async () => {
    try {
        const response = await fetch('/auth/status');
        const data = await response.json();
        
        if (!data.authenticated || !data.user.isAdmin) {
            window.location.href = '/unauthorized.html';
            return null;
        }
        
        return data.user;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
        return null;
    }
};

// Update admin info in header
const updateAdminInfo = (admin) => {
    const adminInfo = document.getElementById('adminInfo');
    adminInfo.innerHTML = `
        <p class="text-sm font-medium text-gray-900">${admin.name}</p>
        <p class="text-xs text-gray-600">${admin.email}</p>
    `;
};

// Load and display employees
const loadEmployees = async () => {
    try {
        const response = await fetch('/api/employees');
        const { data: employees } = await response.json();
        
        const tbody = document.getElementById('employeeTableBody');
        tbody.innerHTML = employees.map(employee => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${employee.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${employee.email}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${employee.hourlySalaryCZK}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(employee.createdAt).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 space-x-2">
                    <button onclick="openResetPasswordModal('${employee.id}')"
                            class="text-blue-600 hover:text-blue-800">
                        <i class="fas fa-key"></i>
                    </button>
                    <button onclick="deleteEmployee('${employee.id}')"
                            class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading employees:', error);
    }
};

// Add new employee
const addEmployee = async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const employeeData = {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        hourlySalaryCZK: parseInt(formData.get('hourlySalaryCZK'))
    };
    
    try {
        const response = await fetch('/api/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employeeData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeAddEmployeeModal();
            await loadEmployees();
            event.target.reset();
        } else {
            alert(result.message || 'Failed to add employee');
        }
    } catch (error) {
        console.error('Error adding employee:', error);
        alert('Failed to add employee');
    }
};

// Reset employee password
const resetPassword = async (event) => {
    event.preventDefault();
    
    const employeeId = document.getElementById('resetEmployeeId').value;
    const newPassword = event.target.newPassword.value;
    
    try {
        const response = await fetch(`/api/employees/${employeeId}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword })
        });
        
        const result = await response.json();
        
        if (result.success) {
            closeResetPasswordModal();
            alert('Password reset successfully');
        } else {
            alert(result.message || 'Failed to reset password');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        alert('Failed to reset password');
    }
};

// Delete employee
const deleteEmployee = async (employeeId) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    
    try {
        const response = await fetch(`/api/employees/${employeeId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadEmployees();
        } else {
            alert(result.message || 'Failed to delete employee');
        }
    } catch (error) {
        console.error('Error deleting employee:', error);
        alert('Failed to delete employee');
    }
};

// Modal management
const openAddEmployeeModal = () => {
    document.getElementById('addEmployeeModal').classList.remove('hidden');
};

const closeAddEmployeeModal = () => {
    document.getElementById('addEmployeeModal').classList.add('hidden');
    document.getElementById('addEmployeeForm').reset();
};

const openResetPasswordModal = (employeeId) => {
    document.getElementById('resetEmployeeId').value = employeeId;
    document.getElementById('resetPasswordModal').classList.remove('hidden');
};

const closeResetPasswordModal = () => {
    document.getElementById('resetPasswordModal').classList.add('hidden');
    document.getElementById('resetPasswordForm').reset();
};

// Logout
const logout = () => {
    window.location.href = '/auth/logout';
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const admin = await checkAuth();
    if (!admin) return;
    
    updateAdminInfo(admin);
    await loadEmployees();
    
    // Set up event listeners
    document.getElementById('addEmployeeForm').addEventListener('submit', addEmployee);
    document.getElementById('resetPasswordForm').addEventListener('submit', resetPassword);
    
    // Close modals when clicking outside
    document.getElementById('addEmployeeModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeAddEmployeeModal();
        }
    });
    
    document.getElementById('resetPasswordModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeResetPasswordModal();
        }
    });
});