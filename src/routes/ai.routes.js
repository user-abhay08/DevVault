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
const { inspectTextForSecrets } = require("../services/secret.service");
const { getUserGitHubAccessToken } = require("../services/github-identity.service");

const {
    getRepository,
    getLanguages,
    getCommits,
    getContributors,
    getReadme,
    parseGithubUrl,
    getRepositoryFiles,
    getFileContent,
    selectReviewFiles
} = require("../services/github.service");

const router = express.Router();

const parseStoredJson = (value, fallback = []) => {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value !== "string") return value;
    try { return JSON.parse(value); } catch { return fallback; }
};
const parseStoredList = (value) => {
    const parsed = parseStoredJson(value);
    return Array.isArray(parsed) ? parsed : [];
};
const parseReviewedFiles = (value) => {
    const parsed = parseStoredJson(value, []);
    if (Array.isArray(parsed)) return { files: parsed, sourceScan: null };
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.files)) {
        return { files: parsed.files, sourceScan: parsed.sourceScan || null };
    }
    return { files: [], sourceScan: null };
};
const validProjectId = (id) => /^\d+$/.test(id) && Number(id) > 0;


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
        if (!validProjectId(projectId)) return res.status(400).json({ message: "Project ID must be a positive integer" });
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
                projectScore: savedAnalysis.project_score,
                projectOverview: savedAnalysis.project_overview,
                technologies: parseStoredList(savedAnalysis.technologies),
                strengths: parseStoredList(savedAnalysis.strengths),
                weaknesses: parseStoredList(savedAnalysis.weaknesses),
                recommendations: parseStoredList(savedAnalysis.recommendations),
                nextSteps: parseStoredList(savedAnalysis.next_steps),
                analyzedAt: savedAnalysis.analyzed_at,
                updatedAt: savedAnalysis.updated_at
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
        if (!validProjectId(projectId)) return res.status(400).json({ message: "Project ID must be a positive integer" });
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
        const reviewedSource = parseReviewedFiles(review.reviewed_files);

        res.json({
            projectId: review.project_id,
            overallScore: review.overall_score,
            summary: review.summary,
            codeQuality: parseStoredList(review.code_quality),
            bugs: parseStoredList(review.bugs),
            security: parseStoredList(review.security),
            performance: parseStoredList(review.performance),
            maintainability: parseStoredList(review.maintainability),
            recommendations: parseStoredList(review.recommendations),
            reviewedFiles: reviewedSource.files,
            sourceScan: reviewedSource.sourceScan,
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

router.get("/project/:id/code-review/status", authMiddleware, async (req, res) => {
    try {
        const projectId = req.params.id;
        if (!validProjectId(projectId)) return res.status(400).json({ message: "Project ID must be a positive integer" });
        const [projects] = await db.query("SELECT id FROM projects WHERE id = ? AND user_id = ?", [projectId, req.user.userId]);
        if (projects.length === 0) return res.status(404).json({ message: "Project not found" });
        const [reviews] = await db.query(
            "SELECT reviewed_at, updated_at, overall_score, code_quality, bugs, security, performance, maintainability FROM code_reviews WHERE project_id = ?",
            [projectId]
        );
        if (reviews.length === 0) return res.json({ projectId, reviewAvailable: false });
        const findingGroups = ["code_quality", "bugs", "security", "performance", "maintainability"]
            .flatMap((field) => parseStoredList(reviews[0][field]));
        const findingSeverityCounts = findingGroups.reduce((counts, finding) => {
            const severity = finding && typeof finding === "object" ? String(finding.severity || "").toLowerCase() : "";
            if (["critical", "high", "medium", "low"].includes(severity)) counts[severity] += 1;
            return counts;
        }, { critical: 0, high: 0, medium: 0, low: 0 });
        res.json({
            projectId,
            reviewAvailable: true,
            overallScore: reviews[0].overall_score,
            reviewedAt: reviews[0].reviewed_at,
            updatedAt: reviews[0].updated_at,
            findingCounts: Object.fromEntries(
                ["code_quality", "bugs", "security", "performance", "maintainability"]
                    .map((field) => [field, parseStoredList(reviews[0][field]).length])
            ),
            findingSeverityCounts
        });
    } catch (error) {
        console.error("CODE REVIEW STATUS ERROR:", error.message);
        res.status(500).json({ message: "Failed to check code review status" });
    }
});


// POST ROUTE
router.post("/project/:id/analyze", authenticateToken, async (req, res) => {
    
    try {
        const startTime = Date.now();

        const projectId = req.params.id;
        if (!validProjectId(projectId)) return res.status(400).json({ message: "Project ID must be a positive integer" });
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
        const accessToken = await getUserGitHubAccessToken(pool, userId);
        const repository = await getRepository(owner, repo, accessToken);

        const [languages, commits, contributors, readme] = await Promise.all([
            getLanguages(owner, repo, accessToken),
            getCommits(owner, repo, accessToken),
            getContributors(owner, repo, accessToken),
            getReadme(owner, repo, accessToken).catch(() => ({ content: "" }))
        ]);


        const [projectName, description, safeReadme, safeCommits, safeContributors] = await Promise.all([
            inspectTextForSecrets(project.title || "", "project-name.txt"),
            inspectTextForSecrets(project.description || repository.description || "", "project-description.txt"),
            inspectTextForSecrets(readme.content || "", "README.md"),
            Promise.all(commits.slice(0, 10).map(async (commit, index) => ({
                ...commit,
                message: await inspectTextForSecrets(commit.message || "", `commit-${index}.txt`),
                author: await inspectTextForSecrets(commit.author || "", `commit-author-${index}.txt`)
            }))),
            Promise.all(contributors.slice(0, 10).map(async (contributor, index) => ({
                login: await inspectTextForSecrets(contributor.login || "", `contributor-${index}.txt`),
                contributions: contributor.contributions
            })))
        ]);

        const projectData = {
            projectName: projectName.safe ? projectName.content : "",
            description: description.safe ? description.content : "",
            primaryLanguage: repository.language,
            languages,
            stars: repository.stars,
            forks: repository.forks,
            readme: safeReadme.safe ? safeReadme.content : "",
            commits: safeCommits.map(({ message, author, ...commit }) => ({
                ...commit,
                message: message.safe ? message.content : "",
                author: author.safe ? author.content : ""
            })),
            contributors: safeContributors.map(({ login, contributions }) => ({
                login: login.safe ? login.content : "",
                contributions
            }))
        };


        const analysis = await analyzeProject(projectData);
        if (typeof analysis.projectScore !== "number" || !Number.isFinite(analysis.projectScore) || analysis.projectScore < 0 || analysis.projectScore > 100) {
            throw new Error("AI returned an invalid project score; saved analysis was left unchanged.");
        }
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
        if (!validProjectId(projectId)) return res.status(400).json({ message: "Project ID must be a positive integer" });
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


        if (!project.github_url) return res.status(400).json({ message: "GitHub URL is required for code review" });
        const { owner, repo } = parseGithubUrl(project.github_url);
        const accessToken = await getUserGitHubAccessToken(db, userId);
        const repositoryFiles = await getRepositoryFiles(owner, repo, accessToken);


        const selectedFiles = selectReviewFiles(repositoryFiles);


        const filesWithContent = [];
        let withheldSecretFiles = 0;

        for (const file of selectedFiles) {

            try {
                const content = await getFileContent(
                    owner,
                    repo,
                    file.path,
                    accessToken
                );

                const pathScan = await inspectTextForSecrets(file.path, "source-path.txt");
                if (!pathScan.safe) {
                    withheldSecretFiles += 1;
                    continue;
                }
                const secretScan = await inspectTextForSecrets(content, file.path);
                if (!secretScan.safe) {
                    withheldSecretFiles += 1;
                    continue;
                }

                filesWithContent.push({
                    path: file.path,
                    content: secretScan.content
                });
            } catch (error) {
                if (error.message === "Secret scanning is unavailable; AI processing was stopped.") throw error;
                console.warn("Skipping inaccessible source file during code review");
            }
        }

        if (filesWithContent.length === 0) {
            return res.status(422).json({ message: withheldSecretFiles
                ? "Secret scanning withheld the available source files from AI review. Remove the detected credentials and try again."
                : "No supported, readable source files were found. The repository may be empty, contain only unsupported files, or deny access to its source." });
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
        const reviewedSourceData = JSON.stringify({
            files: filesWithContent.map((file) => file.path),
            sourceScan: { scanner: "Secretlint", withheldFiles: withheldSecretFiles }
        });

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
                    reviewedSourceData,
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
                    reviewedSourceData
                ]
            );
        }

        res.json({
            message: "Code review generated successfully",
            review: {
                ...review,
                reviewedFiles: filesWithContent.map(file => file.path),
                sourceScan: { scanner: "Secretlint", withheldFiles: withheldSecretFiles },
                reviewedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        if (error.message === "Secret scanning is unavailable; AI processing was stopped.") {
            return res.status(503).json({ message: "Secret scanning is unavailable, so the code review was not started." });
        }
        console.error(
            "Code review error:", error.message
        );

        res.status(500).json({
            message: "Failed to generate code review"
        });
    }
});


module.exports = router;
