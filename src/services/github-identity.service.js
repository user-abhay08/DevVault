const crypto = require("crypto");

const REQUIRED_COLUMNS = new Set([
    "github_id",
    "github_login",
    "github_access_token_enc",
    "github_access_token_iv",
    "github_access_token_tag",
    "github_access_token_expires_at",
    "github_refresh_token_enc",
    "github_refresh_token_iv",
    "github_refresh_token_tag",
    "github_refresh_token_expires_at",
    "github_connected_at"
]);

const hasIdentitySchema = async (pool) => {
    const [rows] = await pool.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN (${Array(REQUIRED_COLUMNS.size).fill("?").join(", ")})`,
        [...REQUIRED_COLUMNS]
    );
    return rows.length === REQUIRED_COLUMNS.size;
};

const encryptionKey = () => {
    const encoded = process.env.GITHUB_TOKEN_ENCRYPTION_KEY || "";
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
        throw new Error("GitHub token encryption is not configured");
    }
    return key;
};

const isEncryptionKeyConfigured = () => {
    try { encryptionKey(); return true; } catch { return false; }
};

const encryptAccessToken = (accessToken) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);
    return { ciphertext, iv, tag: cipher.getAuthTag() };
};

const decryptAccessToken = ({ ciphertext, iv, tag }) => {
    if (!ciphertext || !iv || !tag) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
};

const getUsableAccessToken = async (pool, userId) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [users] = await connection.query(
            "SELECT github_access_token_enc, github_access_token_iv, github_access_token_tag, github_access_token_expires_at, github_refresh_token_enc, github_refresh_token_iv, github_refresh_token_tag, github_refresh_token_expires_at FROM users WHERE id = ? FOR UPDATE",
            [userId]
        );
        if (!users.length || !users[0].github_access_token_enc) {
            await connection.commit();
            return { accessToken: null, needsReconnect: false };
        }
        const user = users[0];
        const accessToken = decryptAccessToken({
            ciphertext: user.github_access_token_enc,
            iv: user.github_access_token_iv,
            tag: user.github_access_token_tag
        });
        const expiresAt = user.github_access_token_expires_at ? new Date(user.github_access_token_expires_at).getTime() : null;
        if (!expiresAt || expiresAt > Date.now() + 60_000) {
            await connection.commit();
            return { accessToken, needsReconnect: false };
        }
        if (!user.github_refresh_token_enc) {
            await connection.commit();
            return { accessToken: null, needsReconnect: true };
        }
        const refreshExpiresAt = user.github_refresh_token_expires_at ? new Date(user.github_refresh_token_expires_at).getTime() : null;
        if (refreshExpiresAt && refreshExpiresAt <= Date.now()) {
            await connection.commit();
            return { accessToken: null, needsReconnect: true };
        }
        const refreshToken = decryptAccessToken({
            ciphertext: user.github_refresh_token_enc,
            iv: user.github_refresh_token_iv,
            tag: user.github_refresh_token_tag
        });
        const { refreshAccessToken } = require("./github-oauth.service");
        let rotated;
        try {
            rotated = await refreshAccessToken(refreshToken);
        } catch (error) {
            if (error.code === "bad_refresh_token" || error.code === "invalid_grant") {
                await connection.commit();
                return { accessToken: null, needsReconnect: true };
            }
            throw error;
        }
        if (!rotated.refreshToken || !rotated.expiresIn) throw new Error("GitHub did not return a refreshed token pair");
        const encryptedAccess = encryptAccessToken(rotated.accessToken);
        const encryptedRefresh = encryptAccessToken(rotated.refreshToken);
        await connection.query(
            "UPDATE users SET github_access_token_enc = ?, github_access_token_iv = ?, github_access_token_tag = ?, github_access_token_expires_at = ?, github_refresh_token_enc = ?, github_refresh_token_iv = ?, github_refresh_token_tag = ?, github_refresh_token_expires_at = ? WHERE id = ?",
            [
                encryptedAccess.ciphertext,
                encryptedAccess.iv,
                encryptedAccess.tag,
                new Date(Date.now() + rotated.expiresIn * 1000),
                encryptedRefresh.ciphertext,
                encryptedRefresh.iv,
                encryptedRefresh.tag,
                rotated.refreshTokenExpiresIn ? new Date(Date.now() + rotated.refreshTokenExpiresIn * 1000) : null,
                userId
            ]
        );
        await connection.commit();
        return { accessToken: rotated.accessToken, needsReconnect: false };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const getUserGitHubAccessToken = async (pool, userId) => {
    let users;
    try {
        [users] = await pool.query("SELECT github_access_token_enc FROM users WHERE id = ?", [userId]);
    } catch (error) {
        if (error.code === "ER_BAD_FIELD_ERROR") return null;
        throw error;
    }
    if (!users.length || !users[0].github_access_token_enc) return null;
    const result = await getUsableAccessToken(pool, userId);
    return result.needsReconnect ? null : result.accessToken;
};

const oauthStateCookie = "devvault_github_oauth";

const cookieValue = (header = "", name = oauthStateCookie) => {
    const prefix = `${name}=`;
    const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
    return item ? decodeURIComponent(item.slice(prefix.length)) : "";
};

const cookieOptions = () => [
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/auth/github/callback",
    "Max-Age=600",
    ...(process.env.NODE_ENV === "production" ? ["Secure"] : [])
].join("; ");

const setOAuthStateCookie = (res, stateToken) => {
    res.setHeader("Set-Cookie", `${oauthStateCookie}=${encodeURIComponent(stateToken)}; ${cookieOptions()}`);
};

const clearOAuthStateCookie = (res) => {
    res.setHeader("Set-Cookie", `${oauthStateCookie}=; ${cookieOptions().replace("Max-Age=600", "Max-Age=0")}`);
};

module.exports = {
    hasIdentitySchema,
    encryptAccessToken,
    isEncryptionKeyConfigured,
    decryptAccessToken,
    getUsableAccessToken,
    getUserGitHubAccessToken,
    oauthStateCookie,
    cookieValue,
    setOAuthStateCookie,
    clearOAuthStateCookie
};
