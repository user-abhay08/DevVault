const axios = require("axios");
const githubApi = axios.create({
    baseURL: "https://api.github.com",
    headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json"
    }
});
const getRepository = async(owner,repo) =>{
    const response = await githubApi.get(
        `https://api.github.com/repos/${owner}/${repo}`
    );
    return {
    name: response.data.name,
    description: response.data.description,
    stars: response.data.stargazers_count,
    forks: response.data.forks_count,
    language: response.data.language,
    openIssues: response.data.open_issues_count,
    createdAt: response.data.created_at,
    updatedAt: response.data.updated_at
    };
};

const getLanguages = async (owner,repo)=>{
    const response = await githubApi.get(
        `https://api.github.com/repos/${owner}/${repo}/languages`
    );
    return response.data;
};

const parseGithubUrl = (githubUrl) =>{
    const url = new URL(githubUrl);
    if(url.hostname !== "github.com"){
        throw new Error("Invalid Github URL");
    }
    const parts = url.pathname
    .split("/")
    .filter(Boolean);

    if(parts.length < 2){
        throw new Error("Invalid Github repository URL");
    }
    return {
        owner: parts[0],
        repo:parts[1]
    };
};

const getCommits = async(owner,repo)=>{
    const   response = await githubApi.get(
        `https://api.github.com/repos/${owner}/${repo}/commits`
    );
     return response.data.map(item => ({
        sha: item.sha,
        message: item.commit?.message || null,
        author: item.commit?.author?.name || null,
        date: item.commit?.author?.date || null
    }));  
};

const getContributors = async(owner,repo)=>{
    const response = await githubApi.get(
        `https://api.github.com/repos/${owner}/${repo}/contributors`
    );
    return response.data;
};

const getReadme = async (owner,repo)=>{
    const response = await githubApi.get(
        `https://api.github.com/repos/${owner}/${repo}/readme`
    );
    const content = Buffer
    .from(response.data.content,"base64")
    .toString("utf-8");
    return {
        name: response.data.name,
        content
    };
};

const getRepositoryFiles = async (owner, repo) => {
    const response = await githubApi.get(
        `/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`
    );

    const ignoredDirectories = [
        "node_modules/",
        ".git/",
        "dist/",
        "build/",
        "coverage/",
        ".next/",
        "vendor/"
    ];

    const allowedExtensions = [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".py",
        ".java",
        ".cpp",
        ".c",
        ".h",
        ".html",
        ".css",
        ".sql"
    ];

    const files = response.data.tree
        .filter(item => item.type === "blob")
        .filter(item =>
            !ignoredDirectories.some(directory =>
                item.path.startsWith(directory)
            )
        )
        .filter(item =>
            allowedExtensions.some(extension =>
                item.path.toLowerCase().endsWith(extension)
            )
        );

    return files.map(file => ({
        path: file.path,
        sha: file.sha,
        size: file.size
    }));
};

const getFileContent = async (owner, repo, path) => {
    console.log("GitHub file path:", path);

    const response = await githubApi.get(
        `/repos/${owner}/${repo}/contents/${(path)}`
    );

    if (response.data.type !== "file") {
        throw new Error(`Path is not a file: ${path}`);
    }

    return Buffer
        .from(response.data.content, "base64")
        .toString("utf-8");
};

const selectReviewFiles = (files) => {
    const priorityFiles = [
        "server.js",
        "app.js",
        "index.js",
        "routes/",
        "controllers/",
        "services/",
        "models/",
        "middleware/"
    ];

    return files
        .filter(file =>
            priorityFiles.some(priority =>
                file.path === priority ||
                file.path.startsWith(priority)
            )
        )
        .slice(0, 15);
};


module.exports = {
    getRepository,
    getLanguages,
    getCommits,
    getContributors,
    getReadme,
    parseGithubUrl,
    getRepositoryFiles,
    getFileContent
};