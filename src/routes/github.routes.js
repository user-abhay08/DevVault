const express = require("express");
const {
    getRepository,
    getLanguages,
    getCommits,
    getContributors,
    getOpenIssues,
    getOpenPullRequests,
    getReadme,
    parseGithubUrl,
    getRepositoryFiles,
    getFileContent,
    getDependabotAlerts
    } = require("../services/github.service");
const {
    listRepositories,
    findUserRepositoryById,
    getGitHubErrorKind
} = require("../services/github-oauth.service");
const { hasIdentitySchema, getUsableAccessToken, getUserGitHubAccessToken } = require("../services/github-identity.service");
const authenticateToken = require("../middleware/auth.middleware");
const pool = require("../config/db");

const router = express.Router();
const identitySchemaAvailable = async (res) => {
    try {
        if (await hasIdentitySchema(pool)) return true;
    } catch {
        // Keep connection setup details out of API responses.
    }
    res.status(503).json({ message: "GitHub integration is waiting for the approved database migration." });
    return false;
};

const getGitHubConnection = async (userId) => {
    const [users] = await pool.query(
        "SELECT github_id, github_login, github_access_token_enc FROM users WHERE id = ?",
        [userId]
    );
    if (!users.length || !users[0].github_id) return null;
    const user = users[0];
    let tokenState = { accessToken: null, needsReconnect: false };
    let tokenError = false;
    if (user.github_access_token_enc) {
        try {
            tokenState = await getUsableAccessToken(pool, userId);
        } catch {
            tokenError = true;
        }
    }
    return { githubId: String(user.github_id), login: user.github_login, accessToken: tokenState.accessToken, tokenError: tokenError || tokenState.needsReconnect };
};

const normalizeRepo = (url) => {
    try {
        const { owner, repo } = parseGithubUrl(url);
        return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
    } catch {
        return null;
    }
};

// GET ROUTE
router.get("/test", authenticateToken, (req,res)=>{
    res.json({
        message:"Github route working",
        user:req.user
    });
});

router.get("/connection", authenticateToken, async (req, res) => {
    if (!(await identitySchemaAvailable(res))) return;
    try {
        const connection = await getGitHubConnection(req.user.userId);
        return res.json({
            connected: Boolean(connection),
            login: connection?.login || null,
            privateAccess: Boolean(connection?.accessToken),
            privateAccessNeedsReconnect: Boolean(connection?.tokenError),
            revokeUrl: process.env.GITHUB_CLIENT_ID
                ? `https://github.com/settings/connections/applications/${encodeURIComponent(process.env.GITHUB_CLIENT_ID)}`
                : null
        });
    } catch {
        return res.status(500).json({ message: "Unable to check GitHub connection" });
    }
});

router.get("/repositories", authenticateToken, async (req, res) => {
    if (!(await identitySchemaAvailable(res))) return;
    const page = Number(req.query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000) return res.status(400).json({ message: "Page must be a positive integer" });
    try {
        const connection = await getGitHubConnection(req.user.userId);
        if (!connection) return res.status(409).json({ code: "github_not_connected", message: "Connect a GitHub account to browse repositories." });
        if (connection.tokenError) return res.status(409).json({ code: "private_access_needs_reconnect", message: "Private repository access needs to be authorized again." });
        const result = await listRepositories({ login: connection.login, accessToken: connection.accessToken, page });
        const [projects] = await pool.query("SELECT github_url FROM projects WHERE user_id = ? AND github_url IS NOT NULL", [req.user.userId]);
        const imported = new Set(projects.map((project) => normalizeRepo(project.github_url)).filter(Boolean));
        return res.json({
            repositories: result.repositories.map((repository) => ({
                ...repository,
                imported: imported.has(repository.fullName.toLowerCase())
            })),
            page,
            hasNextPage: result.hasNextPage,
            privateAccess: Boolean(connection.accessToken)
        });
    } catch (error) {
        const kind = getGitHubErrorKind(error);
        if (kind === "rate_limited") return res.status(429).json({ code: kind, message: "GitHub rate limit reached. Try again shortly." });
        if (kind === "authorization_revoked" || kind === "insufficient_permissions") return res.status(409).json({ code: kind, message: "GitHub authorization is no longer sufficient. Reconnect GitHub and try again." });
        return res.status(502).json({ code: kind, message: "GitHub repositories could not be loaded. Try again shortly." });
    }
});

