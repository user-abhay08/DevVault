const express = require("express");
const {
    getRepository,
    getLanguages,
    getCommits,
    getContributors,
    getReadme,
    parseGithubUrl
    } = require("../services/github.service");
const authenticateToken = require("../middleware/auth.middleware");
const pool = require("../config/db");

const router = express.Router();

// GET ROUTE
router.get("/test", authenticateToken, (req,res)=>{
    res.json({
        message:"Github route working",
        user:req.user
    });
});

router.get("/repo/:owner/:repo",authenticateToken, async(req,res)=>{
    try{
        const {owner,repo} = req.params;
        const repository = await getRepository(owner,repo);
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
        const repository = await getRepository(owner,repo);
        const languages = await getLanguages(owner,repo);
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
                stars: repository.stargazers_count,
                forks: repository.forks_count,
                open_issues: repository.watchers_count,
                watchers: repository.watchers.count,
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
        const repository = await getRepository(owner,repo);
        const languages = await getLanguages(owner,repo);
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
                    stars: repository.stargazers_count,
                    forks: repository.forks_count,
                    isssues: repository.open_issues_count,
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
        const commits = await getCommits(owner,repo);
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

        const commits = await getCommits(owner, repo);

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
        const contributors = await getContributors(owner,repo);
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

        const repository = await getRepository(owner, repo);

        const languages = await getLanguages(owner, repo);

        const commits = await getCommits(owner, repo);

        const contributors = await getContributors(owner, repo);

        const readme = await getReadme(owner,repo);

        res.json({
            project: {
                id: project.id,
                title: project.title
            },

            github: {
                owner,
                repo,
                repository,
                languages,
                commits,
                contributors
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
        const readme = await getReadme(owner,repo);
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