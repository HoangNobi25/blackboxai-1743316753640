const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const { setupAuthRoutes } = require('./controllers/authController');
const { setupEmployeeRoutes } = require('./controllers/employeeController');
const { setupSheetRoutes } = require('./controllers/sheetController');
const { setupHistoryRoutes } = require('./controllers/historyController');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secure_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Routes
setupAuthRoutes(app);
setupEmployeeRoutes(app);
setupSheetRoutes(app);
setupHistoryRoutes(app);

// Default route redirects to login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});