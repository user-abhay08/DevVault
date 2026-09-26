import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL;

const apiBaseUrl = configuredApiUrl
    ? configuredApiUrl.endsWith("/api")
        ? configuredApiUrl
        : `${configuredApiUrl}/api`
    : "http://localhost:5000/api";

const api = axios.create({
    baseURL: apiBaseUrl,
    headers: {
        "Content-Type": "application/json"
    }
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

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