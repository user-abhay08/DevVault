const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../config/db");
const authenticateToken = require("../middleware/auth.middleware");
const authorizeRole = require("../middleware/role.middleware");
const {
    createAuthorizationUrl,
    exchangeCode,
    getAuthenticatedUser
} = require("../services/github-oauth.service");
const {
    hasIdentitySchema,
    encryptAccessToken,
    isEncryptionKeyConfigured,
    oauthStateCookie,
    cookieValue,
    setOAuthStateCookie,
    clearOAuthStateCookie
} = require("../services/github-identity.service");
const { withEmailLock } = require("../services/account-lock.service");
const router = express.Router();

const frontendUrl = () => (process.env.CLIENT_URL || (process.env.NODE_ENV === "production"
    ? "https://devvault-orpin-nu.vercel.app"
    : "http://localhost:5173")).replace(/\/$/, "");

const signSessionToken = (user) => jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
);

const oauthErrorRedirect = (res, code) => res.redirect(`${frontendUrl()}/oauth/callback?github_error=${encodeURIComponent(code)}`);

const startGitHubOAuth = async (req, res, mode, userId = null) => {
    try {
        if (!(await hasIdentitySchema(pool))) return oauthErrorRedirect(res, "setup_required");
        const state = crypto.randomBytes(32).toString("base64url");
        const codeVerifier = crypto.randomBytes(32).toString("base64url");
        const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
        const privateRepositories = mode === "private";
        if (privateRepositories && !isEncryptionKeyConfigured()) return oauthErrorRedirect(res, "private_access_not_configured");
        const payload = { nonce: state, codeVerifier, mode, userId, issuedAt: Date.now() };
        if (mode === "private") {
            const [users] = await pool.query("SELECT github_id FROM users WHERE id = ?", [payload.userId]);
            if (!users.length || !users[0].github_id) return oauthErrorRedirect(res, "connect_github_first");
            payload.githubId = String(users[0].github_id);
        }
        const stateToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "10m", audience: "github-oauth", issuer: "devvault" });
        const authorizationUrl = createAuthorizationUrl({ state, codeChallenge, privateRepositories });
        setOAuthStateCookie(res, stateToken);
        return res.redirect(authorizationUrl);
    } catch {
        return oauthErrorRedirect(res, "not_configured");
    }
};

router.get("/github", (req, res) => startGitHubOAuth(req, res, "login"));

const issueOAuthTicket = async (req, res, mode) => {
    try {
        if (!(await hasIdentitySchema(pool))) return res.status(503).json({ message: "GitHub sign-in is waiting for the approved database migration." });
        if (mode === "private") {
            if (!isEncryptionKeyConfigured()) return res.status(503).json({ message: "Private repository access is not configured on the server." });
            const [users] = await pool.query("SELECT github_id FROM users WHERE id = ?", [req.user.userId]);
            if (!users.length || !users[0].github_id) return res.status(409).json({ code: "github_not_connected", message: "Connect a GitHub account before enabling private repository access." });
        }
        const ticket = jwt.sign(
            { userId: req.user.userId, mode, nonce: crypto.randomBytes(24).toString("base64url") },
            process.env.JWT_SECRET,
            { expiresIn: "45s", audience: "github-oauth-init", issuer: "devvault" }
        );
        res.setHeader("Cache-Control", "no-store");
        return res.json({ ticket });
    } catch {
        return res.status(503).json({ message: "GitHub authorization could not be started." });
    }
};

const consumeOAuthTicket = async (req, res, mode) => {
    try {
        const ticket = typeof req.body?.ticket === "string" ? req.body.ticket : "";
        const payload = jwt.verify(ticket, process.env.JWT_SECRET, { audience: "github-oauth-init", issuer: "devvault" });
        if (payload.mode !== mode || !Number.isInteger(Number(payload.userId))) return oauthErrorRedirect(res, "invalid_state");
        return startGitHubOAuth(req, res, mode, Number(payload.userId));
    } catch {
        return oauthErrorRedirect(res, "invalid_state");
    }
};

