const { redactPotentialSecrets } = require("./github.service");

let enginePromise;

const getEngine = () => {
    if (!enginePromise) {
        enginePromise = import("@secretlint/node").then(({ createEngine }) => createEngine({
            color: false,
            formatter: "stylish",
            maskSecrets: true,
            configFileJSON: {
                rules: [{ id: "@secretlint/secretlint-rule-preset-recommend" }]
            }
        })).catch((error) => {
            enginePromise = null;
            throw error;
        });
    }
    return enginePromise;
};

const inspectTextForSecrets = async (content, filePath = "repository-content.txt") => {
    try {
        const engine = await getEngine();
        const result = await engine.executeOnContent({
            content: String(content || ""),
            filePath
        });
        return {
            safe: result.ok,
            content: result.ok ? redactPotentialSecrets(content) : ""
        };
    } catch {
        throw new Error("Secret scanning is unavailable; AI processing was stopped.");
    }
};

module.exports = { inspectTextForSecrets };
