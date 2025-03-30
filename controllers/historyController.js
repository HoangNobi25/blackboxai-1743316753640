const path = require('path');
const fs = require('fs').promises;
const { isAuthenticated } = require('./authController');

const historyPath = path.join(__dirname, '../data/history.json');

// Load history data
const loadHistory = async () => {
    try {
        const data = await fs.readFile(historyPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(historyPath, '[]');
            return [];
        }
        throw error;
    }
};

// Save history data
const saveHistory = async (history) => {
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
};

// Calculate salary for a session
const calculateSalary = (durationMinutes, hourlySalaryCZK) => {
    const hours = durationMinutes / 60;
    return Math.round(hours * hourlySalaryCZK);
};

// Setup history routes
const setupHistoryRoutes = (app) => {
    // Get session history
    app.get('/api/history', isAuthenticated, async (req, res) => {
        try {
            const history = await loadHistory();
            
            // Filter by employee if email provided
            const filteredHistory = req.query.email 
                ? history.filter(record => record.employeeEmail === req.query.email)
                : history;

            // Sort by date descending
            const sortedHistory = filteredHistory.sort((a, b) => 
                new Date(b.endTime) - new Date(a.endTime)
            );

            res.json({ success: true, data: sortedHistory });
        } catch (error) {
            console.error('Error loading history:', error);
            res.status(500).json({ success: false, message: 'Error loading history' });
        }
    });

    // Record new session
    app.post('/api/history', isAuthenticated, async (req, res) => {
        try {
            const {
                startTime,
                endTime,
                sheetId,
                sheetTitle,
                hadModifications
            } = req.body;

            if (!startTime || !endTime || !sheetId || !sheetTitle) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }

            // Calculate duration in minutes
            const start = new Date(startTime);
            const end = new Date(endTime);
            const durationMinutes = Math.round((end - start) / (1000 * 60));

            // Only record if there were modifications or duration is significant
            if (!hadModifications && durationMinutes < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'No significant activity to record'
                });
            }

            const history = await loadHistory();

            const newRecord = {
                id: Date.now().toString(),
                employeeName: req.user.name,
                employeeEmail: req.user.email,
                sheetId,
                sheetTitle,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                durationMinutes,
                hadModifications,
                salaryCZK: calculateSalary(durationMinutes, req.user.hourlySalaryCZK),
                recordedAt: new Date().toISOString()
            };

            history.push(newRecord);
            await saveHistory(history);

            res.json({ success: true, data: newRecord });
        } catch (error) {
            console.error('Error recording history:', error);
            res.status(500).json({ success: false, message: 'Error recording history' });
        }
    });

    // Get summary statistics
    app.get('/api/history/summary', isAuthenticated, async (req, res) => {
        try {
            const history = await loadHistory();
            
            // Filter by date range if provided
            let filteredHistory = history;
            if (req.query.startDate && req.query.endDate) {
                const startDate = new Date(req.query.startDate);
                const endDate = new Date(req.query.endDate);
                filteredHistory = history.filter(record => {
                    const recordDate = new Date(record.startTime);
                    return recordDate >= startDate && recordDate <= endDate;
                });
            }

            // Calculate summary statistics
            const summary = {
                totalSessions: filteredHistory.length,
                totalDurationMinutes: filteredHistory.reduce((sum, record) => 
                    sum + record.durationMinutes, 0),
                totalSalaryCZK: filteredHistory.reduce((sum, record) => 
                    sum + record.salaryCZK, 0),
                sessionsWithModifications: filteredHistory.filter(record => 
                    record.hadModifications).length
            };

            // Add averages if there are sessions
            if (summary.totalSessions > 0) {
                summary.avgDurationMinutes = Math.round(
                    summary.totalDurationMinutes / summary.totalSessions
                );
                summary.avgSalaryCZK = Math.round(
                    summary.totalSalaryCZK / summary.totalSessions
                );
            }

            res.json({ success: true, data: summary });
        } catch (error) {
            console.error('Error generating summary:', error);
            res.status(500).json({ success: false, message: 'Error generating summary' });
        }
    });
};

module.exports = {
    setupHistoryRoutes
};