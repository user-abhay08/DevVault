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


module.exports = {
    getRepository,
    getLanguages,
    getCommits,
    getContributors,
    getReadme,
    parseGithubUrl
};