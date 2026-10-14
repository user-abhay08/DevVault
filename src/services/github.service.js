const axios = require("axios");
const createGithubApi = (accessToken) => axios.create({
    baseURL: "https://api.github.com",
    timeout: 12000,
    headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
    }
});
const githubApi = createGithubApi(process.env.GITHUB_TOKEN);
const getGithubApi = (accessToken) => accessToken === undefined ? githubApi : createGithubApi(accessToken);
const getRepository = async(owner,repo,accessToken) =>{
    const response = await getGithubApi(accessToken).get(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
    const data = response.data;
    return {
        name: data.name,
        full_name: data.full_name,
        description: data.description,
        html_url: data.html_url,
        stars: data.stargazers_count,
        forks: data.forks_count,
        language: data.language,
        open_issues_count: data.open_issues_count,
        watchers_count: data.watchers_count,
        size: data.size,
        created_at: data.created_at,
        updated_at: data.updated_at,
        default_branch: data.default_branch,
        private: data.private
    };
};

const getLanguages = async (owner,repo,accessToken)=>{
    const response = await getGithubApi(accessToken).get(
        `https://api.github.com/repos/${owner}/${repo}/languages`
    );
    return response.data;
};

const parseGithubUrl = (githubUrl) =>{
    let url;
    try {
        url = new URL(githubUrl);
    } catch {
        throw new Error("Invalid GitHub URL");
    }
    if(url.protocol !== "https:" || !["github.com", "www.github.com"].includes(url.hostname.toLowerCase())){
        throw new Error("Invalid Github URL");
    }
    const parts = url.pathname
    .split("/")
    .filter(Boolean);

    if(parts.length !== 2 || parts.some(part => !/^[A-Za-z0-9_.-]+$/.test(part))){
        throw new Error("Invalid Github repository URL");
    }
    const repo = parts[1].replace(/\.git$/i, "");
    if (!repo) throw new Error("Invalid GitHub repository URL");
    return { owner: parts[0], repo };
};

const getCommits = async(owner,repo,accessToken)=>{
    const   response = await getGithubApi(accessToken).get(
        `https://api.github.com/repos/${owner}/${repo}/commits`
    );
     return response.data.map(item => ({
        sha: item.sha,
        message: item.commit?.message || null,
        author: item.commit?.author?.name || null,
        date: item.commit?.author?.date || null
    }));  
};

const getContributors = async(owner,repo,accessToken)=>{
    const response = await getGithubApi(accessToken).get(
        `https://api.github.com/repos/${owner}/${repo}/contributors`
    );
    return response.data;
};

const getOpenIssues = async (owner, repo, accessToken) => {
    const response = await getGithubApi(accessToken).get(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
        params: { state: "open", per_page: 5 }
    });
    return response.data.filter((item) => !item.pull_request).map((item) => ({
        number: item.number,
        title: item.title,
        url: item.html_url,
        author: item.user?.login || null,
        updatedAt: item.updated_at || null
    }));
};

