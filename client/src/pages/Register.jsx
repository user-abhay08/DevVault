import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import Icon from "../components/Icon";
import ThemeToggle from "../components/ThemeToggle";

function Register() {

    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleRegister = async (event) => {

        event.preventDefault();

        setMessage("");
        setLoading(true);

        try {

            await api.post(
                "/auth/register",
                {
                    name,
                    email,
                    password
                }
            );

            const loginResponse = await api.post(
                "/auth/login",
                {
                    email,
                    password
                }
            );

            localStorage.setItem(
                "token",
                loginResponse.data.token
            );

            navigate("/dashboard", {
                replace: true
            });

        } catch (error) {

            console.error("REGISTER ERROR:", error);

            setMessage(
                error.response?.data?.message ||
                "Unable to create your account."
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

                    <h1>Create your account</h1>

                    <p>
                        Build your developer profile and start analyzing projects
                    </p>

                </div>

                {/* Form */}
                <form
                    onSubmit={handleRegister}
                    className="auth-form"
                >

                    <div className="form-group">

                        <label htmlFor="register-name">
                            Full name
                        </label>

                        <input
                            id="register-name"
                            type="text"
                            placeholder="Abhay Patil"
                            value={name}
                            onChange={(event) =>
                                setName(event.target.value)
                            }
                            autoComplete="name"
                            required
                        />

                    </div>

                    <div className="form-group">

                        <label htmlFor="register-email">
                            Email address
                        </label>

                        <input
                            id="register-email"
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

                        <label htmlFor="register-password">
                            Password
                        </label>

                        <div className="password-input-wrapper">

                            <input
                                id="register-password"
                                type={
                                    showPassword
                                        ? "text"
                                        : "password"
                                }
                                placeholder="Create a password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                autoComplete="new-password"
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

                        <span className="input-hint">
                            Use a strong password to protect your account.
                        </span>

                    </div>

                    {message && (
                        <div className="auth-error">
                            <span className="auth-error-icon">!</span>
                            <span>{message}</span>
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
                                Creating account...
                            </>
                        ) : (
                            "Create account"
                        )}
                    </button>

                </form>

                <div className="auth-divider github-divider"><span>Or create an account with</span></div>
                <a className="github-auth-button" href={`${api.defaults.baseURL}/auth/github`}>
                    <span className="github-auth-mark" aria-hidden="true">GH</span>
                    Sign up with GitHub
                </a>

                {/* Login */}
                <div className="auth-divider">
                    <span>Already have an account?</span>
                </div>

                <Link
                    to="/"
                    className="auth-secondary-button"
                >
                    Sign in
                </Link>

                <p className="auth-trust-text">
                    Developer intelligence powered by AI
                </p>

            </div>
            </section>
        </div>
    );
}

export default Register;
