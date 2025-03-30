require('dotenv').config();

module.exports = {
    google: {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS
    },
    session: {
        secret: process.env.SESSION_SECRET
    },
    server: {
        port: process.env.PORT || 3000
    }
};

// Validate required environment variables
const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'SESSION_SECRET',
    'GOOGLE_APPLICATION_CREDENTIALS'
];

requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`Error: Environment variable ${varName} is not set`);
        console.error('Please check your .env file and ensure all required variables are set');
        process.exit(1);
    }
});