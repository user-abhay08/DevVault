const mysql = require("mysql2/promise");
const express = require("express");
const router = express.Router();

const db = require("../config/db");
const authMiddleware = require("../middleware/auth.middleware");

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = pool;