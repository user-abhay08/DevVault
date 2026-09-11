const express = require("express");
const authenticateToken = require("../middleware/auth.middleware");
const pool = require("../config/db");

const router = express.Router();


// GET /api/projects/test
// Test whether authentication + project route is working
router.get("/test", authenticateToken, (req, res) => {
    res.json({
        message: "Project route working",
        user: req.user
    });
});

// GET /api/projects
// Get all projects belonging to logged-in user
router.get("/", authenticateToken, async (req, res) => {

    const userId = req.user.userId;

    const [projects] = await pool.query(
        `SELECT *
         FROM projects
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
    );

    res.json({
        projects
    });
});


// GET /api/projects/:id
// Get one project belonging to logged-in user
router.get("/:id", authenticateToken, async (req, res) => {

    const projectId = req.params.id;
    const userId = req.user.userId;
    if(!Number.isInteger(Number(projectId))){
        return res.status(400).json({
            message:"Project ID must be a number"
        });
    }
    const [projects] = await pool.query(
        `SELECT *
         FROM projects
         WHERE id = ? AND user_id = ?`,
        [projectId, userId]
    );

    if (projects.length === 0) {
        return res.status(404).json({
            message: "Project not found"
        });
    }

    res.json({
        project: projects[0]
    });
});


// POST /api/projects
// Create a new project
router.post("/", authenticateToken, async (req, res) => {

    const {
        title,
        description,
        github_url,
        live_url
    } = req.body;

    // Validate title
    if (!title || title.trim().length < 3) {
        return res.status(400).json({
            message: "Title must be at least 3 characters"
        });
    }
    if(github_url && !github_url.startsWith("https://")){
        return res.status(400).json({
            message:"GitHub URL must start with https://"
        });
    }
    if(live_url && !live_url.startsWith("https://")){
        return res.status(400).json({
            message:"Live URL must start with https://"
        });
    }
    
    const userId = req.user.userId;

    const [result] = await pool.query(
        `INSERT INTO projects
        (user_id, title, description, github_url, live_url)
        VALUES (?, ?, ?, ?, ?)`,
        [
            userId,
            title,
            description,
            github_url,
            live_url
        ]
    );

    res.status(201).json({
        message: "Project created successfully",
        projectId: result.insertId
    });
});



// PUT /api/projects/:id
// Update an existing project
router.put("/:id", authenticateToken, async (req, res) => {

    const projectId = req.params.id;
    const userId = req.user.userId;
    if(!Number.isInteger(Number(projectId))){
        return res.status(400).json({
            message:"Project ID must be a number"
        });
    }
    const {
        title,
        description,
        github_url,
        live_url
    } = req.body;

    // Validate title
    if (!title || title.trim().length < 3) {
        return res.status(400).json({
            message: "Title must be at least 3 characters"
        });
    }
    if (github_url && !github_url.startsWith("https://")) {
        return res.status(400).json({
        message: "GitHub URL must start with https://"
        });
    }

    if (live_url && !live_url.startsWith("https://")) {
        return res.status(400).json({
        message: "Live URL must start with https://"
        });
    }
    const [result] = await pool.query(
        `UPDATE projects
         SET title = ?,
             description = ?,
             github_url = ?,
             live_url = ?
         WHERE id = ? AND user_id = ?`,
        [
            title,
            description,
            github_url,
            live_url,
            projectId,
            userId
        ]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({
            message: "Project not found"
        });
    }

    res.json({
        message: "Project updated successfully"
    });
});


// DELETE /api/projects/:id
router.delete("/:id", authenticateToken, async (req, res) => {

    const projectId = req.params.id;
    const userId = req.user.userId;
    if(!Number.isInteger(Number(projectId))){
        return res.status(400).json({
            message:"Project ID must be a number"
        });
    }
    const [result] = await pool.query(
        `DELETE FROM projects
         WHERE id = ? AND user_id = ?`,
        [projectId, userId]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({
            message: "Project not found"
        });
    }

    res.json({
        message: "Project deleted successfully"
    });
});


module.exports = router;