require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const passport = require('passport');
const morgan = require('morgan');
const path = require('path');

// Initialize Express app
const app = express();

// Middleware
app.use(morgan('dev')); // Logging
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(cookieSession({
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    keys: [process.env.SESSION_SECRET]
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Import controllers
const { setupAuthRoutes } = require('./controllers/authController');
const { setupEmployeeRoutes } = require('./controllers/employeeController');
const { setupSheetRoutes } = require('./controllers/sheetController');
const { setupHistoryRoutes } = require('./controllers/historyController');

// Set up routes
setupAuthRoutes(app);
setupEmployeeRoutes(app);
setupSheetRoutes(app);
setupHistoryRoutes(app);

// Default route for the root path
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Handle 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});