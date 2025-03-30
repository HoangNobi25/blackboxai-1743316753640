const path = require('path');
const fs = require('fs').promises;
const { isAuthenticated } = require('./authController');

const employeesPath = path.join(__dirname, '../data/employees.json');

// Helper function to validate employee data
const validateEmployee = (data) => {
    const errors = [];
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
    }
    
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Valid email is required');
    }
    
    if (!data.hourlySalaryCZK || isNaN(data.hourlySalaryCZK) || data.hourlySalaryCZK <= 0) {
        errors.push('Hourly salary must be a positive number');
    }
    
    return errors;
};

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
    // Get all employees
    app.get('/api/employees', isAuthenticated, async (req, res) => {
        try {
            const employees = await loadEmployees();
            // Remove sensitive data before sending
            const sanitizedEmployees = employees.map(({ accessToken, ...emp }) => emp);
            res.json({ success: true, data: sanitizedEmployees });
        } catch (error) {
            console.error('Error loading employees:', error);
            res.status(500).json({ success: false, message: 'Error loading employees' });
        }
    });

    // Add new employee
    app.post('/api/employees', isAuthenticated, async (req, res) => {
        try {
            const newEmployee = {
                id: Date.now().toString(),
                name: req.body.name,
                email: req.body.email,
                hourlySalaryCZK: parseFloat(req.body.hourlySalaryCZK),
                createdAt: new Date().toISOString()
            };

            // Validate employee data
            const errors = validateEmployee(newEmployee);
            if (errors.length > 0) {
                return res.status(400).json({ success: false, errors });
            }

            const employees = await loadEmployees();
            
            // Check for duplicate email
            if (employees.some(emp => emp.email === newEmployee.email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Employee with this email already exists'
                });
            }

            employees.push(newEmployee);
            await saveEmployees(employees);

            res.json({ success: true, data: newEmployee });
        } catch (error) {
            console.error('Error adding employee:', error);
            res.status(500).json({ success: false, message: 'Error adding employee' });
        }
    });

    // Update employee
    app.put('/api/employees/:id', isAuthenticated, async (req, res) => {
        try {
            const { id } = req.params;
            const updateData = {
                name: req.body.name,
                email: req.body.email,
                hourlySalaryCZK: parseFloat(req.body.hourlySalaryCZK)
            };

            // Validate update data
            const errors = validateEmployee(updateData);
            if (errors.length > 0) {
                return res.status(400).json({ success: false, errors });
            }

            const employees = await loadEmployees();
            const employeeIndex = employees.findIndex(emp => emp.id === id);

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found'
                });
            }

            // Check for duplicate email, excluding current employee
            if (employees.some(emp => emp.email === updateData.email && emp.id !== id)) {
                return res.status(400).json({
                    success: false,
                    message: 'Another employee with this email already exists'
                });
            }

            // Preserve other fields while updating
            employees[employeeIndex] = {
                ...employees[employeeIndex],
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            await saveEmployees(employees);

            res.json({ success: true, data: employees[employeeIndex] });
        } catch (error) {
            console.error('Error updating employee:', error);
            res.status(500).json({ success: false, message: 'Error updating employee' });
        }
    });

    // Delete employee
    app.delete('/api/employees/:id', isAuthenticated, async (req, res) => {
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

            employees.splice(employeeIndex, 1);
            await saveEmployees(employees);

            res.json({ success: true, message: 'Employee deleted successfully' });
        } catch (error) {
            console.error('Error deleting employee:', error);
            res.status(500).json({ success: false, message: 'Error deleting employee' });
        }
    });
};

module.exports = {
    setupEmployeeRoutes
};