router.post("/github/link-ticket", authenticateToken, (req, res) => issueOAuthTicket(req, res, "link"));
router.post("/github/private-ticket", authenticateToken, (req, res) => issueOAuthTicket(req, res, "private"));
router.post("/github/link", (req, res) => consumeOAuthTicket(req, res, "link"));
router.post("/github/private", (req, res) => consumeOAuthTicket(req, res, "private"));

router.get("/github/callback", async (req, res) => {
    const stateToken = cookieValue(req.headers.cookie, oauthStateCookie);
    clearOAuthStateCookie(res);
    try {
        if (!stateToken || typeof req.query.state !== "string" || typeof req.query.code !== "string") {
            return oauthErrorRedirect(res, req.query.error === "access_denied" ? "denied" : "invalid_state");
        }
        const state = jwt.verify(stateToken, process.env.JWT_SECRET, { audience: "github-oauth", issuer: "devvault" });
        const expected = Buffer.from(state.nonce || "");
        const actual = Buffer.from(req.query.state);
        if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual) || Date.now() - state.issuedAt > 10 * 60 * 1000) {
            return oauthErrorRedirect(res, "invalid_state");
        }
        if (!(await hasIdentitySchema(pool))) return oauthErrorRedirect(res, "setup_required");

        const { accessToken, scope, expiresIn, refreshToken, refreshTokenExpiresIn } = await exchangeCode({ code: req.query.code, codeVerifier: state.codeVerifier });
        const githubUser = await getAuthenticatedUser(accessToken);
        const githubId = String(githubUser.id);

        if (state.mode === "private") {
            if (!scope.split(/[ ,]+/).includes("repo")) return oauthErrorRedirect(res, "private_permission_missing");
            if (expiresIn && !refreshToken) return oauthErrorRedirect(res, "oauth_failed");
            if (githubId !== state.githubId) return oauthErrorRedirect(res, "account_mismatch");
            const encrypted = encryptAccessToken(accessToken);
            const encryptedRefresh = refreshToken ? encryptAccessToken(refreshToken) : null;
            const [privateAccessUpdate] = await pool.query(
                "UPDATE users SET github_login = ?, github_access_token_enc = ?, github_access_token_iv = ?, github_access_token_tag = ?, github_access_token_expires_at = ?, github_refresh_token_enc = ?, github_refresh_token_iv = ?, github_refresh_token_tag = ?, github_refresh_token_expires_at = ?, github_connected_at = CURRENT_TIMESTAMP WHERE id = ? AND github_id = ?",
                [
                    githubUser.login,
                    encrypted.ciphertext,
                    encrypted.iv,
                    encrypted.tag,
                    expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
                    encryptedRefresh?.ciphertext || null,
                    encryptedRefresh?.iv || null,
                    encryptedRefresh?.tag || null,
                    refreshTokenExpiresIn ? new Date(Date.now() + refreshTokenExpiresIn * 1000) : null,
                    state.userId,
                    githubId
                ]
            );
            if (privateAccessUpdate.affectedRows !== 1) return oauthErrorRedirect(res, "account_mismatch");
            return res.redirect(`${frontendUrl()}/oauth/callback?github_private_connected=1`);
        }

        if (state.mode === "link") {
            const [users] = await pool.query("SELECT id, github_id FROM users WHERE id = ?", [state.userId]);
            if (!users.length) return oauthErrorRedirect(res, "account_unavailable");
            if (users[0].github_id && String(users[0].github_id) !== githubId) return oauthErrorRedirect(res, "disconnect_existing_first");
            await pool.query(
                "UPDATE users SET github_id = ?, github_login = ?, github_connected_at = CURRENT_TIMESTAMP WHERE id = ? AND (github_id IS NULL OR github_id = ?)",
                [githubId, githubUser.login, state.userId, githubId]
            );
            const [linkedUsers] = await pool.query("SELECT github_id FROM users WHERE id = ?", [state.userId]);
            if (!linkedUsers.length || String(linkedUsers[0].github_id) !== githubId) return oauthErrorRedirect(res, "account_link_conflict");
            return res.redirect(`${frontendUrl()}/oauth/callback?github_connected=1`);
        }

        let [users] = await pool.query("SELECT id, role FROM users WHERE github_id = ?", [githubId]);
        let user = users[0];
        if (!user) {
            const accountEmail = githubUser.email || `github-${githubId}@users.devvault.invalid`;
            const generatedPassword = await bcrypt.hash(crypto.randomBytes(48).toString("base64url"), 12);
            const account = await withEmailLock(pool, accountEmail, async (connection) => {
                const [emailUsers] = await connection.query("SELECT id, github_id, role FROM users WHERE LOWER(email) = LOWER(?) LIMIT 2", [accountEmail]);
                if (emailUsers.length > 1) return { error: "email_account_ambiguous" };
                if (emailUsers.length === 1) {
                    if (emailUsers[0].github_id && String(emailUsers[0].github_id) !== githubId) return { error: "email_account_linked" };
                    await connection.query(
                        "UPDATE users SET github_id = ?, github_login = ?, github_connected_at = CURRENT_TIMESTAMP WHERE id = ? AND (github_id IS NULL OR github_id = ?)",
                        [githubId, githubUser.login, emailUsers[0].id, githubId]
                    );
                    return { user: emailUsers[0] };
                }
                const [result] = await connection.query(
                    "INSERT INTO users (name, email, password, github_id, github_login, github_connected_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                    [githubUser.name || githubUser.login, accountEmail, generatedPassword, githubId, githubUser.login]
                );
                return { user: { id: result.insertId, role: "user" } };
            });
            if (account.error) return oauthErrorRedirect(res, account.error);
            user = account.user;
        } else {
            await pool.query("UPDATE users SET github_login = ?, github_connected_at = COALESCE(github_connected_at, CURRENT_TIMESTAMP) WHERE id = ?", [githubUser.login, user.id]);
        }

        return res.redirect(`${frontendUrl()}/oauth/callback#token=${encodeURIComponent(signSessionToken(user))}`);
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") return oauthErrorRedirect(res, "account_link_conflict");
        return oauthErrorRedirect(res, error.name === "TokenExpiredError" || error.name === "JsonWebTokenError" ? "invalid_state" : "oauth_failed");
    }
});

