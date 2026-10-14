import { useTheme } from "./ThemeContext";
import Icon from "./Icon";

export default function ThemeToggle({ className = "" }) {
    const { theme, toggleTheme } = useTheme();
    const darkMode = theme === "dark";
    return (
        <button type="button" className={`icon-button theme-toggle ${className}`.trim()}
            onClick={toggleTheme}
            aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            aria-pressed={darkMode}
            title={darkMode ? "Switch to light theme" : "Switch to dark theme"}>
            <Icon name={darkMode ? "sun" : "moon"} />
        </button>
    );
}
