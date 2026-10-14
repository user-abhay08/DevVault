const express = require("express");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth.middleware");

const router = express.Router();

// Account creation must go through /auth/register so passwords are hashed.
router.post("/", (req, res) => res.status(410).json({
    message: "Use /api/auth/register to create an account"
}));

router.get("/:id", authenticateToken, async (req, res) => {
    if (!/^\d+$/.test(req.params.id) || Number(req.params.id) <= 0) {
        return res.status(400).json({ message: "User ID must be a positive integer" });
    }
    if (Number(req.params.id) !== Number(req.user.userId)) {
        return res.status(404).json({ message: "User not found" });
    }
    try {
        const [users] = await pool.query(
            "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
            [req.params.id]
        );
        if (users.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(users[0]);
    } catch (error) {
        console.error("GET USER ERROR:", error.message);
        res.status(500).json({ message: "Unable to load user" });
    }
});

module.exports = router;
