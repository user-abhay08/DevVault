const express = require('express');
const authMiddleware  = require("../middleware/auth.middleware");
const db = require("../config/db");
const authenticateToken = require('../middleware/auth.middleware');

const { 
    generateAIResponse, 
    analyzeProject,
    reviewProjectCode
} = require('../services/ai.service');

const pool = require("../config/db");

const {
    getRepository,
    getLanguages,
    getCommits,
    getContributors,
    getReadme,
    parseGithubUrl,
    getRepositoryFiles,
    getFileContent
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

router.get("/project/:id/code-review", authMiddleware, async (req, res) => {
    try {

        const projectId = req.params.id;
        const userId = req.user.userId;

        const [projects] = await db.query(
            "SELECT id FROM projects WHERE id = ? AND user_id = ?",
            [projectId, userId]
        );

        if (projects.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }


        const [reviews] = await db.query(
            "SELECT * FROM code_reviews WHERE project_id = ?",
            [projectId]
        );

        if (reviews.length === 0) {
            return res.status(404).json({
                message: "Code review not found"
            });
        }

        const review = reviews[0];

        const parseJSONField = (value) => {
            if (!value) {
                return [];
            }

            if (typeof value === "string") {
                return JSON.parse(value);
            }

            return value;
        };

        res.json({
            projectId: review.project_id,
            overallScore: review.overall_score,
            summary: review.summary,
            codeQuality: parseJSONField(review.code_quality),
            bugs: parseJSONField(review.bugs),
            security: parseJSONField(review.security),
            performance: parseJSONField(review.performance),
            maintainability: parseJSONField(review.maintainability),
            recommendations: parseJSONField(review.recommendations),
            reviewedFiles: parseJSONField(review.reviewed_files),
            reviewedAt: review.reviewed_at,
            updatedAt: review.updated_at
        });

    } catch (error) {
        console.error(
            "Get code review error:",
            error.message
        );

        res.status(500).json({
            message: "Failed to fetch code review"
        });
    }
});


// POST ROUTE
router.post("/project/:id/analyze", authenticateToken, async (req, res) => {
    
    try {
        const startTime = Date.now();

        const projectId = req.params.id;
        const userId = req.user.userId;

        const [projects] = await pool.query(
            `SELECT * FROM projects
            WHERE id = ? AND user_id = ?`,
            [projectId, userId]
        );

        if (projects.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const project = projects[0];


        if (!project.github_url) {
            return res.status(400).json({
                message: "Github URL is required for AI analysis"
            });
        }

        const { owner, repo } = parseGithubUrl(project.github_url);


        const repository = await getRepository(owner, repo);

        const [languages, commits, contributors, readme] = await Promise.all([
            getLanguages(owner, repo),
            getCommits(owner, repo),
            getContributors(owner, repo),
            getReadme(owner, repo)
        ]);


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

router.post("/project/:id/code-review", authMiddleware, async (req, res) => {
    try {

       const projectId = req.params.id;
        const userId = req.user.userId;

        const [projects] = await db.query(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            [projectId, userId]
        );


        if (projects.length === 0) {
            return res.status(404).json({
                message: "Project not found"
            });
        }

        const project = projects[0];


        const { owner, repo } = parseGithubUrl(project.github_url);

        const repositoryFiles = await getRepositoryFiles(owner, repo);


        const selectedFiles = repositoryFiles
            .filter(file => file.size && file.size < 100000)
            .slice(0, 15);


        const filesWithContent = [];

        for (const file of selectedFiles) {

            try {
                const content = await getFileContent(
                    owner,
                    repo,
                    file.path
                );

                filesWithContent.push({
                    path: file.path,
                    content
                });
            } catch (error) {
                console.log(
                    "7. Skipping file:",
                    file.path
                );
            }
        }

        const review = await reviewProjectCode(filesWithContent);


        if (
            typeof review.overallScore !== "number" ||
            review.overallScore < 0 ||
            review.overallScore > 100
        ) {
            throw new Error("Invalid AI review score");
        }


        const [existingReview] = await db.query(
            "SELECT id FROM code_reviews WHERE project_id = ?",
            [projectId]
        );

        if (existingReview.length > 0) {
            console.log("11. Updating existing code review");

            await db.query(
                `
                UPDATE code_reviews
                SET
                    overall_score = ?,
                    summary = ?,
                    code_quality = ?,
                    bugs = ?,
                    security = ?,
                    performance = ?,
                    maintainability = ?,
                    recommendations = ?,
                    reviewed_files = ?
                WHERE project_id = ?
                `,
                [
                    review.overallScore,
                    review.summary,
                    JSON.stringify(review.codeQuality),
                    JSON.stringify(review.bugs),
                    JSON.stringify(review.security),
                    JSON.stringify(review.performance),
                    JSON.stringify(review.maintainability),
                    JSON.stringify(review.recommendations),
                    JSON.stringify(
                        filesWithContent.map(file => file.path)
                    ),
                    projectId
                ]
            );
        } else {

            await db.query(
                `
                INSERT INTO code_reviews
                (
                    project_id,
                    overall_score,
                    summary,
                    code_quality,
                    bugs,
                    security,
                    performance,
                    maintainability,
                    recommendations,
                    reviewed_files
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    projectId,
                    review.overallScore,
                    review.summary,
                    JSON.stringify(review.codeQuality),
                    JSON.stringify(review.bugs),
                    JSON.stringify(review.security),
                    JSON.stringify(review.performance),
                    JSON.stringify(review.maintainability),
                    JSON.stringify(review.recommendations),
                    JSON.stringify(
                        filesWithContent.map(file => file.path)
                    )
                ]
            );
        }

        res.json({
            message: "Code review generated successfully",
            review
        });

    } catch (error) {
        console.error(
            "Code review error:",
            error.response?.data || error.message
        );

        res.status(500).json({
            message: "Failed to generate code review"
        });
    }
});


module.exports = router;