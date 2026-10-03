import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

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

        </div>
    );
}

export default Register;