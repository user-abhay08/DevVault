const axios = require("axios");

const githubApi = axios.create({
    baseURL: "https://api.github.com",
    timeout: 15000,
    headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
    }
});

const getOAuthConfig = () => {
    const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL } = process.env;
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_CALLBACK_URL) {
        throw new Error("GitHub OAuth is not configured");
    }
    return { clientId: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET, callbackUrl: GITHUB_CALLBACK_URL };
};

const createAuthorizationUrl = ({ state, codeChallenge, privateRepositories = false }) => {
    const { clientId, callbackUrl } = getOAuthConfig();
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", callbackUrl);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", privateRepositories ? "read:user user:email repo offline_access" : "read:user user:email");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
};

const exchangeCode = async ({ code, codeVerifier }) => {
    const { clientId, clientSecret, callbackUrl } = getOAuthConfig();
    const response = await axios.post("https://github.com/login/oauth/access_token", {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: codeVerifier,
        redirect_uri: callbackUrl
    }, {
        timeout: 15000,
        headers: { Accept: "application/json" }
    });
    if (response.data?.error || !response.data?.access_token) {
        throw new Error("GitHub authorization could not be completed");
    }
    return {
        accessToken: response.data.access_token,
        scope: response.data.scope || "",
        expiresIn: Number(response.data.expires_in) || null,
        refreshToken: response.data.refresh_token || null,
        refreshTokenExpiresIn: Number(response.data.refresh_token_expires_in) || null
    };
};

const refreshAccessToken = async (refreshToken) => {
    const { clientId, clientSecret } = getOAuthConfig();
    const response = await axios.post("https://github.com/login/oauth/access_token", {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken
    }, { timeout: 15000, headers: { Accept: "application/json" } });
    if (response.data?.error || !response.data?.access_token) {
        const error = new Error("GitHub authorization needs to be renewed");
        error.code = response.data?.error || "github_refresh_failed";
        throw error;
    }
    return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token || null,
        expiresIn: Number(response.data.expires_in) || null,
        refreshTokenExpiresIn: Number(response.data.refresh_token_expires_in) || null
    };
};

const getAuthenticatedUser = async (accessToken) => {
    const headers = { Authorization: `Bearer ${accessToken}` };
    const [userResponse, emailsResponse] = await Promise.all([
        githubApi.get("/user", { headers }),
        githubApi.get("/user/emails", { headers })
    ]);
    const email = (Array.isArray(emailsResponse.data) ? emailsResponse.data : [])
        .filter((item) => item.verified)
        .sort((a, b) => Number(b.primary) - Number(a.primary))[0]?.email || null;
    return {
        id: userResponse.data.id,
        login: userResponse.data.login,
        name: userResponse.data.name || userResponse.data.login,
        email
    };
};

const mapRepository = (repo) => ({
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    url: repo.html_url,
    description: repo.description || "",
    language: repo.language || null,
    visibility: repo.private ? "Private" : "Public",
    private: Boolean(repo.private),
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    updatedAt: repo.updated_at || null
});

const hasNextPage = (linkHeader = "") => /<[^>]+>\s*;\s*rel="next"/.test(linkHeader);

const listRepositories = async ({ login, accessToken, page = 1, perPage = 30 }) => {
    const params = { per_page: perPage, page, sort: "updated" };
    const response = accessToken
        ? await githubApi.get("/user/repos", {
            params: { ...params, visibility: "all", affiliation: "owner,collaborator,organization_member" },
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        : await githubApi.get(`/users/${encodeURIComponent(login)}/repos`, {
            params: { ...params, type: "owner" }
        });
    return { repositories: response.data.map(mapRepository), hasNextPage: hasNextPage(response.headers.link) };
};

const findUserRepositoryById = async ({ repositoryId, login, accessToken }) => {
    for (let page = 1; page <= 100; page += 1) {
        const result = await listRepositories({ login, accessToken, page, perPage: 100 });
        const repository = result.repositories.find((item) => String(item.id) === String(repositoryId));
        if (repository) return repository;
        if (!result.hasNextPage) return null;
    }
    return null;
};

const getGitHubErrorKind = (error) => {
    const status = error.response?.status;
    if (status === 401) return "authorization_revoked";
    if (status === 429) return "rate_limited";
    if (status === 403 && error.response?.headers?.["x-ratelimit-remaining"] === "0") return "rate_limited";
    if (status === 403) return "insufficient_permissions";
    if (status === 404) return "repository_unavailable";
    return "github_unavailable";
};

module.exports = {
    createAuthorizationUrl,
    exchangeCode,
    refreshAccessToken,
    getAuthenticatedUser,
    listRepositories,
    findUserRepositoryById,
    getGitHubErrorKind
};
