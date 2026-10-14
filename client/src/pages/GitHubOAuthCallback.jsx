import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon";

const messages = {
    setup_required: "GitHub sign-in is waiting for the approved database migration and server configuration.",
    not_configured: "GitHub sign-in is not configured on the server yet.",
    denied: "GitHub authorization was cancelled.",
    invalid_state: "The GitHub authorization expired or could not be validated. Please try again.",
    oauth_failed: "GitHub sign-in could not be completed. Please try again.",
    private_permission_missing: "GitHub did not grant private repository access. Public repository access is still available.",
    private_access_not_configured: "Private repository access is unavailable until the backend encryption key is configured.",
    account_mismatch: "The GitHub account changed during authorization. Please restart the connection.",
    account_unavailable: "Your DevVault account could not be found.",
    disconnect_existing_first: "A different GitHub account is already connected. Remove that connection before linking another account.",
    email_account_ambiguous: "Several DevVault accounts use this verified GitHub email. Sign in with your existing account, then connect GitHub from the dashboard.",
    email_account_linked: "This verified GitHub email is already connected to a different GitHub identity. Sign in to the existing account first.",
    account_link_conflict: "This GitHub account is already connected to another DevVault account.",
    connect_github_first: "Connect your GitHub account before enabling private repository access."
};

export default function GitHubOAuthCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const code = searchParams.get("github_error");
    const hasToken = new URLSearchParams(window.location.hash.slice(1)).has("token");
    const connected = searchParams.get("github_connected") === "1" || searchParams.get("github_private_connected") === "1";
    const error = messages[code] || "GitHub authorization did not complete.";
    const working = hasToken || connected;

    useEffect(() => {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const token = fragment.get("token");
        if (token) {
            window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
            localStorage.setItem("token", token);
            navigate("/dashboard", { replace: true, state: { githubMessage: "Signed in to DevVault with GitHub." } });
            return;
        }

        if (searchParams.get("github_connected") === "1" || searchParams.get("github_private_connected") === "1") {
            const message = searchParams.get("github_private_connected") === "1"
                ? "Private repository access is connected."
                : "GitHub is connected to your DevVault account.";
            navigate("/dashboard", { replace: true, state: { githubMessage: message } });
            return;
        }

    }, [navigate, searchParams]);

    return (
        <main className="oauth-callback-page">
            <section className="oauth-callback-card">
                <span className="oauth-callback-mark"><Icon name="layers" size={26} /></span>
                {working ? <><h1>Finishing GitHub sign-in</h1><p>Returning you to your DevVault workspace…</p><span className="spinner" /></> : <><h1>GitHub connection incomplete</h1><p role="alert">{error}</p><div className="oauth-callback-actions">{localStorage.getItem("token") ? <Link className="primary-button" to="/dashboard">Back to dashboard</Link> : <Link className="primary-button" to="/">Back to sign in</Link>}</div></>}
            </section>
        </main>
    );
}
