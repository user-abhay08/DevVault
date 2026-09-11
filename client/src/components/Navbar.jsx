import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();

    const [darkMode, setDarkMode] = useState(
        localStorage.getItem("theme") === "dark"
    );

    useEffect(() => {
        document.documentElement.setAttribute(
            "data-theme",
            darkMode ? "dark" : "light"
        );

        localStorage.setItem(
            "theme",
            darkMode ? "dark" : "light"
        );
    }, [darkMode]);

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/", { replace: true });
    };

    const toggleTheme = () => {
        setDarkMode((previous) => !previous);
    };

    return (
        <nav className="navbar">

            <Link to="/dashboard" className="logo">
                <span className="logo-mark">D</span>
                <span>DevVault AI</span>
            </Link>

            <div className="nav-links">

                <Link
                    to="/dashboard"
                    className={
                        location.pathname === "/dashboard"
                            ? "nav-link active"
                            : "nav-link"
                    }
                >
                    Dashboard
                </Link>

                <Link
                    to="/profile"
                    className={
                        location.pathname === "/profile"
                            ? "nav-link active"
                            : "nav-link"
                    }
                >
                    Profile
                </Link>

                <button
                    className="theme-toggle"
                    onClick={toggleTheme}
                    aria-label="Toggle dark mode"
                    title={
                        darkMode
                            ? "Switch to light mode"
                            : "Switch to dark mode"
                    }
                >
                    <span className="theme-icon">
                        {darkMode ? "☀" : "☾"}
                    </span>
                </button>

                <button
                    className="logout-button"
                    onClick={handleLogout}
                >
                    Logout
                </button>

            </div>
        </nav>
    );
}

export default Navbar;