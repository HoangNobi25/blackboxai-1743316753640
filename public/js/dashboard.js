// Global variables for tracking session
let activeSession = null;
let sessionTimer = null;
let lastModificationCheck = null;

// Utility functions
const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
};

const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

// Authentication and user info
const checkAuth = async () => {
    try {
        const response = await fetch('/auth/status');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return null;
        }
        
        return data.user;
    } catch (error) {
        console.error('Auth check failed:', error);
        return null;
    }
};

const updateUserInfo = (user) => {
    const userInfo = document.getElementById('userInfo');
    userInfo.innerHTML = `
        <p class="text-sm font-medium text-gray-900">${user.name}</p>
        <p class="text-xs text-gray-600">${user.email}</p>
    `;
};

const logout = () => {
    window.location.href = '/auth/logout';
};

// Sheet management
const loadSheets = async () => {
    try {
        const response = await fetch('/api/sheets');
        const { data: sheets } = await response.json();
        
        const sheetsList = document.getElementById('sheetsList');
        sheetsList.innerHTML = sheets.map(sheet => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">${sheet.title}</p>
                    <p class="text-xs text-gray-500 truncate">${sheet.id}</p>
                </div>
                <button onclick="deleteSheet('${sheet.id}')" 
                        class="ml-2 text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading sheets:', error);
    }
};

const addSheet = async (event) => {
    event.preventDefault();
    
    const input = document.getElementById('sheetUrl');
    const sheetUrl = input.value.trim();
    
    if (!sheetUrl) return;
    
    try {
        const response = await fetch('/api/sheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sheetUrl })
        });
        
        const result = await response.json();
        
        if (result.success) {
            input.value = '';
            await loadSheets();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error adding sheet:', error);
        alert('Failed to add sheet');
    }
};

const deleteSheet = async (sheetId) => {
    if (!confirm('Are you sure you want to remove this sheet from tracking?')) return;
    
    try {
        const response = await fetch(`/api/sheets/${sheetId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadSheets();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error deleting sheet:', error);
        alert('Failed to delete sheet');
    }
};

// Session tracking
const startSession = (sheetId, sheetTitle) => {
    if (activeSession) return;
    
    activeSession = {
        sheetId,
        sheetTitle,
        startTime: new Date().toISOString(),
        seconds: 0
    };
    
    // Update UI
    document.getElementById('noActiveSession').classList.add('hidden');
    document.getElementById('activeSessionDetails').classList.remove('hidden');
    document.getElementById('activeSheetTitle').textContent = sheetTitle;
    document.getElementById('activeSheetId').textContent = sheetId;
    
    // Start timer
    sessionTimer = setInterval(() => {
        activeSession.seconds++;
        document.getElementById('activeTimer').textContent = formatTime(activeSession.seconds);
    }, 1000);
    
    // Start modification checks
    startModificationChecks();
};

const endSession = async () => {
    if (!activeSession) return;
    
    clearInterval(sessionTimer);
    clearInterval(lastModificationCheck);
    
    const endTime = new Date().toISOString();
    
    try {
        await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                startTime: activeSession.startTime,
                endTime,
                sheetId: activeSession.sheetId,
                sheetTitle: activeSession.sheetTitle,
                hadModifications: activeSession.hadModifications || false
            })
        });
        
        // Reset session
        activeSession = null;
        document.getElementById('noActiveSession').classList.remove('hidden');
        document.getElementById('activeSessionDetails').classList.add('hidden');
        document.getElementById('lastModification').textContent = 'Never';
        
        // Refresh history
        await loadHistory();
        await loadSummary();
    } catch (error) {
        console.error('Error ending session:', error);
    }
};

const startModificationChecks = () => {
    lastModificationCheck = setInterval(async () => {
        if (!activeSession) return;
        
        try {
            const response = await fetch(`/api/sheets/${activeSession.sheetId}/status`);
            const { data } = await response.json();
            
            if (data.hasChanges) {
                activeSession.hadModifications = true;
                document.getElementById('lastModification').textContent = formatDate(data.lastModified);
            }
        } catch (error) {
            console.error('Error checking modifications:', error);
        }
    }, 30000); // Check every 30 seconds
};

// History management
const loadHistory = async () => {
    try {
        const filter = document.getElementById('historyFilter').value;
        let url = '/api/history';
        
        // Add date filtering
        if (filter !== 'all') {
            const now = new Date();
            let startDate = new Date();
            
            switch (filter) {
                case 'today':
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(now.getMonth() - 1);
                    break;
            }
            
            url += `?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`;
        }
        
        const response = await fetch(url);
        const { data: history } = await response.json();
        
        const tbody = document.getElementById('historyTableBody');
        tbody.innerHTML = history.map(record => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${formatDate(record.startTime)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${record.sheetTitle}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${formatDuration(record.durationMinutes)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    ${record.hadModifications 
                        ? '<span class="text-green-600"><i class="fas fa-check-circle mr-1"></i>Modified</span>'
                        : '<span class="text-gray-500"><i class="fas fa-eye mr-1"></i>Viewed</span>'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${record.salaryCZK.toLocaleString()}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading history:', error);
    }
};

const loadSummary = async () => {
    try {
        const filter = document.getElementById('historyFilter').value;
        let url = '/api/history/summary';
        
        // Add date filtering
        if (filter !== 'all') {
            const now = new Date();
            let startDate = new Date();
            
            switch (filter) {
                case 'today':
                    startDate.setHours(0, 0, 0, 0);
                    break;
                case 'week':
                    startDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(now.getMonth() - 1);
                    break;
            }
            
            url += `?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}`;
        }
        
        const response = await fetch(url);
        const { data: summary } = await response.json();
        
        document.getElementById('totalSessions').textContent = summary.totalSessions;
        document.getElementById('totalHours').textContent = 
            formatDuration(summary.totalDurationMinutes);
        document.getElementById('activeSessions').textContent = 
            summary.sessionsWithModifications;
        document.getElementById('totalSalary').textContent = 
            summary.totalSalaryCZK.toLocaleString();
    } catch (error) {
        console.error('Error loading summary:', error);
    }
};

// Event listeners
document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    
    updateUserInfo(user);
    await loadSheets();
    await loadHistory();
    await loadSummary();
    
    // Set up event listeners
    document.getElementById('addSheetForm').addEventListener('submit', addSheet);
    document.getElementById('historyFilter').addEventListener('change', async () => {
        await loadHistory();
        await loadSummary();
    });
});

// Handle page unload
window.addEventListener('beforeunload', async (event) => {
    if (activeSession) {
        event.preventDefault();
        event.returnValue = '';
        await endSession();
    }
});