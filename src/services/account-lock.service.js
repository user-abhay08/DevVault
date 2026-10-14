const crypto = require("crypto");

const withEmailLock = async (pool, email, callback) => {
    const normalized = String(email).trim().toLowerCase();
    const lockName = `dv-email-${crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 48)}`;
    const connection = await pool.getConnection();
    let acquired = false;
    try {
        const [rows] = await connection.query("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
        acquired = rows[0]?.acquired === 1;
        if (!acquired) throw new Error("Account creation is busy; try again shortly.");
        return await callback(connection);
    } finally {
        if (acquired) {
            try { await connection.query("SELECT RELEASE_LOCK(?)", [lockName]); } catch { /* MySQL releases the lock when this connection closes. */ }
        }
        connection.release();
    }
};

module.exports = { withEmailLock };
