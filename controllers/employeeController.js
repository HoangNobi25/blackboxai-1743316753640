const path = require('path');
const fs = require('fs').promises;
const bcrypt = require('bcrypt');
const { isAuthenticated, isAdmin } = require('./authController');

const employeesPath = path.join(__dirname, '../data/employees.json');

// Load employees data
const loadEmployees = async () => {
    try {
        const data = await fs.readFile(employeesPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(employeesPath, '[]');
            return [];
        }
        throw error;
    }
};

// Save employees data
const saveEmployees = async (employees) => {
    await fs.writeFile(employeesPath, JSON.stringify(employees, null, 2));
};

// Setup employee routes
const setupEmployeeRoutes = (app) => {
    // Get all employees (admin only)
    app.get('/api/employees', isAuthenticated, isAdmin, async (req, res) => {
        try {
            const employees = await loadEmployees();
            // Don't send password hashes to frontend
            const sanitizedEmployees = employees.map(({ password, ...emp }) => emp);
            res.json({ success: true, data: sanitizedEmployees });
        } catch (error) {
            console.error('Error loading employees:', error);
            res.status(500).json({
                success: false,
                message: 'Error loading employees'
            });
        }
    });

    // Add new employee (admin only)
    app.post('/api/employees', isAuthenticated, isAdmin, async (req, res) => {
        try {
            const { name, email, password, hourlySalaryCZK } = req.body;

            if (!name || !email || !password || !hourlySalaryCZK) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            const employees = await loadEmployees();
            
            // Check for duplicate email
            if (employees.some(emp => emp.email === email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Employee with this email already exists'
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            const newEmployee = {
                id: Date.now().toString(),
                name,
                email,
                password: hashedPassword,
                hourlySalaryCZK,
                createdAt: new Date().toISOString(),
                isAdmin: email === process.env.ADMIN_EMAIL
            };

            employees.push(newEmployee);
            await saveEmployees(employees);

            // Don't send password hash back
            const { password: _, ...employeeWithoutPassword } = newEmployee;
            res.json({ success: true, data: employeeWithoutPassword });
        } catch (error) {
            console.error('Error adding employee:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding employee'
            });
        }
    });

    // Update employee password
    app.put('/api/employees/password', isAuthenticated, async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            const employees = await loadEmployees();
            const employeeIndex = employees.findIndex(emp => emp.email === req.user.email);

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, employees[employeeIndex].password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
            }

            // Hash and update new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            employees[employeeIndex].password = hashedPassword;
            await saveEmployees(employees);

            res.json({
                success: true,
                message: 'Password updated successfully'
            });
        } catch (error) {
            console.error('Error updating password:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating password'
            });
        }
    });

    // Reset employee password (admin only)
    app.post('/api/employees/:id/reset-password', isAuthenticated, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { newPassword } = req.body;
            const employees = await loadEmployees();
            const employeeIndex = employees.findIndex(emp => emp.id === id);

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            // Hash and update password
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            employees[employeeIndex].password = hashedPassword;
            await saveEmployees(employees);

            res.json({
                success: true,
                message: 'Password reset successfully'
            });
        } catch (error) {
            console.error('Error resetting password:', error);
            res.status(500).json({
                success: false,
                message: 'Error resetting password'
            });
        }
    });

    // Delete employee (admin only)
    app.delete('/api/employees/:id', isAuthenticated, isAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const employees = await loadEmployees();
            
            const employeeIndex = employees.findIndex(emp => emp.id === id);
            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            // Prevent deleting the admin account
            if (employees[employeeIndex].email === process.env.ADMIN_EMAIL) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot delete admin account'
                });
            }

            employees.splice(employeeIndex, 1);
            await saveEmployees(employees);

            res.json({
                success: true,
                message: 'Employee deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting employee:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting employee'
            });
        }
    });

    // Get current employee profile
    app.get('/api/employees/profile', isAuthenticated, async (req, res) => {
        try {
            const employees = await loadEmployees();
            const employee = employees.find(emp => emp.email === req.user.email);
            
            if (!employee) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee profile not found'
                });
            }

            // Don't send password hash
            const { password, ...employeeWithoutPassword } = employee;
            res.json({ success: true, data: employeeWithoutPassword });
        } catch (error) {
            console.error('Error loading profile:', error);
            res.status(500).json({
                success: false,
                message: 'Error loading profile'
            });
        }
    });
};

module.exports = {
    setupEmployeeRoutes
};