router.post("/import", authenticateToken, async (req, res) => {
    if (!(await identitySchemaAvailable(res))) return;
    const repositoryId = String(req.body?.repositoryId || "");
    if (!/^\d{1,20}$/.test(repositoryId) || /^0+$/.test(repositoryId)) {
        return res.status(400).json({ message: "Choose a valid GitHub repository" });
    }
    let connection;
    try {
        connection = await getGitHubConnection(req.user.userId);
        if (!connection) return res.status(409).json({ code: "github_not_connected", message: "Connect a GitHub account before importing a repository." });
        if (connection.tokenError) return res.status(409).json({ code: "private_access_needs_reconnect", message: "Private repository access needs to be authorized again." });
        const repository = await findUserRepositoryById({ repositoryId, login: connection.login, accessToken: connection.accessToken });
        if (!repository) return res.status(404).json({ code: "repository_unavailable", message: "That repository is not available to your connected GitHub account." });
        const parsedUrl = new URL(repository.url);
        if (parsedUrl.protocol !== "https:" || parsedUrl.hostname.toLowerCase() !== "github.com") {
            return res.status(502).json({ message: "GitHub returned an invalid repository URL" });
        }
        const canonicalUrl = `https://github.com/${repository.fullName}`;
        const db = await pool.getConnection();
        try {
            await db.beginTransaction();
            const [users] = await db.query("SELECT id FROM users WHERE id = ? FOR UPDATE", [req.user.userId]);
            if (!users.length) {
                await db.rollback();
                return res.status(404).json({ message: "DevVault account not found" });
            }
            const [projects] = await db.query("SELECT id, github_url FROM projects WHERE user_id = ? FOR UPDATE", [req.user.userId]);
            const duplicate = projects.find((project) => normalizeRepo(project.github_url) === repository.fullName.toLowerCase());
            if (duplicate) {
                await db.rollback();
                return res.status(409).json({ code: "already_imported", projectId: duplicate.id, message: "This repository is already in your DevVault workspace." });
            }
            const [result] = await db.query(
                "INSERT INTO projects (user_id, title, description, github_url, live_url) VALUES (?, ?, ?, ?, NULL)",
                [req.user.userId, repository.name, repository.description, canonicalUrl]
            );
            await db.commit();
            return res.status(201).json({ projectId: result.insertId, repository });
        } catch (error) {
            await db.rollback();
            throw error;
        } finally {
            db.release();
        }
    } catch (error) {
        const kind = getGitHubErrorKind(error);
        if (kind === "rate_limited") return res.status(429).json({ code: kind, message: "GitHub rate limit reached. Try again shortly." });
        if (kind === "authorization_revoked" || kind === "insufficient_permissions") return res.status(409).json({ code: kind, message: "GitHub authorization is no longer sufficient. Reconnect GitHub and try again." });
        if (kind === "repository_unavailable") return res.status(404).json({ code: kind, message: "That repository is no longer available to your GitHub account." });
        return res.status(502).json({ code: kind, message: "The repository could not be imported. Try again shortly." });
    }
});

router.delete("/private-access", authenticateToken, async (req, res) => {
    if (!(await identitySchemaAvailable(res))) return;
    try {
        const [result] = await pool.query(
            "UPDATE users SET github_access_token_enc = NULL, github_access_token_iv = NULL, github_access_token_tag = NULL, github_access_token_expires_at = NULL, github_refresh_token_enc = NULL, github_refresh_token_iv = NULL, github_refresh_token_tag = NULL, github_refresh_token_expires_at = NULL WHERE id = ?",
            [req.user.userId]
        );
        return res.json({ disconnected: result.affectedRows > 0, message: "Private repository access has been removed from DevVault. You can also revoke the app from GitHub settings." });
    } catch {
        return res.status(500).json({ message: "Unable to remove private repository access" });
    }
});