const getOpenPullRequests = async (owner, repo, accessToken) => {
    const response = await getGithubApi(accessToken).get(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`, {
        params: { state: "open", per_page: 5 }
    });
    return response.data.map((item) => ({
        number: item.number,
        title: item.title,
        url: item.html_url,
        author: item.user?.login || null,
        updatedAt: item.updated_at || null
    }));
};

const getReadme = async (owner,repo,accessToken)=>{
    const response = await getGithubApi(accessToken).get(
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

const getRepositoryFiles = async (owner, repo, accessToken) => {
    const repository = await getRepository(owner, repo, accessToken);
    const response = await getGithubApi(accessToken).get(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`
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
                item.path === directory.replace(/\/$/, "") || item.path.includes(`/${directory}`) || item.path.startsWith(directory)
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

const getFileContent = async (owner, repo, path, accessToken) => {
    const response = await getGithubApi(accessToken).get(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`
    );

    if (response.data.type !== "file") {
        throw new Error(`Path is not a file: ${path}`);
    }

    if (response.data.encoding !== "base64" || !response.data.content) {
        throw new Error(`File content unavailable: ${path}`);
    }

    return Buffer
        .from(response.data.content.replace(/\s/g, ""), "base64")
        .toString("utf-8");
};

const redactPotentialSecrets = (source) => {
    let content = String(source || "");
    content = content.replace(
        /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g,
        (match) => `[REDACTED PRIVATE KEY]${"\n".repeat((match.match(/\n/g) || []).length)}`
    );
    content = content.replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[REDACTED CREDENTIAL]");
    content = content.replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[REDACTED CREDENTIAL]");
    content = content.replace(/\bAIza[0-9A-Za-z_-]{30,}\b/g, "[REDACTED CREDENTIAL]");
    content = content.replace(/\b(?:sk_live|rk_live)_[A-Za-z0-9]{16,}\b/g, "[REDACTED CREDENTIAL]");
    content = content.replace(/\bxox[baprs]-[A-Za-z0-9-]{15,}\b/g, "[REDACTED CREDENTIAL]");
    content = content.replace(
        /((?:api[_-]?key|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd|secret|token)\s*[:=]\s*)(["'`]?)([^\s"'`,;]{8,})/gi,
        (match, prefix, quote, value) => {
            if (/^(?:your[_-]|example|changeme|change_me|placeholder|\$\{|process\.env)/i.test(value)) return match;
            return `${prefix}${quote}[REDACTED CREDENTIAL]`;
        }
    );
    return content;
};

const getDependabotAlerts = async (owner, repo, accessToken) => {
    try {
        const response = await getGithubApi(accessToken).get(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/dependabot/alerts`,
            { params: { state: "open", per_page: 100 } }
        );
        return {
            status: "available",
            truncated: response.data.length === 100,
            alerts: response.data.map((alert) => ({
                number: alert.number,
                state: alert.state,
                package: alert.dependency?.package?.name || "Unknown package",
                ecosystem: alert.dependency?.package?.ecosystem || null,
                manifestPath: alert.dependency?.manifest_path || null,
                severity: alert.security_advisory?.severity || null,
                summary: alert.security_advisory?.summary || "Security advisory",
                advisoryUrl: alert.security_advisory?.html_url || null,
                ghsaId: alert.security_advisory?.ghsa_id || null,
                cveId: alert.security_advisory?.cve_id || null,
                vulnerableRange: alert.security_vulnerability?.vulnerable_version_range || null,
                fixedVersion: alert.security_vulnerability?.first_patched_version?.identifier || null,
                createdAt: alert.created_at || null
            }))
        };
    } catch (error) {
        const statusCode = error.response?.status;
        const rateRemaining = error.response?.headers?.["x-ratelimit-remaining"];
        if (statusCode === 429 || (statusCode === 403 && rateRemaining === "0")) {
            return { status: "rate_limited", alerts: [] };
        }
        if (statusCode === 403) return { status: "permission_required", alerts: [] };
        if (statusCode === 404 || statusCode === 410) return { status: "unavailable", alerts: [] };
        return { status: "error", alerts: [] };
    }
};

const selectReviewFiles = (files) => {
    const priority = /(^|\/)(server|app|index)\.(js|jsx|ts|tsx)$|(^|\/)(routes|controllers|services|models|middleware)\//i;
    const ignored = ["node_modules", ".git", "dist", "build", "coverage", ".next", "vendor"];
    const eligible = files.filter(file =>
        Number.isFinite(file.size) && file.size > 0 && file.size <= 40000 &&
        !ignored.some(directory => file.path.split("/").includes(directory))
    );
    const prioritized = eligible.filter(file => priority.test(file.path));
    const selected = [];
    let totalSize = 0;
    for (const file of [...prioritized, ...eligible.filter(file => !prioritized.includes(file))]) {
        if (selected.length === 15) break;
        if (totalSize + file.size > 200000) continue;
        selected.push(file);
        totalSize += file.size;
    }
    return selected;
};


module.exports = {
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
    selectReviewFiles,
    redactPotentialSecrets,
    getDependabotAlerts
};
