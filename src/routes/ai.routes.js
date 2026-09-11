const express = require('express');

const authenticateToken = require('../middleware/auth.middleware');

const { generateAIResponse, analyzeProject 
} = require('../services/ai.service');

const pool = require("../config/db");

const {
    getRepository,
    getLanguages,
    getCommits,
    getContributors,
    getReadme,
    parseGithubUrl
} = require("../services/github.service");

const router = express.Router();


// GET ROUTE
router.get("/test", authenticateToken, async (req, res) => {
    try {
        const response = await generateAIResponse(`
        Return valid JSON using this structure:

        {
            "message": ""
        }

        Set message to one simple sentence explaining what a REST API is.
    `);
        res.json({
            message: "AI is working",
            response
        });
    } catch (error) {
        console.error("PROJECT AI ANALYSIS ERROR", error.message);
        res.status(500).json({
            message: "AI request failed",
            error: error.message
        });
    }
});

router.get("/project/:id/analysis", authenticateToken, async(req,res)=>{
    try{
        const projectId = req.params.id;
        const userId = req.user.userId;

        const [analysis] = await pool.query(
            `SELECT *
            FROM ai_analyses
            WHERE project_id = ?
            AND project_id IN(
            SELECT id 
            FROM projects
            WHERE id = ? AND user_id = ?)`,
            [projectId,projectId,userId]
        );
        if(analysis.length === 0){
            return res.status(404).json({
                message:"AI analysis not found"
            });
        }
        const savedAnalysis = analysis[0];
        res.json({
            message:"AI analysis retrieved successfully",
            projectId,
            analysis: {
                ...savedAnalysis,
                technologies:
                typeof savedAnalysis.technologies === "string"
                ? JSON.parse(savedAnalysis.technologies)
                : savedAnalysis.technologies,

                strengths:
                typeof savedAnalysis.strengths === "string"
                ? JSON.parse(savedAnalysis.strengths)
                : savedAnalysis.strengths,

                weaknesses:
                typeof savedAnalysis.weaknesses === "string"
                ? JSON.parse(savedAnalysis.weaknesses)
                : savedAnalysis.weaknesses,

                recommendations:
                typeof savedAnalysis.weaknesses === "string"
                ? JSON.parse(savedAnalysis.recommendations)
                : savedAnalysis.recommendations,

                next_Steps:
                typeof savedAnalysis.next_Steps === "string"
                ? JSON.parse(savedAnalysis.next_Steps)
                : savedAnalysis.nextSteps
            }
        });
    } catch(error){
        console.error("GET AI ANALYSIS ERROR",error.message);
        res.status(500).json({
            message:"Failed to retrieve AI analysis"
        });
    }
});

router.get("/project/:id/analysis/status", authenticateToken, async(req,res) =>{

    try{
        const projectId = req.params.id;
        const userId = req.user.userId;

        const [projects] = await pool.query(
            `SELECT id 
            FROM projects 
            WHERE id = ? AND user_id = ?`,
            [projectId ,userId]
        );
        if(projects.length === 0){
            return res.status(404).json({
                message:"Project not found"
            });
        }
        const [analysis] = await pool.query(
            `SELECT 
            project_id,
            analyzed_at,
            updated_at
            FROM ai_analyses
            WHERE project_id = ?`,
            [projectId]
        );
        if(analysis.length === 0){
            return res.json({
                projectId,
                analysisAvailable : false
            });
        }
        res.json({
            projectId,
            analysisAvailable : true,
            analyzedAt : analysis[0].analyzed_at,
            updatedAt: analysis[0].updated_at
        });
    } catch(error){
        console.error("AI ANALYSIS STATUS ERROR", error.message);
        res.status(500).json({
            message:"Failed to check analysis status"
        });
    }
});

// POST ROUTE
router.post("/project/:id/analyze", authenticateToken, async (req, res) => {
    
    try {
        const startTime = Date.now();
        console.log("1. Starting AI analysis");

        const projectId = req.params.id;
        const userId = req.user.userId;

        const [projects] = await pool.query(
            `SELECT * FROM projects
            WHERE id = ? AND user_id = ?`,
            [projectId, userId]
        );

        console.log("2. Database project query completed");

        if (projects.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const project = projects[0];

        console.log("3. Project found:", project.title);
        console.log("GitHub URL:", project.github_url);

        if (!project.github_url) {
            return res.status(400).json({
                message: "Github URL is required for AI analysis"
            });
        }

        const { owner, repo } = parseGithubUrl(project.github_url);

        console.log("4. GitHub repo:", owner, repo);

        const repository = await getRepository(owner, repo);
        console.log("5. Repository fetched");

        const [languages, commits, contributors, readme] = await Promise.all([
            getLanguages(owner, repo),
            getCommits(owner, repo),
            getContributors(owner, repo),
            getReadme(owner, repo)
        ]);

        console.log("6. Languages, commits, contributors and README fetched");

        const projectData = {
            projectName: project.title,
            description: project.description || repository.description,
            primaryLanguage: repository.language,
            languages,
            stars: repository.stars,
            forks: repository.forks,
            readme: readme.content,
            commits: commits.slice(0, 10),
            contributors: contributors.slice(0, 10)
        };

        console.log("10. Project data prepared");
        console.log("11. Sending data to Gemini");

        const analysis = await analyzeProject(projectData);
        const [existingUsers] = await pool.query(
            `SELECT id FROM ai_analyses
            WHERE project_id = ?`,
            [projectId]
        );
        if (existingUsers.length > 0) {
            await pool.query(
                `UPDATE ai_analyses
                SET
                project_score = ?,
                project_overview = ?,
                technologies = ?,
                strengths = ?,
                weaknesses = ?,
                recommendations = ?,
                next_steps = ?
                WHERE project_id = ?`,
                [
                    analysis.projectScore,
                    analysis.projectOverview,
                    JSON.stringify(analysis.technologies),
                    JSON.stringify(analysis.strengths),
                    JSON.stringify(analysis.weaknesses),
                    JSON.stringify(analysis.recommendations),
                    JSON.stringify(analysis.nextSteps),
                    projectId
                ]
            );
        } else {
            await pool.query(
                `INSERT INTO ai_analyses
        (
            project_id,
            project_score,
            project_overview,
            technologies,
            strengths,
            weaknesses,
            recommendations,
            next_steps
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    projectId,
                    analysis.projectScore,
                    analysis.projectOverview,
                    JSON.stringify(analysis.technologies),
                    JSON.stringify(analysis.strengths),
                    JSON.stringify(analysis.weaknesses),
                    JSON.stringify(analysis.recommendations),
                    JSON.stringify(analysis.nextSteps)
                ]
            );
        }
        if(
            typeof analysis.projectScore !== "number" ||
            analysis.projectScore < 0 ||
            analysis.projectScore > 100
        ){
            throw new Error("Invalid project score");
        }
        console.log("12. Gemini response received");

        console.log(
            "TOTAL AI ANALYSIS TIME:",
            Date.now() - startTime,
            "ms"
        );
        res.json({
            message: "Project analyzed successfully",
            projectId,
            analysis
        });

    } catch (error) {
        console.error("PROJECT AI ANALYSIS ERROR:", error.message);

        res.status(500).json({
            message: "Failed to analyze project",
            error: error.message
        });
    }
});

module.exports = router;