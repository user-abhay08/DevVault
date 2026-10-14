import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import getCurrentUser from "../services/currentUser";
import Icon from "./Icon";
import ThemeToggle from "./ThemeToggle";

function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const projectSectionActive = location.pathname.startsWith("/project/") || location.hash === "#projects";

    useEffect(() => {
        let active = true;
        getCurrentUser().then((currentUser) => { if (active) setUser(currentUser); });
        return () => { active = false; };
    }, []);

    const closeMenu = () => setMenuOpen(false);
    const openProjects = () => {
        closeMenu();
        if (location.pathname === "/dashboard") requestAnimationFrame(() => document.getElementById("projects")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };
    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/", { replace: true });
    };

    return (
        <>
            <header className={`app-nav-wrap${menuOpen ? " is-open" : ""}`}>
                <nav className="navbar" aria-label="Main navigation">
                    <Link to="/dashboard" className="navbar-brand" onClick={closeMenu}>
                        <span className="brand-mark"><img className="brand-mark-image" src="/devvault-nav-mark.png" alt="" /></span>
                        <span className="brand-name">DevVault<span>AI</span></span>
                    </Link>

                    <div className="nav-section-label">WORKSPACE</div>
                    <div className="nav-links" id="primary-navigation">
                        <Link to="/dashboard" onClick={closeMenu}
                            className={`nav-link${location.pathname === "/dashboard" && !projectSectionActive ? " active" : ""}`}>
                            <Icon name="grid" size={16} /> Dashboard
                        </Link>
                        <Link to="/dashboard#projects" onClick={openProjects}
                            className={`nav-link${projectSectionActive ? " active" : ""}`}>
                            <Icon name="code" size={16} /> Projects
                        </Link>
                        <Link to="/profile" onClick={closeMenu}
                            className={`nav-link${location.pathname === "/profile" ? " active" : ""}`}>
                            <Icon name="user" size={16} /> Profile
                        </Link>
                    </div>

                    <div className="nav-spacer" />
                    <div className="nav-account">
                        <Link to="/profile" className="account-link" onClick={closeMenu} aria-label="Open your profile">
                            <span className="account-avatar">{user?.name?.trim()?.[0]?.toUpperCase() || <Icon name="user" size={16} />}</span>
                            <span className="account-copy"><strong>{user?.name || "Account"}</strong><small>{user?.role || "Developer"}</small></span>
                        </Link>
                        <ThemeToggle />
                        <button type="button" className="logout-button" onClick={handleLogout}>
                            <Icon name="logout" size={16} /><span>Sign out</span>
                        </button>
                    </div>
                </nav>
            </header>
            <button type="button" className="mobile-sidebar-trigger" aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={() => setMenuOpen((open) => !open)}>
                <Icon name={menuOpen ? "close" : "menu"} />
            </button>
            {menuOpen && <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={closeMenu} />}
        </>
    );
}

export default Navbar;
