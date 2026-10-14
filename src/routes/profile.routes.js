const express = require('express');
const authenticateToken = require('../middleware/auth.middleware');
const pool = require('../config/db');
const router = express.Router();
const validWebUrl = (value) => {
    if (!value) return true;
    try { return new URL(value).protocol === "https:"; } catch { return false; }
};

// GET ROUTE
router.get("/me", authenticateToken, async(req,res)=>{
    try{
        const userId = req.user.userId;
        const [profiles] = await pool.query(
            `SELECT *
            FROM profiles
            WHERE user_id = ?`,
            [userId]
        );
        if(profiles.length === 0){
            return res.status(404).json({
                message:"Profile not found"
            });
        }
        res.json({
            profile:profiles[0]
        });
    } catch(error){
        console.log("GET PROFILE ERROR: ", error);
        res.status(500).json({
            message:"Internal server error"
        });
    }
});

// POST ROUTE
router.post("/", authenticateToken, async (req, res) => {

    try {

        const {
            bio,
            skills,
            github_url,
            linkedin_url,
            portfolio_url
        } = req.body;
        if (![github_url, linkedin_url, portfolio_url].every(validWebUrl)) {
            return res.status(400).json({ message: "Profile links must be valid HTTPS URLs" });
        }
        const userId = req.user.userId;

        const [existingProfile] = await pool.query(
            `SELECT id
             FROM profiles
             WHERE user_id = ?`,
            [userId]
        );

        if (existingProfile.length > 0) {
            return res.status(409).json({
                message: "Profile already exists"
            });
        }

        const [result] = await pool.query(
            `INSERT INTO profiles
            (user_id, bio, skills, github_url, linkedin_url, portfolio_url)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                bio || null,
                skills || null,
                github_url || null,
                linkedin_url || null,
                portfolio_url || null
            ]
        );

        res.status(201).json({
            message: "Profile created successfully",
            profileId: result.insertId
        });

    } catch (error) {

        console.error("CREATE PROFILE ERROR:", error);

        res.status(500).json({
            message: "Internal server error"
        });
    }
});


// PUT ROUTE — Update existing profile
router.put("/", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const {
            bio,
            skills,
            github_url,
            linkedin_url,
            portfolio_url
        } = req.body;

        if (![github_url, linkedin_url, portfolio_url].every(validWebUrl)) {
            return res.status(400).json({
                message: "Profile links must be valid HTTPS URLs"
            });
        }

        const [existing] = await pool.query(
            "SELECT id FROM profiles WHERE user_id = ?",
            [userId]
        );

        if (existing.length === 0) {
            const [result] = await pool.query(
                `INSERT INTO profiles
                 (user_id, bio, skills, github_url, linkedin_url, portfolio_url)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    bio || null,
                    skills || null,
                    github_url || null,
                    linkedin_url || null,
                    portfolio_url || null
                ]
            );

            return res.status(201).json({
                message: "Profile created successfully",
                profileId: result.insertId
            });
        }

        await pool.query(
            `UPDATE profiles
             SET bio = ?,
                 skills = ?,
                 github_url = ?,
                 linkedin_url = ?,
                 portfolio_url = ?
             WHERE user_id = ?`,
            [
                bio || null,
                skills || null,
                github_url || null,
                linkedin_url || null,
                portfolio_url || null,
                userId
            ]
        );

        return res.status(200).json({
            message: "Profile updated successfully"
        });

    } catch (error) {
        console.error("UPDATE PROFILE ERROR:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});


module.exports = router;
