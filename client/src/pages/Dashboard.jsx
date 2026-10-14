import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";

function Dashboard() {
    const navigate = useNavigate();
    const location = useLocation();
    const [projects, setProjects] = useState([]);
    const [aiStatuses, setAiStatuses] = useState({});
    const [reviewStatuses, setReviewStatuses] = useState({});
    const [repositoryMetadata, setRepositoryMetadata] = useState({});
    const [metadataErrors, setMetadataErrors] = useState({});
    const [githubInsights, setGithubInsights] = useState({});
    const [insightLoading, setInsightLoading] = useState({});
    const [insightErrors, setInsightErrors] = useState({});
    const [message, setMessage] = useState("");
    const [projectMessage, setProjectMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [projectForm, setProjectForm] = useState({ title: "", github_url: "", description: "" });
    const [savingProject, setSavingProject] = useState(false);
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [githubConnection, setGithubConnection] = useState(null);
    const [githubConnectionError, setGithubConnectionError] = useState("");
    const [showGithubImport, setShowGithubImport] = useState(false);
    const [githubRepositories, setGithubRepositories] = useState([]);
    const [githubSearch, setGithubSearch] = useState("");
    const [githubPage, setGithubPage] = useState(1);
    const [githubHasNextPage, setGithubHasNextPage] = useState(false);
    const [githubLoading, setGithubLoading] = useState(false);
    const [githubConnecting, setGithubConnecting] = useState(false);
    const [githubImportingId, setGithubImportingId] = useState(null);
    const [githubImportError, setGithubImportError] = useState("");
    const [githubNotice, setGithubNotice] = useState(location.state?.githubMessage || "");

    useEffect(() => {
        let active = true;

        async function fetchProjects() {
            try {
                const response = await api.get("/projects");

                const data =
                    response.data?.projects ?? response.data;

                const items = Array.isArray(data) ? data : [];

                if (!active) return;

                setProjects(items);
                setMessage("");

                const results = await Promise.all(
                    items.map(async (project) => {
                        const [analysis, review, repository] = await Promise.allSettled([
                            api.get(`/ai/project/${project.id}/analysis/status`),
                            api.get(`/ai/project/${project.id}/code-review/status`),
                            project.github_url ? api.get(`/github/project/${project.id}`) : Promise.resolve(null)
                        ]);
                        return {
                            id: project.id,
                            analysis: analysis.status === "fulfilled" ? analysis.value.data : null,
                            review: review.status === "fulfilled" ? review.value.data : null,
                            repository: repository.status === "fulfilled" ? repository.value?.data?.github : null,
                            metadataError: project.github_url && (repository.status === "rejected" || !repository.value?.data?.github)
                        };
                    })
                );

                if (active) {
                    setAiStatuses(Object.fromEntries(results.map(({ id, analysis }) => [id, analysis?.analysisAvailable === true ? analysis : analysis?.analysisAvailable === false ? false : null])));
                    setReviewStatuses(Object.fromEntries(results.map(({ id, review }) => [id, review?.reviewAvailable === true ? review : review?.reviewAvailable === false ? false : null])));
                    setRepositoryMetadata(Object.fromEntries(results.filter(({ repository }) => repository).map(({ id, repository }) => [id, repository])));
                    setMetadataErrors(Object.fromEntries(results.map(({ id, metadataError }) => [id, metadataError])));
                }
            } catch (error) {
                if (active) {
                    setMessage(
                        error.response?.data?.message ||
                        "Unable to load your projects."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        fetchProjects();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;
        api.get("/github/connection").then((response) => {
            if (active) {
                setGithubConnection(response.data);
                setGithubConnectionError("");
            }
        }).catch((error) => {
            if (active) setGithubConnectionError(error.response?.data?.message || "GitHub connection status is unavailable.");
        });
        return () => { active = false; };
    }, []);

    async function loadGithubRepositories(page = 1) {
        setGithubLoading(true);
        setGithubImportError("");
        try {
            const response = await api.get("/github/repositories", { params: { page } });
            setGithubRepositories(response.data.repositories || []);
            setGithubPage(response.data.page || page);
            setGithubHasNextPage(Boolean(response.data.hasNextPage));
        } catch (error) {
            setGithubImportError(error.response?.data?.message || "GitHub repositories could not be loaded.");
            if (["private_access_needs_reconnect", "authorization_revoked", "insufficient_permissions"].includes(error.response?.data?.code)) {
                setGithubConnection((current) => ({ ...current, privateAccess: false, privateAccessNeedsReconnect: true }));
            }
        } finally {
            setGithubLoading(false);
        }
    }

    async function startGitHubAuthorization(mode) {
        setGithubConnecting(true);
        setGithubConnectionError("");
        setGithubImportError("");
        try {
            const response = await api.post(`/auth/github/${mode}-ticket`);
            const form = document.createElement("form");
            form.method = "POST";
            form.action = `${api.defaults.baseURL}/auth/github/${mode}`;
            const ticketInput = document.createElement("input");
            ticketInput.type = "hidden";
            ticketInput.name = "ticket";
            ticketInput.value = response.data.ticket;
            form.appendChild(ticketInput);
            document.body.appendChild(form);
            form.submit();
        } catch (error) {
            const message = error.response?.data?.message || "GitHub authorization could not be started.";
            if (mode === "private") setGithubImportError(message);
            else setGithubConnectionError(message);
            setGithubConnecting(false);
        }
    }

    function openGitHubImport() {
        setGithubNotice("");
        setGithubImportError("");
        if (!githubConnection?.connected) {
            startGitHubAuthorization("link");
            return;
        }
        setShowGithubImport(true);
        loadGithubRepositories(1);
    }

    async function importGitHubRepository(repository) {
        setGithubImportingId(repository.id);
        setGithubImportError("");
        try {
            const response = await api.post("/github/import", { repositoryId: repository.id });
            navigate(`/project/${response.data.projectId}`);
        } catch (error) {
            const existingProjectId = error.response?.data?.code === "already_imported" ? error.response.data.projectId : null;
            if (existingProjectId) {
                navigate(`/project/${existingProjectId}`);
                return;
            }
            setGithubImportError(error.response?.data?.message || "Repository import failed.");
        } finally {
            setGithubImportingId(null);
        }
    }

    async function removePrivateAccess() {
        try {
            await api.delete("/github/private-access");
            setGithubConnection((current) => ({ ...current, privateAccess: false, privateAccessNeedsReconnect: false }));
            setGithubNotice("Private repository access was removed from DevVault. You can also revoke the OAuth app in GitHub settings.");
        } catch (error) {
            setGithubImportError(error.response?.data?.message || "Private repository access could not be removed.");
        }
    }

    useEffect(() => {
        if (!loading && window.location.hash === "#projects") {
            document.getElementById("projects")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [loading]);

    async function loadGithubInsights(projectId) {
        setInsightLoading((current) => ({
            ...current,
            [projectId]: true
        }));

        setInsightErrors((current) => ({
            ...current,
            [projectId]: ""
        }));

        try {
            const response = await api.get(
                `/github/project/${projectId}/insights`
            );

            setGithubInsights((current) => ({
                ...current,
                [projectId]: response.data?.github ?? null
            }));
            if (response.data?.github?.repository) {
                setMetadataErrors((current) => ({ ...current, [projectId]: false }));
                setRepositoryMetadata((current) => ({
                    ...current,
                    [projectId]: response.data.github.repository
                }));
            }
        } catch (error) {
            setInsightErrors((current) => ({
                ...current,
                [projectId]:
                    error.response?.data?.message ||
                    "Unable to load GitHub insights."
            }));
        } finally {
            setInsightLoading((current) => ({
                ...current,
                [projectId]: false
            }));
        }
    }

    async function addProject(event) {
        event.preventDefault();
        setSavingProject(true);
        setProjectMessage("");
        try {
            const created = await api.post("/projects", projectForm);
            const response = await api.get("/projects");
            const data = response.data?.projects ?? response.data;
            const items = Array.isArray(data) ? data : [];
            setProjects(items);
            setAiStatuses((current) => ({ ...current, [created.data?.projectId]: false }));
            setReviewStatuses((current) => ({ ...current, [created.data?.projectId]: false }));
            const projectId = created.data?.projectId;
            if (projectId) {
                setMetadataErrors((current) => ({ ...current, [projectId]: false }));
                api.get(`/github/project/${projectId}`)
                    .then((metadataResponse) => {
                        const repository = metadataResponse.data?.github;
                        if (repository) {
                            setRepositoryMetadata((current) => ({ ...current, [projectId]: repository }));
                        } else {
                            setMetadataErrors((current) => ({ ...current, [projectId]: true }));
                        }
                    })
                    .catch(() => setMetadataErrors((current) => ({ ...current, [projectId]: true })));
            }
            setProjectForm({ title: "", github_url: "", description: "" });
            setShowProjectForm(false);
            setProjectMessage("");
        } catch (error) {
            setProjectMessage(error.response?.data?.message || "Unable to save this repository.");
        } finally {
            setSavingProject(false);
        }
    }

    const connectedProjects = projects.filter(
        (project) => project.github_url
    ).length;

    const analyzedProjects = Object.values(aiStatuses).filter((status) => status && status !== false).length;
    const reviewedProjects = Object.values(reviewStatuses).filter((status) => status && status !== false).length;
    const analysisStatusesKnown = projects.every((project) => Object.hasOwn(aiStatuses, project.id) && aiStatuses[project.id] !== null);
    const reviewStatusesKnown = projects.every((project) => Object.hasOwn(reviewStatuses, project.id) && reviewStatuses[project.id] !== null);
    const awaitingAnalysis = projects.filter((project) => aiStatuses[project.id] === false).length;
    const awaitingReview = projects.filter((project) => reviewStatuses[project.id] === false).length;
    const starDataProjects = projects.filter((project) => Number.isFinite(repositoryMetadata[project.id]?.stars));
    const forkDataProjects = projects.filter((project) => Number.isFinite(repositoryMetadata[project.id]?.forks));
    const knownStars = starDataProjects.reduce((sum, project) => sum + repositoryMetadata[project.id].stars, 0);
    const knownForks = forkDataProjects.reduce((sum, project) => sum + repositoryMetadata[project.id].forks, 0);
    const languageTotals = projects.reduce((totals, project) => {
        const language = repositoryMetadata[project.id]?.language;
        if (typeof language === "string" && language.trim()) totals[language] = (totals[language] || 0) + 1;
        return totals;
    }, {});
    const languageEntries = Object.entries(languageTotals).sort((a, b) => b[1] - a[1]);
    const repositoriesWithLanguage = languageEntries.reduce((sum, [, count]) => sum + count, 0);
    const topLanguageEntries = languageEntries.length > 5
        ? [...languageEntries.slice(0, 4), ["Other", languageEntries.slice(4).reduce((sum, [, bytes]) => sum + bytes, 0)]]
        : languageEntries;
    const languageColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
    const donutBackground = topLanguageEntries.reduce((result, [, bytes], index) => {
        const end = result.position + bytes / repositoriesWithLanguage * 100;
        result.stops.push(`${languageColors[index]} ${result.position}% ${end}%`);
        result.position = end;
        return result;
    }, { stops: [], position: 0 }).stops.join(", ");
    const comparableProjects = projects.map((project) => ({ ...project, metadata: repositoryMetadata[project.id] }))
        .filter(({ metadata }) => Number.isFinite(metadata?.stars) || Number.isFinite(metadata?.forks))
        .sort((a, b) => (b.metadata?.stars || 0) - (a.metadata?.stars || 0))
        .slice(0, 5);
    const maxRepositoryMetric = Math.max(1, ...comparableProjects.flatMap(({ metadata }) => [metadata?.stars || 0, metadata?.forks || 0]));
    const filteredProjects = projects.filter((project) => `${project.title || ""} ${project.description || ""} ${project.github_url || ""}`.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    const attentionProjects = projects.map((project) => {
        const analysis = aiStatuses[project.id];
        const review = reviewStatuses[project.id];
        const counts = review && review !== false ? review.findingCounts || {} : {};
        const securityCount = Number(counts.security) || 0;
        const bugCount = Number(counts.bugs) || 0;
        const severityCounts = review && review !== false ? review.findingSeverityCounts || {} : {};
        const reasons = [];
        if (securityCount || bugCount) reasons.push(`${securityCount} security · ${bugCount} potential bug findings reported by AI review`);
        if (analysis === false) reasons.push("No saved AI analysis");
        if (review === false) reasons.push("No saved code review");
        const highestSeverity = severityCounts.critical ? "critical" : severityCounts.high ? "high" : severityCounts.medium ? "medium" : severityCounts.low ? "low" : "unknown";
        if (highestSeverity !== "unknown") reasons.unshift(`${severityCounts[highestSeverity]} ${highestSeverity} severity finding${severityCounts[highestSeverity] === 1 ? "" : "s"} reported`);
        const destination = securityCount || bugCount || review === false
            ? `/project/${project.id}/code-review`
            : `/project/${project.id}/analysis`;
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, unknown: 0 };
        return { ...project, reasons, destination, severityOrder: severityOrder[highestSeverity] };
    }).filter((project) => project.reasons.length > 0)
        .sort((a, b) => b.severityOrder - a.severityOrder || String(a.title).localeCompare(String(b.title)))
        .slice(0, 6);
    const dateLabel = (value) => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
    };

    return (
        <>
            <Navbar />
            <main className="dashboard app-content">
                <section className="dashboard-header page-heading">
                    <div>
                        <p className="eyebrow">DEVELOPER WORKSPACE</p>
                        <h1>Dashboard</h1>
                        <p>Here’s an overview of your GitHub projects and insights.</p>
                    </div>
                    <div className="dashboard-header-actions">
                        <button type="button" className="secondary-button" onClick={openGitHubImport}>
                            {githubConnecting ? "Connecting…" : githubConnection?.connected ? "Import from GitHub" : "Connect GitHub"}
                        </button>
                        <button type="button" className="primary-button" onClick={() => setShowProjectForm((show) => !show)}>
                            {showProjectForm ? "Close form" : "Track repository"}
                        </button>
                    </div>
                </section>

                {githubNotice && <div className="github-workspace-notice" role="status">{githubNotice}<button type="button" aria-label="Dismiss message" onClick={() => setGithubNotice("")}>×</button></div>}
                {githubConnectionError && <div className="github-setup-notice" role="status">{githubConnectionError}</div>}

                {showGithubImport && (
                    <div className="github-import-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGithubImport(false); }}>
                        <section className="github-import-dialog" role="dialog" aria-modal="true" aria-labelledby="github-import-title">
                            <div className="github-import-heading">
                                <div><p className="eyebrow">GITHUB ACCOUNT</p><h2 id="github-import-title">Import a repository</h2><p>Choose the repository to add to your DevVault workspace.</p></div>
                                <button type="button" className="github-dialog-close" onClick={() => setShowGithubImport(false)} aria-label="Close repository picker">×</button>
                            </div>
                            <div className="github-connection-summary"><span className="connection-dot" /> Connected as <strong>@{githubConnection?.login}</strong><span>{githubConnection?.privateAccess ? "Private access enabled" : "Public repositories only"}</span></div>
                            <div className="github-repository-toolbar">
                                <input type="search" value={githubSearch} onChange={(event) => setGithubSearch(event.target.value)} placeholder="Search this page…" aria-label="Search GitHub repositories" />
                                {githubConnection?.privateAccess ? <button type="button" className="quiet-button" onClick={removePrivateAccess}>Remove private access</button> : <button type="button" className="quiet-button github-private-link" disabled={githubConnecting} onClick={() => startGitHubAuthorization("private")}>{githubConnecting ? "Connecting…" : "Enable private repositories"}</button>}
                            </div>
                            {githubConnection?.privateAccessNeedsReconnect && <p className="github-import-error" role="alert">Private repository authorization needs to be renewed. Choose “Enable private repositories” to reconnect.</p>}
                            {githubImportError && <p className="github-import-error" role="alert">{githubImportError}</p>}
                            {githubLoading ? <div className="github-repository-empty"><span className="spinner" /><p>Loading repositories from GitHub…</p></div> : (
                                <div className="github-repository-list">
                                    {githubRepositories.filter((repository) => `${repository.fullName} ${repository.description} ${repository.language || ""}`.toLowerCase().includes(githubSearch.trim().toLowerCase())).map((repository) => (
                                        <article className="github-repository-option" key={repository.id}>
                                            <div className="github-repository-option-copy"><div><h3>{repository.name}</h3><span className={`github-visibility ${repository.private ? "is-private" : ""}`}>{repository.visibility}</span></div><p>{repository.description || "No description provided."}</p><span className="github-repository-meta">{repository.language || "Language unavailable"} · <Icon name="star" size={14} /> {Number(repository.stars).toLocaleString()} · <Icon name="fork" size={14} /> {Number(repository.forks).toLocaleString()}</span></div>
                                            <button type="button" className={repository.imported ? "quiet-button" : "primary-button"} disabled={repository.imported || githubImportingId !== null} onClick={() => importGitHubRepository(repository)}>{githubImportingId === repository.id ? "Importing…" : repository.imported ? "Imported" : "Import"}</button>
                                        </article>
                                    ))}
                                    {!githubRepositories.length && <div className="github-repository-empty"><p>No repositories are available on this page.</p><span>Check your GitHub account or try enabling private repository access.</span></div>}
                                    {githubRepositories.length > 0 && !githubRepositories.some((repository) => `${repository.fullName} ${repository.description} ${repository.language || ""}`.toLowerCase().includes(githubSearch.trim().toLowerCase())) && <div className="github-repository-empty"><p>No repositories match “{githubSearch}”.</p></div>}
                                </div>
                            )}
                            <div className="github-pagination"><span>Page {githubPage} · Showing {githubRepositories.length} repositories</span><div><button type="button" className="quiet-button" disabled={githubPage <= 1 || githubLoading} onClick={() => loadGithubRepositories(githubPage - 1)}>Previous</button><button type="button" className="quiet-button" disabled={!githubHasNextPage || githubLoading} onClick={() => loadGithubRepositories(githubPage + 1)}>Next</button></div></div>
                            <p className="github-private-disclosure">Private access is optional. GitHub’s OAuth “repo” permission can read and write repositories available to your account; DevVault uses it only to list repositories and read source for your requested insights and reviews. Its expiring access and refresh tokens are encrypted on the server. You can remove the stored private grant here{githubConnection?.revokeUrl && <> or <a href={githubConnection.revokeUrl} target="_blank" rel="noreferrer">revoke DevVault on GitHub</a></>}.</p>
                        </section>
                    </div>
                )}

                {showProjectForm && (
                    <section className="repository-form-card">
                        <div className="section-header">
                            <div><h2>Track an existing repository</h2><p>Add its GitHub URL and a name to identify it in your workspace.</p></div>
                        </div>
                        <form className="repository-form" onSubmit={addProject}>
                            <label htmlFor="project-title">Project name</label>
                            <input id="project-title" required minLength={3} value={projectForm.title}
                                onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} />
                            <label htmlFor="project-github-url">GitHub repository URL</label>
                            <input id="project-github-url" type="url" required placeholder="https://github.com/owner/repository"
                                value={projectForm.github_url}
                                onChange={(event) => setProjectForm({ ...projectForm, github_url: event.target.value })} />
                            <label htmlFor="project-description">Description <span>(optional)</span></label>
                            <textarea id="project-description" value={projectForm.description}
                                onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} />
                            {projectMessage && <div className="error-card" role="alert">{projectMessage}</div>}
                            <button className="primary-button" disabled={savingProject}>
                                {savingProject ? "Saving…" : "Add repository"}
                            </button>
                        </form>
                    </section>
                )}

                {message && <div className="error-card" role="alert">{message}</div>}

                <section className="stats-grid" aria-label="Repository summary">
                    <article className="stat-card">
                        <span className="stat-icon"><Icon name="code" /></span>
                        <span className="stat-label">Tracked repositories</span>
                        <strong>{loading ? "—" : projects.length}</strong>
                        <p>In your DevVault workspace</p>
                    </article>
                    <article className="stat-card">
                        <span className="stat-icon"><Icon name="star" /></span>
                        <span className="stat-label">GitHub stars</span>
                        <strong>{loading || !starDataProjects.length ? "—" : knownStars.toLocaleString()}</strong>
                        <p title="Sum of GitHub stars for repositories with loaded metadata">Across {starDataProjects.length} of {connectedProjects} linked repositories</p>
                    </article>
                    <article className="stat-card">
                        <span className="stat-icon"><Icon name="fork" /></span>
                        <span className="stat-label">GitHub forks</span>
                        <strong>{loading || !forkDataProjects.length ? "—" : knownForks.toLocaleString()}</strong>
                        <p>Across {forkDataProjects.length} repositories with fork counts</p>
                    </article>
                    <article className="stat-card">
                        <span className="stat-icon"><Icon name="branch" /></span>
                        <span className="stat-label">AI analyses</span>
                        <strong>{loading || !analysisStatusesKnown ? "—" : `${analyzedProjects} / ${projects.length}`}</strong>
                        <p>{analysisStatusesKnown ? "Projects with a saved analysis" : "Analysis status unavailable for some projects"}</p>
                    </article>
                    <article className="stat-card">
                        <span className="stat-icon"><Icon name="check" /></span>
                        <span className="stat-label">Code reviews</span>
                        <strong>{loading || !reviewStatusesKnown ? "—" : `${reviewedProjects} / ${projects.length}`}</strong>
                        <p>{reviewStatusesKnown ? "Projects with a saved review" : "Review status unavailable for some projects"}</p>
                    </article>
                </section>

                <section className="dashboard-follow-up" aria-label="Repository coverage and attention">
                    <article className="analytics-panel coverage-panel">
                        <div className="section-header"><div><h2>Report coverage</h2><p>Saved reports across your tracked repositories.</p></div></div>
                        {projects.length ? <>
                            <CoverageRow label="AI analysis" count={analyzedProjects} total={projects.length} known={analysisStatusesKnown} />
                            <CoverageRow label="Code review" count={reviewedProjects} total={projects.length} known={reviewStatusesKnown} />
                            <div className="coverage-pending">
                                <span>Awaiting first analysis <strong>{analysisStatusesKnown ? awaitingAnalysis : "—"}</strong></span>
                                <span>Awaiting first review <strong>{reviewStatusesKnown ? awaitingReview : "—"}</strong></span>
                            </div>
                        </> : <p className="chart-empty">Track a repository to see report coverage.</p>}
                    </article>
                    <article className="analytics-panel attention-panel">
                        <div className="section-header"><div><h2>Repository attention</h2><p>Based on saved report status and AI reported findings. AI findings are not independently verified.</p></div></div>
                        {attentionProjects.length ? <div className="attention-list">
                            {attentionProjects.map((project) => <div className="attention-row" key={project.id}>
                                <span className="attention-mark"><Icon name="warning" size={17} /></span>
                                <div><strong>{project.title || "Untitled repository"}</strong><p>{project.reasons.join(" · ")}</p></div>
                                <Link to={project.destination} className="row-detail-action">Review <Icon name="arrow" size={14} /></Link>
                            </div>)}
                        </div> : <p className="chart-empty">{loading ? "Checking saved reports…" : projects.length ? "No saved report flags or missing first runs." : "No repositories to review yet."}</p>}
                    </article>
                </section>

                <section className="dashboard-analytics" aria-label="Repository analytics">
                    <article className="analytics-panel language-analytics">
                        <div className="section-header"><div><h2>Primary languages</h2><p>Repository count by GitHub primary language ({repositoriesWithLanguage} of {projects.length} repositories).</p></div></div>
                        {repositoriesWithLanguage > 0 ? <div className="donut-layout">
                            <div className="language-donut" role="img" aria-label={topLanguageEntries.map(([name, count]) => `${name} ${Math.round(count / repositoriesWithLanguage * 100)}%`).join(", ")}
                                style={{ "--language-stops": donutBackground }}>
                                <div><strong>{repositoriesWithLanguage}</strong><span>repositories</span></div>
                            </div>
                            <div className="chart-legend">{topLanguageEntries.map(([language, count], index) => <div key={language}><i className={`chart-dot chart-tone-${index}`} /><span>{language}</span><strong>{count} · {Math.round(count / repositoriesWithLanguage * 100)}%</strong></div>)}</div>
                        </div> : <div className="chart-empty">{loading ? "Loading language data…" : connectedProjects ? "Primary language is unavailable for these repositories." : "Track a GitHub repository to see its primary language."}</div>}
                    </article>
                    <article className="analytics-panel repository-analytics">
                        <div className="section-header"><div><h2>Repository comparison</h2><p>Top five by stars · GitHub stars and forks</p></div><div className="chart-series"><span><i className="stars-dot" />Stars</span><span><i className="forks-dot" />Forks</span></div></div>
                        {comparableProjects.length ? <div className="bar-chart">
                            <div className="bar-chart-scale"><span>Repository</span><span><i>0</i><b>{maxRepositoryMetric.toLocaleString()}</b></span><span>Stars / forks</span></div>
                            {comparableProjects.map(({ id, title, metadata }) => <div className="bar-chart-row" key={id}>
                            <span className="bar-chart-label" title={title}>{title || metadata.name}</span><div className="bar-pair" aria-label={`${title || metadata.name}: ${metadata.stars ?? "unavailable"} stars, ${metadata.forks ?? "unavailable"} forks`}>
                                <span className="bar-track"><i className="bar-stars" style={{ width: `${Number.isFinite(metadata.stars) ? metadata.stars / maxRepositoryMetric * 100 : 0}%` }} title={`Stars: ${Number.isFinite(metadata.stars) ? metadata.stars.toLocaleString() : "Unavailable"}`} /></span>
                                <span className="bar-track"><i className="bar-forks" style={{ width: `${Number.isFinite(metadata.forks) ? metadata.forks / maxRepositoryMetric * 100 : 0}%` }} title={`Forks: ${Number.isFinite(metadata.forks) ? metadata.forks.toLocaleString() : "Unavailable"}`} /></span>
                            </div><small>{Number.isFinite(metadata.stars) ? metadata.stars.toLocaleString() : "—"} / {Number.isFinite(metadata.forks) ? metadata.forks.toLocaleString() : "—"}</small>
                        </div>)}</div> : <div className="chart-empty">{loading ? "Loading repository metrics…" : connectedProjects ? "GitHub metrics are unavailable." : "Track a GitHub repository to compare stars and forks."}</div>}
                    </article>
                </section>

                <section id="projects" className="projects-section repository-section">
                    <div className="section-header">
                        <div><h2>Recent projects</h2><p>GitHub metadata and saved AI reports for each tracked project.</p></div>
                        <div className="project-list-tools"><label className="project-search"><Icon name="search" size={15} /><input aria-label="Search projects" placeholder="Search projects…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></label>{!showProjectForm && <button type="button" className="quiet-button" onClick={() => setShowProjectForm(true)}>Track repository</button>}</div>
                    </div>

                    {loading && <div className="loading-panel"><span className="spinner" /><p>Loading repositories and saved report status…</p></div>}
                    {!loading && projects.length === 0 && !message && (
                        <div className="empty-state repository-empty">
                            <span className="empty-icon"><Icon name="code" size={24} /></span>
                            <h3>No repositories tracked yet</h3>
                            <p>Add an existing GitHub repository to start seeing its metadata and AI reports here.</p>
                            <button type="button" className="primary-button" onClick={() => setShowProjectForm(true)}>Track your first repository</button>
                        </div>
                    )}

                    {!loading && filteredProjects.length === 0 && projects.length > 0 && <p className="chart-empty">No projects match “{searchQuery}”.</p>}
                    {!loading && filteredProjects.length > 0 && (
                        <div className="repository-list">
                            {filteredProjects.map((project) => {
                                const insight = githubInsights[project.id];
                                const metadata = repositoryMetadata[project.id];
                                const aiStatus = aiStatuses[project.id];
                                const reviewStatus = reviewStatuses[project.id];
                                const githubLink = metadata?.html_url || project.github_url;
                                return (
                                    <article className="repository-item" key={project.id}>
                                        <div className="repository-identity">
                                            <span className="repository-mark"><Icon name="code" /></span>
                                            <div className="repository-name">
                                                <h3>{project.title || metadata?.name || "Untitled repository"}</h3>
                                                <p className="repository-description">{project.description || metadata?.description || "No description provided."}</p>
                                                {githubLink ? <a href={githubLink} target="_blank" rel="noopener noreferrer" className="repository-link">
                                                    {metadata?.full_name || project.github_url?.replace(/^https:\/\/github\.com\//, "") || "Open on GitHub"} <Icon name="external" size={14} />
                                                </a> : <span className="muted-text">GitHub URL not set</span>}
                                            </div>
                                            <Link className="row-detail-link" to={`/project/${project.id}`} aria-label={`Open ${project.title} details`}><Icon name="arrow" /></Link>
                                        </div>

                                        <div className="repository-facts">
                                            <div className="repo-fact"><span>Language</span><strong>{metadata?.language || (metadataErrors[project.id] || !project.github_url ? "Unavailable" : metadata ? "Not specified" : "Loading…")}</strong></div>
                                            <div className="repo-fact"><span>Stars</span><strong>{Number.isFinite(metadata?.stars) ? metadata.stars.toLocaleString() : metadataErrors[project.id] || !project.github_url || metadata ? "Unavailable" : "Loading…"}</strong></div>
                                            <div className="repo-fact"><span>Forks</span><strong>{Number.isFinite(metadata?.forks) ? metadata.forks.toLocaleString() : metadataErrors[project.id] || !project.github_url || metadata ? "Unavailable" : "Loading…"}</strong></div>
                                            <div className="repo-fact"><span>GitHub updated</span><strong>{metadata ? dateLabel(metadata.updated_at) : "—"}</strong></div>
                                            <div className="repo-fact report-fact"><span>Analysis</span><strong className={`status-label ${aiStatus && aiStatus !== false ? "status-ready" : aiStatus === false ? "status-empty" : "status-unknown"}`}>{aiStatus && aiStatus !== false ? "Saved" : aiStatus === false ? "Not generated" : "Unavailable"}</strong>{aiStatus && aiStatus !== false && dateLabel(aiStatus.updatedAt) && <small>Updated {dateLabel(aiStatus.updatedAt)}</small>}</div>
                                            <div className="repo-fact report-fact"><span>Code review</span><strong className={`status-label ${reviewStatus && reviewStatus !== false ? "status-ready" : reviewStatus === false ? "status-empty" : "status-unknown"}`}>{reviewStatus && reviewStatus !== false ? "Saved" : reviewStatus === false ? "Not generated" : "Unavailable"}</strong>{reviewStatus && reviewStatus !== false && dateLabel(reviewStatus.updatedAt) && <small>Updated {dateLabel(reviewStatus.updatedAt)}</small>}</div>
                                        </div>

                                        {insightErrors[project.id] && <p className="inline-error" role="alert">{insightErrors[project.id]}</p>}
                                        {insight && <div className="activity-summary"><span><Icon name="branch" size={15} /> {insight.commits?.length ?? 0} recent commits returned</span><span>{insight.contributors?.length ?? 0} contributors returned</span></div>}

                                        <div className="repository-actions">
                                            {project.github_url && <button type="button" className="quiet-button" disabled={insightLoading[project.id]} onClick={() => loadGithubInsights(project.id)}>{insightLoading[project.id] ? "Loading activity…" : insight ? "Refresh activity" : "Load activity"}</button>}
                                            <Link to={`/project/${project.id}/analysis`} className="quiet-button">Analysis</Link>
                                            <Link to={`/project/${project.id}/code-review`} className="quiet-button">Code review</Link>
                                            <Link to={`/project/${project.id}`} className="row-detail-action">Open details <Icon name="arrow" size={15} /></Link>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}

function CoverageRow({ label, count, total, known }) {
    const percentage = known && total > 0 ? Math.round(count / total * 100) : null;
    return <div className="coverage-row">
        <div><strong>{label}</strong><span>{known ? `${count} of ${total} · ${percentage}%` : `Status unavailable for some repositories`}</span></div>
        <div className="coverage-track" role="progressbar" aria-label={`${label} coverage`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percentage ?? 0}>
            <i style={{ width: `${percentage ?? 0}%` }} />
        </div>
    </div>;
}

export default Dashboard;
