import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function Dashboard() {

    const [projects, setProjects] = useState([]);

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {

        const fetchProjects = async () => {

            try {

                const response =
                    await api.get("/projects");

                const data =
                    response.data.projects ||
                    response.data;

                setProjects(
                    Array.isArray(data)
                        ? data
                        : []
                );

            } catch (error) {

                setMessage(
                    error.response?.data?.message ||
                    "Failed to fetch projects."
                );

            } finally {

                setLoading(false);
            }
        };

        fetchProjects();

    }, []);

    return (
        <>
            <Navbar />

            <main className="dashboard">

                <section className="dashboard-header">

                    <div>

                        <p className="eyebrow">
                            DEVELOPER WORKSPACE
                        </p>

                        <h1>
                            Developer Dashboard
                        </h1>

                        <p>
                            Manage your projects and get
                            AI-powered engineering insights.
                        </p>

                    </div>

                </section>


                {/* Statistics */}

                <section className="stats-grid">

                    <div className="stat-card">

                        <span className="stat-label">
                            Total Projects
                        </span>

                        <strong>
                            {projects.length}
                        </strong>

                    </div>

                    <div className="stat-card">

                        <span className="stat-label">
                            AI Analysis
                        </span>

                        <strong>
                            Available
                        </strong>

                    </div>

                    <div className="stat-card">

                        <span className="stat-label">
                            GitHub
                        </span>

                        <strong>
                            Integrated
                        </strong>

                    </div>

                </section>


                {/* Projects */}

                <section className="projects-section">

                    <div className="section-header">

                        <div>

                            <h2>
                                Your Projects
                            </h2>

                            <p>
                                Select a project to inspect
                                its GitHub data and AI analysis.
                            </p>

                        </div>

                    </div>


                    {message && (
                        <div className="error-card">
                            {message}
                        </div>
                    )}


                    {loading && (

                        <div className="empty-state">

                            <div className="spinner" />

                            <h3>
                                Loading projects...
                            </h3>

                            <p>
                                Fetching your developer workspace.
                            </p>

                        </div>
                    )}


                    {!loading &&
                        projects.length === 0 && (

                            <div className="empty-state">

                                <div className="empty-icon">
                                    DV
                                </div>

                                <h3>
                                    No projects yet
                                </h3>

                                <p>
                                    Create your first project
                                    through the DevVault API
                                    to begin.
                                </p>

                            </div>
                        )}


                    {!loading &&
                        projects.length > 0 && (

                            <div className="project-grid">

                                {projects.map((project) => (

                                    <article
                                        className="project-card"
                                        key={project.id}
                                    >

                                        <div className="project-card-header">

                                            <div className="project-icon">
                                                {"</>"}
                                            </div>

                                            <span className="project-number">
                                                #{project.id}
                                            </span>

                                        </div>

                                        <h3>
                                            {project.title}
                                        </h3>

                                        <p className="project-description">

                                            {project.description ||
                                                "No project description available."}

                                        </p>

                                        <div className="project-footer">

                                            <Link
                                                to={`/project/${project.id}`}
                                                className="primary-button full-width"
                                            >
                                                View Project
                                            </Link>

                                        </div>

                                    </article>

                                ))}

                            </div>
                        )}

                </section>

            </main>
        </>
    );
}

export default Dashboard;