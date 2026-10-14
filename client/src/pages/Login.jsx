import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import Icon from "../components/Icon";
import ThemeToggle from "../components/ThemeToggle";

function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (event) => {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await api.post("/auth/login", {
                email,
                password
            });

            localStorage.setItem("token", response.data.token);

            navigate("/dashboard", {
                replace: true
            });

        } catch (error) {
            console.error("LOGIN ERROR:", error);

            setError(
                error.response?.data?.message ||
                "Unable to sign in. Please check your credentials."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <section className="auth-story">
                <Link to="/" className="auth-brand"><span className="auth-brand-mark"><Icon name="layers" size={22} /></span><strong>DevVault <span>AI</span></strong></Link>
                <div className="auth-story-copy">
                    <p className="eyebrow">DEVELOPER WORKSPACE</p>
                    <h1>Your GitHub projects.<br />Smarter insights.</h1>
                    <p>Track, analyze, and improve the repositories you already build.</p>
                    <ul className="auth-benefits">
                        <li><span><Icon name="branch" /></span><div><strong>AI Project Analysis</strong><small>Get useful insight into your codebase.</small></div></li>
                        <li><span><Icon name="check" /></span><div><strong>AI Code Review</strong><small>Find potential issues and quality improvements.</small></div></li>
                        <li><span><Icon name="code" /></span><div><strong>Track GitHub Repositories</strong><small>Monitor stars, forks, languages, and activity.</small></div></li>
                    </ul>
                </div>
                <div className="auth-wave" aria-hidden="true" />
            </section>
            <section className="auth-panel">
            <ThemeToggle className="auth-theme-toggle" />
            <div className="auth-card">

                {/* Brand */}
                <div className="auth-logo-wrapper">
                    <img
                        src="/logo.png"
                        alt="DevVault AI"
                        className="auth-logo"
                    />
                </div>

                <div className="auth-heading">
                    <h1>Welcome back</h1>

                    <p>
                        Sign in to continue to your developer workspace
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleLogin} className="auth-form">

                    <div className="form-group">

                        <label htmlFor="login-email">
                            Email address
                        </label>

                        <input
                            id="login-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(event) =>
                                setEmail(event.target.value)
                            }
                            autoComplete="email"
                            required
                        />

                    </div>

                    <div className="form-group">

                        <div className="password-label-row">

                            <label htmlFor="login-password">
                                Password
                            </label>

                        </div>

                        <div className="password-input-wrapper">

                            <input
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                autoComplete="current-password"
                                required
                            />

                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() =>
                                    setShowPassword(!showPassword)
                                }
                                aria-label={
                                    showPassword
                                        ? "Hide password"
                                        : "Show password"
                                }
                            >
                                {showPassword ? "Hide" : "Show"}
                            </button>

                        </div>

                    </div>

                    {error && (
                        <div className="auth-error">
                            <span className="auth-error-icon">!</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="auth-submit-button"
                    >
                        {loading ? (
                            <>
                                <span className="button-spinner"></span>
                                Signing in...
                            </>
                        ) : (
                            "Sign in"
                        )}
                    </button>

                </form>

                <div className="auth-divider github-divider"><span>Or continue with</span></div>
                <a className="github-auth-button" href={`${api.defaults.baseURL}/auth/github`}>
                    <span className="github-auth-mark" aria-hidden="true">GH</span>
                    Continue with GitHub
                </a>

                {/* Register */}
                <div className="auth-divider">
                    <span>New to DevVault?</span>
                </div>

                <Link
                    to="/register"
                    className="auth-secondary-button"
                >
                    Create an account
                </Link>

                <p className="auth-trust-text">
                    Analyze projects • Review code • Improve faster
                </p>

            </div>
            </section>
        </div>
    );
}

export default Login;
