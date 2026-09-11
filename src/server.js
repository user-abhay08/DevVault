require('dotenv').config();
const app = require ('./app');
const pool = require('./config/db');
const PORT = process.env.PORT || 5000;

async function startServer(){
    try{
        await pool.query('SELECT 1');
        console.log('MYSQL DATABSE CONNECTED');

        app.listen(PORT,() =>{
            console.log(`Server running on PORT ${PORT}`);
        });
    } catch(error){
        console.log('MYSQL CONNECTION FAILED',error.message);
    }
}

startServer();  