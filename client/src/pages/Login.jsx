import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

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

        </div>
    );
}

export default Login;