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

            navigate("/", {
                replace: true
            });

        } catch (error) {

            setMessage(
                error.response?.data?.message ||
                "Registration failed."
            );

        } finally {

            setLoading(false);
        }
    };

    return (
        <div className="auth-container">

            <div className="auth-card">

                <div className="auth-brand">

                    <div className="brand-icon">
                        DV
                    </div>

                    <h1>
                        Create Account
                    </h1>

                </div>

                <p className="subtitle">
                    Start analyzing your developer projects
                </p>

                <form onSubmit={handleRegister}>

                    <label htmlFor="name">
                        Name
                    </label>

                    <input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(event) =>
                            setName(event.target.value)
                        }
                        autoComplete="name"
                        required
                    />

                    <label htmlFor="register-email">
                        Email
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

                    <label htmlFor="register-password">
                        Password
                    </label>

                    <input
                        id="register-password"
                        type="password"
                        placeholder="Create a password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        required
                    />

                    <button
                        type="submit"
                        disabled={loading}
                        className="primary-button full-width"
                    >
                        {loading
                            ? "Creating account..."
                            : "Create Account"}
                    </button>

                </form>

                {message && (
                    <div className="error-message">
                        {message}
                    </div>
                )}

                <p className="auth-footer">

                    Already have an account?{" "}

                    <Link to="/">
                        Sign in
                    </Link>

                </p>

            </div>

        </div>
    );
}

export default Register;