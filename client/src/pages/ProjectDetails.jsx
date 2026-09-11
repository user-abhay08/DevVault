import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function ProjectDetails() {

    const { id } = useParams();

    const [project, setProject] = useState(null);
    const [github, setGithub] = useState(null);

    const [loading, setLoading] = useState(true);
    const [githubLoading, setGithubLoading] = useState(false);

    const [message, setMessage] = useState("");

    useEffect(() => {

        const fetchProject = async () => {

            try {

                const response =
                    await api.get(`/projects/${id}`);

                setProject(
                    response.data.project ||
                    response.data
                );

            } catch (error) {

                setMessage(
                    error.response?.data?.message ||
                    "Failed to load project."
                );

            } finally {

                setLoading(false);
            }
        };

        fetchProject();

    }, [id]);


    const loadGithubData = async () => {

        setGithubLoading(true);
        setMessage("");

        try {

            const response =
                await api.get(`/github/project/${id}`);

            setGithub(
                response.data
            );

        } catch (error) {

            setMessage(
                error.response?.data?.message ||
                "Failed to load GitHub data."
            );

        } finally {

            setGithubLoading(false);
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
                            Loading project...
                        </h3>

                    </div>

                </main>
            </>
        );
    }


    if (!project) {

        return (
            <>
                <Navbar />

                <main className="page">

                    <div className="error-card">
                        {message || "Project not found."}
                    </div>

                </main>
            </>
        );
    }


    const repository =
        github?.repository || {};


    return (
        <>
            <Navbar />

            <main className="project-details-page">

                {/* Header */}

                <section className="project-details-header">

                    <div>

                        <p className="eyebrow">
                            PROJECT #{project.id}
                        </p>

                        <h1>
                            {project.title}
                        </h1>

                        <p>
                            {project.description ||
                                "No description available."}
                        </p>

                    </div>

                    <Link
                        to={`/project/${id}/analysis`}
                        className="primary-button"
                    >
                        AI Analysis →
                    </Link>

                </section>


                {message && (

                    <div className="error-card">
                        {message}
                    </div>

                )}


                {/* Project information */}

                <section className="details-card">

                    <div className="section-header">

                        <div>

                            <h2>
                                Project Information
                            </h2>

                            <p>
                                Basic information about this project.
                            </p>

                        </div>

                    </div>

                    <div className="details-list">

                        <div>

                            <span>
                                Project ID
                            </span>

                            <strong>
                                #{project.id}
                            </strong>

                        </div>

                        <div>

                            <span>
                                Owner
                            </span>

                            <strong>
                                Current User
                            </strong>

                        </div>

                        <div>

                            <span>
                                Created
                            </span>

                            <strong>

                                {project.created_at
                                    ? new Date(
                                        project.created_at
                                    ).toLocaleDateString()
                                    : "N/A"}

                            </strong>

                        </div>

                        <div>

                            <span>
                                GitHub
                            </span>

                            <strong>

                                {project.github_url
                                    ? "Connected"
                                    : "Not configured"}

                            </strong>

                        </div>

                    </div>

                </section>


                {/* GitHub */}

                <section className="details-card">

                    <div className="section-header">

                        <div>

                            <h2>
                                GitHub Repository
                            </h2>

                            <p>
                                Repository information retrieved
                                from GitHub.
                            </p>

                        </div>

                        {!github && (

                            <button
                                onClick={loadGithubData}
                                disabled={githubLoading}
                                className="primary-button"
                            >
                                {githubLoading
                                    ? "Loading..."
                                    : "Load GitHub Data"}
                            </button>

                        )}

                    </div>


                    {!github &&
                        !githubLoading && (

                            <div className="empty-state compact">

                                <p>
                                    Click "Load GitHub Data" to
                                    retrieve repository information.
                                </p>

                            </div>
                        )}


                    {githubLoading && (

                        <div className="empty-state compact">

                            <div className="spinner" />

                            <h3>
                                Fetching GitHub data...
                            </h3>

                            <p>
                                Connecting to the repository.
                            </p>

                        </div>
                    )}


                    {github && (

                        <>

                            {/* Repository */}

                            <div className="github-repository">

                                <div>

                                    <p className="eyebrow">
                                        REPOSITORY
                                    </p>

                                    <h3>
                                        {repository.name ||
                                            "Repository"}
                                    </h3>

                                    <p>
                                        {repository.description ||
                                            "No repository description."}
                                    </p>

                                </div>

                                {repository.html_url && (

                                    <a
                                        href={repository.html_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="secondary-button"
                                    >
                                        View on GitHub ↗
                                    </a>

                                )}

                            </div>


                            {/* Metrics */}

                            <div className="github-stats">

                                <div className="github-stat">

                                    <span>
                                        ⭐ Stars
                                    </span>

                                    <strong>
                                        {repository.stars ?? 0}
                                    </strong>

                                </div>

                                <div className="github-stat">

                                    <span>
                                        🍴 Forks
                                    </span>

                                    <strong>
                                        {repository.forks ?? 0}
                                    </strong>

                                </div>

                                <div className="github-stat">

                                    <span>
                                        💻 Primary Language
                                    </span>

                                    <strong>
                                        {repository.language ||
                                            "N/A"}
                                    </strong>

                                </div>

                            </div>


                            {/* Languages */}

                            {github.languages &&
                                Object.keys(github.languages).length > 0 && (

                                    <div className="github-section">

                                        <h3>
                                            Languages
                                        </h3>

                                        <div className="tag-container">

                                            {Object.keys(
                                                github.languages
                                            ).map((language) => (

                                                <span
                                                    className="tag"
                                                    key={language}
                                                >
                                                    {language}
                                                </span>

                                            ))}

                                        </div>

                                    </div>
                                )}


                            {/* Contributors */}

                            {github.contributors && (

                                <div className="github-section">

                                    <h3>
                                        Contributors
                                    </h3>

                                    <p>
                                        {
                                            github.contributors.length
                                        } contributor(s) found.
                                    </p>

                                </div>
                            )}

                        </>
                    )}

                </section>


                {/* AI CTA */}

                <section className="ai-cta">

                    <div>

                        <p className="eyebrow">
                            DEVVAULT AI
                        </p>

                        <h2>
                            Analyze this project with AI
                        </h2>

                        <p>
                            Get an AI-generated assessment covering
                            your project's technologies, strengths,
                            weaknesses, recommendations and next steps.
                        </p>

                    </div>

                    <Link
                        to={`/project/${id}/analysis`}
                        className="primary-button"
                    >
                        Open AI Analysis →
                    </Link>

                </section>

            </main>
        </>
    );
}

export default ProjectDetails;