// GET ROUTE
router.get("/test", (req, res) => {
    res.json({
        message: "Auth route working"
    });
});
router.get(
    "/admin",
    authenticateToken,
    authorizeRole("admin"),
    (req,res) =>{
        res.json({
            message: "Welcome Admin",
            user: req.user
        });
    }
);

router.get("/me", authenticateToken, async (req, res) => {
    const [users] = await pool.query(
        "SELECT id, name, email, created_at FROM users WHERE id = ?",
        [req.user.userId]
    );

    if (users.length === 0) {
        return res.status(404).json({
            message: "User not found"
        });
    }

    res.json(users[0]);
});

// POST ROUTE
router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string" || !name.trim() || !email.trim() || !password) {
        return res.status(400).json({
            message: "Name, email and password are required"
        });
    }
    if(password.length < 6){
        return res.status(400).json({
            message:"Password must be at least 6 characters"
        });
    }
    try {
        const registration = await withEmailLock(pool, email, async (connection) => {
            const [existingUsers] = await connection.query("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", [email]);
            if (existingUsers.length > 0) return { exists: true };
            const hashedPassword = await bcrypt.hash(password, 10);
            const [result] = await connection.query(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                [name, email.trim(), hashedPassword]
            );
            return { userId: result.insertId };
        });
        if (registration.exists) return res.status(409).json({ message: "Email already registered" });
        return res.status(201).json({ message: "User registered successfully", userId: registration.userId });
    } catch {
        return res.status(503).json({ message: "Account creation is temporarily busy. Please try again." });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    const [users] = await pool.query(
        "SELECT * FROM users WHERE email = ?",
        [email]
    );

    if (users.length === 0) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compare(
        password,
        user.password
    );

    if (!passwordMatch) {
        return res.status(401).json({
            message: "Invalid email or password"
        });
    }

    const token = jwt.sign(
        { 
            userId: user.id,
            role: user.role
        },
        process.env.JWT_SECRET,
        { 
            expiresIn: "1h"
        }
    );

    res.json({
        message: "Login successful",
        token
    });
});



module.exports = router;
