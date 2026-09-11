const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/role.middleware");
const router = express.Router();

// GET ROUTE
router.get("/test", (req, res) => {
    res.json({
        message: "Auth route working"
    });
});
router.get(
    "/admin",
    authenticateToken,
    authorizeRole("admin"),
    (req,res) =>{
        res.json({
            message: "Welcome Admin",
            user: req.user
        });
    }
);

router.get("/me", authenticateToken, async (req, res) => {
    const [users] = await pool.query(
        "SELECT id, name, email, created_at FROM users WHERE id = ?",
        [req.user.userId]
    );

    if (users.length === 0) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    res.json(users[0]);
});

// POST ROUTE
router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({
            message: "Name, email and password are required"
        });
    }
    if(password.length < 6){
        return res.status(400).json({
            message:"Password must be at least 6 characters"
        });
    }
    const [existingUsers] = await pool.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
    );

    if (existingUsers.length > 0) {
        return res.status(409).json({
            message: "Email already registered"
        });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashedPassword]
    );

    res.status(201).json({
        message: "User registered successfully",
        userId: result.insertId
    });
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    const [users] = await pool.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
    );

    if (users.length === 0) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!passwordMatch) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const token = jwt.sign(
        { 
            userId: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        { 
            expiresIn: "1h"
        }
    );

    res.json({
        message: "Login successful",
        token
    });
});



module.exports = router;