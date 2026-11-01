require('dotenv').config();
const app = require('./app');
const pool = require('./config/db');
const PORT = process.env.PORT || 5000;

async function startServer() {
    await pool.query('SELECT 1');
    console.log('MYSQL DATABASE CONNECTED');

    const server = app.listen(PORT, () => {
        console.log(`Server running on PORT ${PORT}`);
    });

    server.on('error', (error) => {
        console.error(`HTTP SERVER FAILED TO LISTEN ON PORT ${PORT}:`, error);
        process.exitCode = 1;
    });

    return server;
}

startServer().catch((error) => {
    console.error('MYSQL CONNECTION FAILED:', error);
    process.exitCode = 1;
});
