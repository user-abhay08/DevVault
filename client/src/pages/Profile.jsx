import { useEffect, useState } from "react";

import api from "../services/api";
import Navbar from "../components/Navbar";

function Profile() {

    const [profile, setProfile] = useState({
        bio: "",
        skills: "",
        github_url: "",
        linkedin_url: "",
        portfolio_url: ""
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");


    useEffect(() => {

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

            await api.put(
                "/profile",
                profile
            );

            setMessage(
                "Profile updated successfully."
            );

        } catch (error) {

            setError(
                error.response?.data?.message ||
                "Failed to update profile."
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

                <section className="profile-header">

                    <p className="eyebrow">
                        DEVELOPER PROFILE
                    </p>

                    <h1>
                        Your Profile
                    </h1>

                    <p>
                        Keep your developer information and
                        portfolio links up to date.
                    </p>

                </section>


                <form
                    className="profile-form"
                    onSubmit={handleSubmit}
                >

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


                    <button
                        type="submit"
                        disabled={saving}
                        className="primary-button"
                    >
                        {saving
                            ? "Saving..."
                            : "Save Profile"}
                    </button>

                </form>

            </main>
        </>
    );
}

export default Profile;