router.get("/repo/:owner/:repo",authenticateToken, async(req,res)=>{
    try{
        const {owner,repo} = req.params;
        const repository = await getRepository(owner,repo,null);
        res.json({
            repository
        });
    } catch(error){
        console.log("GITHUB ERROR:",error.message);
        res.status(500).json({
            message:"Unable to fetch Github repository"
        });
    }
});

router.get("/project/:id", authenticateToken, async(req,res)=>{
    try{
        const projectId = req.params.id;
        const userId = req.user.userId;

        const[projects] =  await pool.query(
            `SELECT * 
            FROM projects 
            WHERE id = ? AND user_id = ?`,
            [projectId,userId]
        );
        if(projects.length === 0){
            return res.status(404).json({
                message:"Project not found"
            });
        }
        const project = projects[0];
        if(!project.github_url){
            return res.status(400).json({
                message:"Project does not have a Github URL"
            });
        }
       let owner;
       let repo;
       try{
        ({owner,repo} = parseGithubUrl(project.github_url));
       } catch(error){
        return res.status(400).json({
            message:"Invalid Github URL"
        });
       }
        const accessToken = await getUserGitHubAccessToken(pool, userId);
        const repository = await getRepository(owner,repo,accessToken);
        const languages = await getLanguages(owner,repo,accessToken);
        res.json({
            project:{
                id: project.id,
                title:project.title
            },
            github:{
                name: repository.name,
                full_name: repository.full_name,
                description: repository.description,
                url: repository.html_url,
                language: repository.language,
                languages: languages,
                stars: repository.stars,
                forks: repository.forks,
                open_issues: repository.open_issues_count,
                watchers: repository.watchers_count,
                size: repository.size,
                created_at: repository.created_at,
                updated_at: repository.updated_at
            }
        });
    } catch(error){
        console.log("PROJECT GITHUB ERROR",error.message);
        res.status(500).json({
            message:"Unable to fetch Github repository"
        });
    }
});

router.get("/project/:id/security/dependabot", authenticateToken, async (req, res) => {
    const projectId = req.params.id;
    if (!/^\d+$/.test(projectId) || Number(projectId) < 1) {
        return res.status(400).json({ message: "Project ID must be a positive integer" });
    }
    try {
        const [projects] = await pool.query(
            "SELECT id, github_url FROM projects WHERE id = ? AND user_id = ?",
            [projectId, req.user.userId]
        );
        if (!projects.length) return res.status(404).json({ message: "Project not found" });
        if (!projects[0].github_url) return res.status(400).json({ message: "Project does not have a GitHub URL" });

        const { owner, repo } = parseGithubUrl(projects[0].github_url);
        const accessToken = await getUserGitHubAccessToken(pool, req.user.userId);
        const result = await getDependabotAlerts(owner, repo, accessToken);
        return res.json({ projectId, ...result });
    } catch (error) {
        console.error("DEPENDABOT ALERTS ERROR:", error.message);
        return res.status(500).json({ message: "Unable to check GitHub Dependabot alerts" });
    }
});

router.get("/project/:id/summary", authenticateToken, async(req,res)=>{
    try{
        const projectId = req.params.id;
        const userId = req.user.userId;
        
        const [projects] = await pool.query(
            `SELECT * 
            FROM projects
            WHERE id = ? AND user_id = ?`,
            [projectId, userId]
        );
        if(projects.length === 0){
            return res.status(404).json({
                message:"Project not found"
            });
        }
        const project = projects[0];
        if(!project.github_url){
            return res.status(400).json({
                message:"Project does not have a Github URL"
            });
        }
        const {owner,repo} = parseGithubUrl(project.github_url);
        const accessToken = await getUserGitHubAccessToken(pool, userId);
        const repository = await getRepository(owner,repo,accessToken);
        const languages = await getLanguages(owner,repo,accessToken);
        res.json({
            project:{
                id : project.id,
                title: project.title
            },
            repository:{
                name: repository.name,
                description: repository.description,
                url: repository.html_url,
                languages : repository.language,

                statistics:{
                    stars: repository.stars,
                    forks: repository.forks,
                    issues: repository.open_issues_count,
                    watchers: repository.watchers_count
                },
                languages: languages,
                created_at:repository.created_at,
                updated_at: repository.updated_at
            }
        });
    } catch(error){
        console.log("GITHUB SUMMARY ERROR", error.message);
        res.status(500).json({
            message:"Unable to generate Github summary"
        });
    }
});

