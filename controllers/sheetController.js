const path = require('path');
const fs = require('fs').promises;
const { google } = require('googleapis');
const { isAuthenticated } = require('./authController');

const sheetsPath = path.join(__dirname, '../data/sheets.json');

// Helper function to validate Google Sheet URL/ID
const validateSheetId = (input) => {
    // Extract sheet ID from URL if URL is provided
    if (input.includes('spreadsheets/d/')) {
        const matches = input.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        return matches ? matches[1] : null;
    }
    // If not URL, assume it's a direct sheet ID
    return input.match(/^[a-zA-Z0-9-_]+$/) ? input : null;
};

// Initialize Google Sheets API
const getGoogleSheetsApi = async (accessToken) => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.sheets({ version: 'v4', auth });
};

// Load sheets data
const loadSheets = async () => {
    try {
        const data = await fs.readFile(sheetsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(sheetsPath, '[]');
            return [];
        }
        throw error;
    }
};

// Save sheets data
const saveSheets = async (sheets) => {
    await fs.writeFile(sheetsPath, JSON.stringify(sheets, null, 2));
};

// Verify sheet access and get metadata
const verifySheetAccess = async (sheetId, accessToken) => {
    try {
        const sheets = await getGoogleSheetsApi(accessToken);
        const response = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            fields: 'properties.title,properties.modifiedTime'
        });
        
        return {
            title: response.data.properties.title,
            lastModified: response.data.properties.modifiedTime
        };
    } catch (error) {
        console.error('Error verifying sheet access:', error);
        return null;
    }
};

// Setup sheet routes
const setupSheetRoutes = (app) => {
    // Get all tracked sheets
    app.get('/api/sheets', isAuthenticated, async (req, res) => {
        try {
            const sheets = await loadSheets();
            res.json({ success: true, data: sheets });
        } catch (error) {
            console.error('Error loading sheets:', error);
            res.status(500).json({ success: false, message: 'Error loading sheets' });
        }
    });

    // Add new sheet to track
    app.post('/api/sheets', isAuthenticated, async (req, res) => {
        try {
            const { sheetUrl } = req.body;
            const sheetId = validateSheetId(sheetUrl);

            if (!sheetId) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Google Sheet URL or ID'
                });
            }

            // Verify sheet access
            const sheetInfo = await verifySheetAccess(sheetId, req.user.accessToken);
            if (!sheetInfo) {
                return res.status(400).json({
                    success: false,
                    message: 'Unable to access this Google Sheet'
                });
            }

            const sheets = await loadSheets();
            
            // Check for duplicate
            if (sheets.some(sheet => sheet.id === sheetId)) {
                return res.status(400).json({
                    success: false,
                    message: 'This sheet is already being tracked'
                });
            }

            const newSheet = {
                id: sheetId,
                title: sheetInfo.title,
                addedAt: new Date().toISOString(),
                lastModified: sheetInfo.lastModified,
                addedBy: req.user.email
            };

            sheets.push(newSheet);
            await saveSheets(sheets);

            res.json({ success: true, data: newSheet });
        } catch (error) {
            console.error('Error adding sheet:', error);
            res.status(500).json({ success: false, message: 'Error adding sheet' });
        }
    });

    // Delete tracked sheet
    app.delete('/api/sheets/:id', isAuthenticated, async (req, res) => {
        try {
            const { id } = req.params;
            const sheets = await loadSheets();
            
            const sheetIndex = sheets.findIndex(sheet => sheet.id === id);
            if (sheetIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: 'Sheet not found'
                });
            }

            sheets.splice(sheetIndex, 1);
            await saveSheets(sheets);

            res.json({ success: true, message: 'Sheet removed from tracking' });
        } catch (error) {
            console.error('Error deleting sheet:', error);
            res.status(500).json({ success: false, message: 'Error removing sheet' });
        }
    });

    // Check sheet modifications
    app.get('/api/sheets/:id/status', isAuthenticated, async (req, res) => {
        try {
            const { id } = req.params;
            const sheetInfo = await verifySheetAccess(id, req.user.accessToken);
            
            if (!sheetInfo) {
                return res.status(404).json({
                    success: false,
                    message: 'Unable to access sheet'
                });
            }

            const sheets = await loadSheets();
            const sheet = sheets.find(s => s.id === id);
            
            if (!sheet) {
                return res.status(404).json({
                    success: false,
                    message: 'Sheet not found in tracking list'
                });
            }

            const hasChanges = new Date(sheetInfo.lastModified) > new Date(sheet.lastModified);
            
            if (hasChanges) {
                sheet.lastModified = sheetInfo.lastModified;
                await saveSheets(sheets);
            }

            res.json({
                success: true,
                data: {
                    hasChanges,
                    lastModified: sheetInfo.lastModified
                }
            });
        } catch (error) {
            console.error('Error checking sheet status:', error);
            res.status(500).json({ success: false, message: 'Error checking sheet status' });
        }
    });
};

module.exports = {
    setupSheetRoutes
};