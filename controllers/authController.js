const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
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
        // If file doesn't exist, create it with empty array
        if (error.code === 'ENOENT') {
            await fs.writeFile(employeesPath, '[]');
            return [];
        }
        throw error;
    }
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

// Set up Google Strategy
passport.use(new GoogleStrategy({
    clientID: keys.google.clientID,
    clientSecret: keys.google.clientSecret,
    callbackURL: 'http://localhost:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const employees = await loadEmployees();
        const existingEmployee = employees.find(emp => emp.email === profile.emails[0].value);
        
        if (existingEmployee) {
            // Update access token for future Google Sheets API calls
            existingEmployee.accessToken = accessToken;
            await fs.writeFile(employeesPath, JSON.stringify(employees, null, 2));
            return done(null, existingEmployee);
        }
        
        // If employee not found, return null (they need to be added by admin)
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

// Auth routes
const setupAuthRoutes = (app) => {
    // Google OAuth routes
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
                // User's email not in employee list
                return res.redirect('/unauthorized.html');
            }
            res.redirect('/dashboard.html');
        }
    );

    // Logout route
    app.get('/auth/logout', (req, res) => {
        req.logout();
        res.redirect('/login.html');
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
    isAuthenticated
};