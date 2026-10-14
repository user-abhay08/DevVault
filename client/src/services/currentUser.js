import api from "./api";

export default async function getCurrentUser() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
        const encodedPayload = token.split(".")[1];
        const base64Payload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(base64Payload.padEnd(Math.ceil(base64Payload.length / 4) * 4, "=")));
        const userId = payload.userId || payload.id || payload.sub;
        if (!userId) return null;
        const response = await api.get(`/users/${encodeURIComponent(userId)}`);
        return response.data;
    } catch {
        return null;
    }
}
