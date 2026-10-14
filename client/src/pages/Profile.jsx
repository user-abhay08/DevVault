import { useEffect, useState } from "react";

import api from "../services/api";
import Navbar from "../components/Navbar";
import getCurrentUser from "../services/currentUser";

function Profile() {

    const [profile, setProfile] = useState({
        bio: "",
        skills: "",
        github_url: "",
        linkedin_url: "",
        portfolio_url: ""
    });
    const [user, setUser] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");


    useEffect(() => {
        getCurrentUser().then(setUser);

        const fetchProfile = async () => {

            try {

                const response =
                    await api.get("/profile/me");

                const data =
                    response.data.profile ||
                    response.data;

                setProfile({
                    bio: data.bio || "",
                    skills: data.skills || "",
                    github_url:
                        data.github_url || "",
                    linkedin_url:
                        data.linkedin_url || "",
                    portfolio_url:
                        data.portfolio_url || ""
                });

            } catch (error) {

                // A missing profile is okay.
                if (error.response?.status !== 404) {

                    setError(
                        error.response?.data?.message ||
                        "Failed to load profile."
                    );
                }

            } finally {

                setLoading(false);
            }
        };

        fetchProfile();

    }, []);


    const handleChange = (event) => {

        const {
            name,
            value
        } = event.target;

        setProfile((previous) => ({
            ...previous,
            [name]: value
        }));

    };



    const handleSubmit = async (event) => {
        event.preventDefault();

        setSaving(true);
        setMessage("");
        setError("");

        try {
            let profileExists = true;

            try {
                await api.get("/profile/me");
            } catch (error) {
                if (error.response?.status === 404) {
                    profileExists = false;
                } else {
                    throw error;
                }
            }

            if (profileExists) {
                await api.put("/profile", profile);
            } else {
                await api.post("/profile", profile);
            }

            setMessage("Profile saved successfully.");

        } catch (error) {
            console.error("SAVE PROFILE ERROR:", {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url,
                method: error.config?.method
            });

            setError(
                error.response?.data?.message ||
                "Failed to save profile."
            );
        } finally {
            setSaving(false);
        }
    };


    if (loading) {

        return (
            <>
                <Navbar />

                <main className="page">

                    <div className="empty-state">

                        <div className="spinner" />

                        <h3>
                            Loading profile...
                        </h3>

                    </div>

                </main>
            </>
        );
    }


    return (
        <>
            <Navbar />

            <main className="profile-page">

                <section className="profile-header profile-heading-row">
                    <div>
                        <p className="eyebrow">DEVELOPER PROFILE</p>
                        <h1>Profile</h1>
                        <p>Manage your profile information and preferences.</p>
                    </div>
                    <button form="profile-form" type="submit" disabled={saving} className="primary-button">{saving ? "Saving…" : "Save changes"}</button>
                </section>

                <form
                    id="profile-form"
                    className="profile-form"
                    onSubmit={handleSubmit}
                >

                    <section className="profile-identity-card">
                        <div className="profile-avatar">{user?.name?.trim()?.[0]?.toUpperCase() || "?"}</div>
                        <div><h2>{user?.name || "Account information unavailable"}</h2><p>{user?.email || "Your account details could not be loaded."}</p>{user?.role && <span className="profile-role">{user.role}</span>}</div>
                    </section>

                    <div className="profile-section">

                        <h2>
                            About You
                        </h2>

                        <label htmlFor="bio">
                            Bio
                        </label>

                        <textarea
                            id="bio"
                            name="bio"
                            value={profile.bio}
                            onChange={handleChange}
                            placeholder="Tell us about yourself..."
                        />

                    </div>


                    <div className="profile-section">

                        <h2>
                            Technical Skills
                        </h2>

                        <label htmlFor="skills">
                            Skills
                        </label>

                        <input
                            id="skills"
                            name="skills"
                            type="text"
                            value={profile.skills}
                            onChange={handleChange}
                            placeholder="React, Node.js, MySQL, JavaScript"
                        />

                    </div>


                    <div className="profile-section">

                        <h2>
                            Developer Links
                        </h2>

                        <label htmlFor="github_url">
                            GitHub URL
                        </label>

                        <input
                            id="github_url"
                            name="github_url"
                            type="url"
                            value={profile.github_url}
                            onChange={handleChange}
                            placeholder="https://github.com/username"
                        />


                        <label htmlFor="linkedin_url">
                            LinkedIn URL
                        </label>

                        <input
                            id="linkedin_url"
                            name="linkedin_url"
                            type="url"
                            value={profile.linkedin_url}
                            onChange={handleChange}
                            placeholder="https://linkedin.com/in/username"
                        />


                        <label htmlFor="portfolio_url">
                            Portfolio URL
                        </label>

                        <input
                            id="portfolio_url"
                            name="portfolio_url"
                            type="url"
                            value={profile.portfolio_url}
                            onChange={handleChange}
                            placeholder="https://yourportfolio.com"
                        />

                    </div>


                    {error && (
                        <div className="error-card">
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="success-card">
                            {message}
                        </div>
                    )}


                </form>

            </main>
        </>
    );
}

export default Profile;
