import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL;

const apiBaseUrl = configuredApiUrl
    ? configuredApiUrl.endsWith("/api")
        ? configuredApiUrl
        : `${configuredApiUrl}/api`
    : "https://devvault-api-3dle.onrender.com/api";

const api = axios.create({
    baseURL: apiBaseUrl,
    headers: {
        "Content-Type": "application/json"
    }
});

// Attach JWT automatically
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Handle authentication failures
api.interceptors.response.use(
    (response) => response,

    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");

            if (window.location.pathname !== "/") {
                window.location.href = "/";
            }
        }

        return Promise.reject(error);
    }
);

export default api;