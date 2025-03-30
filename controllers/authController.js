const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcrypt');
const keys = require('../config/keys');
const path = require('path');
const fs = require('fs').promises;

// Load or create employee data file
const employeesPath = path.join(__dirname, '../data/employees.json');

// Ensure data directory exists
const ensureDataDir = async () => {
    const dataDir = path.join(__dirname, '../data');
    try {
        await fs.access(dataDir);
    } catch {
        await fs.mkdir(dataDir);
    }
};

// Load employees data
const loadEmployees = async () => {
    await ensureDataDir();
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

// Passport configuration
passport.serializeUser((user, done) => {
    done(null, user.email);
});

passport.deserializeUser(async (email, done) => {
    try {
        const employees = await loadEmployees();
        const employee = employees.find(emp => emp.email === email);
        done(null, employee || null);
    } catch (error) {
        done(error, null);
    }
});

// Set up Google Strategy for admin
passport.use(new GoogleStrategy({
    clientID: keys.google.clientID,
    clientSecret: keys.google.clientSecret,
    callbackURL: 'http://localhost:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const employees = await loadEmployees();
        const existingEmployee = employees.find(emp => emp.email === profile.emails[0].value);
        
        if (existingEmployee && existingEmployee.isAdmin) {
            return done(null, existingEmployee);
        }
        
        // If not admin or not found, return null
        done(null, null);
    } catch (error) {
        done(error, null);
    }
}));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ success: false, message: 'Not authenticated' });
};

// Admin middleware
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.isAdmin) {
        return next();
    }
    res.status(403).json({ success: false, message: 'Admin access required' });
};

// Setup auth routes
const setupAuthRoutes = (app) => {
    // Employee login route
    app.post('/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const employees = await loadEmployees();
            const employee = employees.find(emp => emp.email === email);

            if (!employee || employee.isAdmin) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            const isValidPassword = await bcrypt.compare(password, employee.password);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Log in the employee
            req.login(employee, (err) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: 'Login failed'
                    });
                }
                res.json({
                    success: true,
                    message: 'Login successful'
                });
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Login failed'
            });
        }
    });

    // Admin Google OAuth routes
    app.get('/auth/google',
        passport.authenticate('google', {
            scope: [
                'profile',
                'email',
                'https://www.googleapis.com/auth/spreadsheets.readonly'
            ]
        })
    );

    app.get('/auth/google/callback',
        passport.authenticate('google', { failureRedirect: '/login' }),
        (req, res) => {
            if (!req.user) {
                return res.redirect('/unauthorized.html');
            }
            if (req.user.isAdmin) {
                return res.redirect('/admin.html');
            }
            res.redirect('/dashboard.html');
        }
    );

    // Logout route
    app.get('/auth/logout', (req, res) => {
        req.logout(() => {
            res.redirect('/login.html');
        });
    });

    // Check auth status
    app.get('/auth/status', (req, res) => {
        res.json({
            authenticated: req.isAuthenticated(),
            user: req.user || null
        });
    });
};

module.exports = {
    setupAuthRoutes,
    isAuthenticated,
    isAdmin
};