router.get("/repo/:owner/:repo/commits", authenticateToken, async(req,res)=>{
    try{
        const {owner,repo} = req.params;
        const commits = await getCommits(owner,repo,null);
        res.json({
            commits
        });
    } catch(error){
        console.log("GITHUB COMMITS ERROR",error.message);
        res.status(500).json({
            message:"Unable to fetch commits"
        });
    }
});

router.get("/project/:id/activity", authenticateToken, async (req, res) => {

    try {

        const projectId = req.params.id;
        const userId = req.user.userId;

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

        const project = projects[0];

        if (!project.github_url) {
            return res.status(400).json({
                message: "Project does not have a GitHub URL"
            });
        }

        const { owner, repo } = parseGithubUrl(project.github_url);

        const commits = await getCommits(owner, repo,null);

        res.json({
            project: {
                id: project.id,
                title: project.title
            },

            activity: {
                commits: commits
            }
        });

    } catch (error) {

        console.error("GITHUB ACTIVITY ERROR:", error.message);

        res.status(500).json({
            message: "Unable to fetch GitHub activity"
        });
    }
});

router.get("/repo/:owner/:repo/contributors", authenticateToken, async(req,res)=>{
    try{
        const{owner,repo} = req.params;
        const contributors = await getContributors(owner,repo,null);
        res.json({
            contributors
        });
    } catch(error){
        console.log("GITHUB CONTRIBUTORS ERROR",error.message);
        res.status(500).json({
            message:"Unable to fetch contributors"
        });
    }
});

router.get("/project/:id/insights", authenticateToken, async (req, res) => {

    try {

        const projectId = req.params.id;
        const userId = req.user.userId;

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

        const project = projects[0];

        if (!project.github_url) {
            return res.status(400).json({
                message: "Project does not have a GitHub URL"
            });
        }

        const { owner, repo } = parseGithubUrl(project.github_url);
        const accessToken = await getUserGitHubAccessToken(pool, userId);

        const results = await Promise.allSettled([
            getRepository(owner, repo, accessToken),
            getLanguages(owner, repo, accessToken),
            getCommits(owner, repo, accessToken),
            getContributors(owner, repo, accessToken),
            getOpenIssues(owner, repo, accessToken),
            getOpenPullRequests(owner, repo, accessToken)
        ]);
        if (results[0].status === "rejected") throw results[0].reason;
        const [repositoryResult, languagesResult, commitsResult, contributorsResult, issuesResult, pullRequestsResult] = results;
        const data = (result, fallback) => result.status === "fulfilled" ? result.value : fallback;

        res.json({
            project: {
                id: project.id,
                title: project.title
            },

            github: {
                owner,
                repo,
                repository: repositoryResult.value,
                languages: data(languagesResult, {}),
                commits: data(commitsResult, []),
                contributors: data(contributorsResult, []),
                issues: data(issuesResult, []),
                pullRequests: data(pullRequestsResult, []),
                availability: {
                    languages: languagesResult.status === "fulfilled",
                    commits: commitsResult.status === "fulfilled",
                    contributors: contributorsResult.status === "fulfilled",
                    issues: issuesResult.status === "fulfilled",
                    pullRequests: pullRequestsResult.status === "fulfilled"
                }
            }
        });

    } catch (error) {

        console.error("GITHUB INSIGHTS ERROR:", error.message);

        res.status(500).json({
            message: "Unable to generate GitHub insights"
        });
    }
});

router.get("/repo/:owner/:repo/readme", authenticateToken, async(req,res)=>{

    try{
        const {owner,repo} = req.params;
        const readme = await getReadme(owner,repo,null);
        res.json({
            readme
        });
    } catch(error){
        console.log("GITHUB README ERROR", error.message);
        res.status(500).json({
            message:"Unable to fetch README"
        });
    }
});



 module.exports = router;
