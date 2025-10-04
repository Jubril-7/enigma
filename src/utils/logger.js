const fs = require('fs').promises;
const path = require('path');

async function logMessage(level, message) {
    const logDir = path.join(__dirname, '../../logs');
    await fs.mkdir(logDir, { recursive: true }); // Create logs directory if it doesn't exist
    const logEntry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}\n`;
    await fs.appendFile(path.join(logDir, 'bot.log'), logEntry);
}

module.exports = { logMessage };