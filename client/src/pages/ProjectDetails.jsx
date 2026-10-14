import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";

const formatDate = (value, withTime = false) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
};

function ProjectDetails() {
    const { id } = useParams();
    const [project, setProject] = useState(null);
    const [github, setGithub] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [review, setReview] = useState(null);
    const [analysisStatus, setAnalysisStatus] = useState(null);
    const [reviewStatus, setReviewStatus] = useState(null);
    const [dependabot, setDependabot] = useState(null);
    const [securityLoading, setSecurityLoading] = useState(false);
    const [securityError, setSecurityError] = useState("");
    const [loading, setLoading] = useState(true);
    const [githubLoading, setGithubLoading] = useState(false);
    const [reportsLoading, setReportsLoading] = useState(true);
    const [githubError, setGithubError] = useState("");
    const [pageError, setPageError] = useState("");
    const [reportError, setReportError] = useState("");
    const [reportRetry, setReportRetry] = useState(0);
    const [editing, setEditing] = useState(false);
    const [savingProject, setSavingProject] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [projectForm, setProjectForm] = useState({ title: "", description: "", github_url: "", live_url: "" });

    useEffect(() => {
        let active = true;
        async function loadWorkspace() {
            setReportError("");
            try {
                const response = await api.get(`/projects/${id}`);
                const loadedProject = response.data.project || response.data;
                if (!active) return;
                setProject(loadedProject);
                setDependabot(null);
                setSecurityError("");
                setProjectForm({
                    title: loadedProject.title || "",
                    description: loadedProject.description || "",
                    github_url: loadedProject.github_url || "",
                    live_url: loadedProject.live_url || ""
                });
                setLoading(false);
                setGithubLoading(Boolean(loadedProject.github_url));
                setSecurityLoading(Boolean(loadedProject.github_url));

                const githubRequest = loadedProject.github_url
                    ? api.get(`/github/project/${id}/insights`)
                    : Promise.resolve(null);
                const securityRequest = loadedProject.github_url
                    ? api.get(`/github/project/${id}/security/dependabot`)
                    : Promise.resolve(null);
                const [githubResult, analysisStatusResult, reviewStatusResult, securityResult] = await Promise.allSettled([
                    githubRequest,
                    api.get(`/ai/project/${id}/analysis/status`),
                    api.get(`/ai/project/${id}/code-review/status`),
                    securityRequest
                ]);
                if (!active) return;

                if (githubResult.status === "fulfilled" && githubResult.value) {
                    setGithub(githubResult.value.data?.github || null);
                } else if (githubResult.status === "rejected") {
                    setGithubError(githubResult.reason.response?.data?.message || "GitHub repository data is unavailable.");
                }
                if (securityResult.status === "fulfilled" && securityResult.value) {
                    setDependabot(securityResult.value.data);
                    setSecurityError("");
                } else if (securityResult.status === "rejected") {
                    setSecurityError(securityResult.reason.response?.data?.message || "GitHub Dependabot status could not be loaded.");
                }

                let analysisAvailable = false;
                if (analysisStatusResult.status === "fulfilled") {
                    const status = analysisStatusResult.value.data;
                    analysisAvailable = status.analysisAvailable === true;
                    setAnalysisStatus(status);
                } else {
                    setReportError("Could not check saved analysis status.");
                }

                let reviewAvailable = false;
                if (reviewStatusResult.status === "fulfilled") {
                    const status = reviewStatusResult.value.data;
                    reviewAvailable = status.reviewAvailable === true;
                    setReviewStatus(status);
                } else {
                    setReportError("Could not check saved report status.");
                }

                const reportResults = await Promise.allSettled([
                    analysisAvailable ? api.get(`/ai/project/${id}/analysis`) : Promise.resolve(null),
                    reviewAvailable ? api.get(`/ai/project/${id}/code-review`) : Promise.resolve(null)
                ]);
                if (!active) return;
                if (reportResults[0].status === "fulfilled" && reportResults[0].value) {
                    setAnalysis(reportResults[0].value.data.analysis || reportResults[0].value.data);
                } else if (reportResults[0].status === "rejected") {
                    setReportError("Saved analysis could not be loaded.");
                }
                if (reportResults[1].status === "fulfilled" && reportResults[1].value) {
                    setReview(reportResults[1].value.data);
                } else if (reportResults[1].status === "rejected") {
                    setReportError("Saved code review could not be loaded.");
                }
            } catch (error) {
                if (active) setPageError(error.response?.data?.message || "Unable to load this project.");
            } finally {
                if (active) {
                    setLoading(false);
                    setGithubLoading(false);
                    setSecurityLoading(false);
                    setReportsLoading(false);
                }
            }
        }
        loadWorkspace();
        return () => { active = false; };
    }, [id, reportRetry]);

    const loadGithubData = async () => {
        setGithubLoading(true);
        setGithubError("");
        try {
            const response = await api.get(`/github/project/${id}/insights`);
            setGithub(response.data?.github || null);
        } catch (error) {
            setGithubError(error.response?.data?.message || "Unable to load GitHub data. Try again.");
        } finally {
            setGithubLoading(false);
        }
        await loadDependabot();
    };

    const loadDependabot = async () => {
        setSecurityLoading(true);
        setSecurityError("");
        try {
            const response = await api.get(`/github/project/${id}/security/dependabot`);
            setDependabot(response.data);
        } catch (error) {
            setSecurityError(error.response?.data?.message || "GitHub Dependabot status could not be loaded.");
        } finally {
            setSecurityLoading(false);
        }
    };

    const saveProject = async (event) => {
        event.preventDefault();
        setSavingProject(true);
        setSaveMessage("");
        try {
            await api.put(`/projects/${id}`, projectForm);
            setProject((current) => ({ ...current, ...projectForm }));
            setEditing(false);
            setSaveMessage("Project details saved.");
            if (project.github_url !== projectForm.github_url) {
                setGithub(null);
                setDependabot(null);
                if (projectForm.github_url) await loadGithubData();
            }
        } catch (error) {
            setSaveMessage(error.response?.data?.message || "Could not save project details.");
        } finally {
            setSavingProject(false);
        }
    };

    const repository = github?.repository || null;
    const languages = useMemo(() => Object.entries(github?.languages || {})
        .map(([name, bytes]) => [name, Number(bytes)])
        .filter(([, bytes]) => Number.isFinite(bytes) && bytes > 0)
        .sort((a, b) => b[1] - a[1]), [github]);
    const languageTotal = languages.reduce((sum, [, bytes]) => sum + Number(bytes || 0), 0);
    const reviewGroups = [
        ["security", review?.security],
        ["bugs", review?.bugs],
        ["performance", review?.performance],
        ["maintainability", review?.maintainability],
        ["code quality", review?.codeQuality]
    ];
    const reviewFindingTotal = reviewGroups.reduce((sum, [, items]) => sum + (Array.isArray(items) ? items.length : 0), 0);
    const reportedRisks = ["security", "bugs"].flatMap((category) => (review?.[category] || []).map((finding) => ({
        category,
        finding,
        severity: typeof finding === "object" ? finding.severity || "unknown" : "unknown"
    }))).sort((a, b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 4);
    const analysisStrengths = (analysis?.strengths || []).slice(0, 3);
    const healthActions = [
        ...reviewGroups.flatMap(([category, items]) => (items || []).filter((item) => item && typeof item === "object" && item.recommendedFix).map((item) => ({
            text: recommendationText(item),
            source: `AI review · ${category} · ${item.severity || "severity unknown"}`,
            href: `/project/${id}/code-review`,
            priority: severityRank(item.severity)
        }))),
        ...(review?.recommendations || []).map((item) => ({ text: recommendationText(item), source: "AI review recommendation", href: `/project/${id}/code-review`, priority: severityRank(item?.severity) })),
        ...(analysis?.recommendations || []).map((item) => ({ text: recommendationText(item), source: "AI analysis recommendation", href: `/project/${id}/analysis`, priority: 0 })),
        ...(analysis?.nextSteps || analysis?.next_steps || []).map((item) => ({ text: recommendationText(item), source: "AI analysis next step", href: `/project/${id}/analysis`, priority: 0 }))
    ].filter((item) => item.text).sort((a, b) => b.priority - a.priority)
        .filter((item, index, all) => all.findIndex((candidate) => candidate.text.toLowerCase() === item.text.toLowerCase()) === index).slice(0, 5);

    if (loading || (project && String(project.id) !== String(id) && !pageError)) return <><Navbar /><main className="page"><div className="loading-panel"><span className="spinner" /><p>Loading project workspace…</p></div></main></>;
    if (!project || String(project.id) !== String(id)) return <><Navbar /><main className="page"><div className="error-card" role="alert">{pageError || "Project not found."}</div><Link className="secondary-button" to="/dashboard">Back to repositories</Link></main></>;

    return (
        <>
            <Navbar />
            <main className="project-details-page app-content">
                <div className="breadcrumb"><Link to="/dashboard">Repositories</Link><span>/</span><span>{project.title || `Project ${id}`}</span></div>
                <section className="project-details-header workspace-heading">
                    <div className="workspace-title">
                        <span className="repository-mark large"><Icon name="code" size={22} /></span>
                        <div>
                            <p className="eyebrow">REPOSITORY WORKSPACE</p>
                            <h1>{project.title || "Untitled project"}</h1>
                            <p>{project.description || "A tracked GitHub repository in your workspace."}</p>
                        </div>
                    </div>
                    <div className="analysis-actions">
                        <button type="button" className="secondary-button" onClick={() => { setEditing((value) => !value); setSaveMessage(""); }}>
                            {editing ? "Close editor" : "Edit details"}
                        </button>
                        <Link to={`/project/${id}/analysis`} className="primary-button">View analysis <Icon name="arrow" size={15} /></Link>
                        <Link to={`/project/${id}/code-review`} className="secondary-button">Code review</Link>
                    </div>
                </section>

                <nav className="workspace-tabs" aria-label="Project sections">
                    <a href="#overview">Overview</a>
                    <a href="#health">Health</a>
                    <Link to={`/project/${id}/analysis`}>AI Analysis</Link>
                    <Link to={`/project/${id}/code-review`}>Code Review</Link>
                    {project.github_url && <a href="#security">Security</a>}
                    {github && <><a href="#commits">Commits</a><a href="#contributors">Contributors</a></>}
                </nav>

                {pageError && <div className="error-card" role="alert">{pageError}</div>}
                {editing && (
                    <section className="repository-form-card edit-project-card">
                        <div className="section-header"><div><h2>Project details</h2><p>Update the information DevVault keeps for this repository.</p></div></div>
                        <form className="repository-form" onSubmit={saveProject}>
                            <label htmlFor="edit-title">Project name</label>
                            <input id="edit-title" required minLength={3} value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} />
                            <label htmlFor="edit-description">Description</label>
                            <textarea id="edit-description" value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} />
                            <label htmlFor="edit-github-url">GitHub repository URL</label>
                            <input id="edit-github-url" type="url" value={projectForm.github_url} onChange={(event) => setProjectForm({ ...projectForm, github_url: event.target.value })} />
                            <label htmlFor="edit-live-url">Live project URL</label>
                            <input id="edit-live-url" type="url" value={projectForm.live_url} onChange={(event) => setProjectForm({ ...projectForm, live_url: event.target.value })} />
                            {saveMessage && <p className="form-feedback" role="status">{saveMessage}</p>}
                            <button className="primary-button" disabled={savingProject}>{savingProject ? "Saving…" : "Save changes"}</button>
                        </form>
                    </section>
                )}
                {!editing && saveMessage && <p className="form-feedback" role="status">{saveMessage}</p>}

                <section className="repository-overview-panel" id="overview">
                    <div className="repository-overview-head">
                        <div>
                            <p className="eyebrow">GITHUB REPOSITORY</p>
                            {repository?.full_name ? <h2>{repository.full_name}</h2> : <h2>Repository metadata</h2>}
                            <p>{repository?.description || project.description || "No repository description provided."}</p>
                        </div>
                        {repository?.html_url || project.github_url ? <a href={repository?.html_url || project.github_url} target="_blank" rel="noopener noreferrer" className="secondary-button">Open on GitHub <Icon name="external" size={15} /></a> : null}
                    </div>

                    {githubLoading && <div className="inline-loading"><span className="small-spinner" /> Loading GitHub repository data…</div>}
                    {githubError && <div className="inline-error-box" role="alert"><span>{githubError}</span><button className="quiet-button" type="button" onClick={loadGithubData}>Retry</button></div>}
                    {!project.github_url && <div className="inline-note">Add a GitHub URL to this project to load repository details.</div>}

                    {repository && (
                        <>
                            <div className="metric-grid">
                                <Metric icon="star" label="Stars" value={repository.stars} available={Number.isFinite(repository.stars)} />
                                <Metric icon="fork" label="Forks" value={repository.forks} available={Number.isFinite(repository.forks)} />
                                <Metric icon="warning" label="Open issues" value={repository.open_issues_count} available={Number.isFinite(repository.open_issues_count)} />
                                <Metric icon="user" label="Watchers" value={repository.watchers_count} available={Number.isFinite(repository.watchers_count)} />
                            </div>
                            <div className="repository-meta-row">
                                <span>Primary language <strong>{repository.language || "Not specified"}</strong></span>
                                <span>Updated on GitHub <strong>{formatDate(repository.updated_at)}</strong></span>
                                {Array.isArray(github?.contributors) && <span>Contributors <strong>{github.contributors.length}</strong></span>}
                                {project.live_url && <a href={project.live_url} target="_blank" rel="noopener noreferrer">Live project <Icon name="external" size={13} /></a>}
                            </div>
                        </>
                    )}
                </section>

                <section className="workspace-section health-overview" id="health">
                    <div className="section-header"><div><h2>Repository health signals</h2><p>No combined health score: saved AI scores are opinions, and GitHub metadata covers only the signals shown here.</p></div></div>
                    <div className="health-signal-grid">
                        <HealthSignal title="AI project analysis" value={analysis ? `${analysis.projectScore ?? "—"} / 100` : analysisStatus?.analysisAvailable === false ? "Not analyzed" : "Unavailable"} note={analysis ? "AI-generated assessment · latest saved run" : "Run an analysis to record project observations."} />
                        <HealthSignal title="AI code review" value={review ? `${reviewFindingTotal} reported finding${reviewFindingTotal === 1 ? "" : "s"}` : reviewStatus?.reviewAvailable === false ? "Not reviewed" : "Unavailable"} note={review ? `AI score ${review.overallScore ?? "unavailable"} / 100 · findings are not independently verified` : "Run a code review to inspect supported source files."} />
                        <HealthSignal title="Dependency alerts" value={dependabot?.status === "available" ? `${dependabot.alerts?.length || 0} open` : securityLoading ? "Checking…" : "Not scanned"} note={dependabot?.status === "available" ? "GitHub Dependabot alerts only" : project.github_url ? dependabotStatusMessage(dependabot?.status || "unavailable") : "Connect a GitHub repository to check Dependabot."} />
                        <HealthSignal title="GitHub activity" value={repository ? `${Number(repository.open_issues_count || 0).toLocaleString()} open issues + PRs` : "Unavailable"} note={repository?.updated_at ? `Repository updated ${formatDate(repository.updated_at)}` : "Repository metadata is unavailable."} />
                    </div>
                    <div className="health-detail-grid">
                        <section className="health-detail-card"><h3>AI reported risks</h3>{reportedRisks.length ? <ul>{reportedRisks.map(({ category, finding }, index) => <li key={`${category}-${index}`}><span className={`severity-badge severity-${typeof finding === "object" ? finding.severity || "unknown" : "unknown"}`}>{typeof finding === "object" ? finding.severity || "severity unknown" : "legacy finding"}</span><span>{findingText(finding)}</span></li>)}</ul> : <p>{review ? "No security or bug findings were saved by the latest review." : "No saved code review is available."}</p>}</section>
                        <section className="health-detail-card"><h3>Positive observations</h3>{analysisStrengths.length ? <ul>{analysisStrengths.map((item, index) => <li key={index}>{recommendationText(item)}</li>)}</ul> : <p>{analysis ? "No positive observations were included in the saved analysis." : "No saved analysis is available."}</p>}</section>
                        <section className="health-detail-card health-actions-card"><h3>Suggested next actions</h3><p className="health-actions-note">AI review severity labels sort review fixes first; the model’s labels are not independently verified.</p>{healthActions.length ? <ul>{healthActions.map((item, index) => <li key={`${item.source}-${index}`}><span><small>{item.source}</small>{item.text}</span><Link to={item.href} aria-label={`Open ${item.source}`}>Open report <Icon name="arrow" size={14} /></Link></li>)}</ul> : <p>Generate an analysis or code review to get recommendations grounded in this repository's available data.</p>}</section>
                    </div>
                </section>

                {project.github_url && <section className="workspace-section security-section" id="security">
                    <div className="section-header"><div><h2>Dependency security</h2><p>Open dependency advisories reported by GitHub Dependabot.</p></div>{!securityLoading && <button type="button" className="quiet-button" onClick={loadDependabot}>Refresh</button>}</div>
                    {securityLoading && <div className="inline-loading"><span className="small-spinner" /> Checking Dependabot alerts…</div>}
                    {securityError && <div className="inline-error-box" role="alert"><span>{securityError}</span><button type="button" className="quiet-button" onClick={loadDependabot}>Retry</button></div>}
                    {!securityLoading && !securityError && dependabot?.status === "available" && (dependabot.alerts || []).length === 0 && <p className="security-empty">GitHub reports no open Dependabot alerts. This checks dependency advisories only; it is not a complete security scan.</p>}
                    {!securityLoading && !securityError && dependabot?.status === "available" && dependabot.truncated && <p className="security-empty">Showing the first 100 open alerts. More may be available on GitHub.</p>}
                    {!securityLoading && !securityError && dependabot?.status && dependabot.status !== "available" && <p className="security-unavailable">{dependabotStatusMessage(dependabot.status)}</p>}
                    {!securityLoading && !securityError && dependabot?.status === "available" && Boolean(dependabot.alerts?.length) && <div className="dependabot-alert-list">{dependabot.alerts.map((alert) => <article className="dependabot-alert" key={alert.number}>
                        <span className={`severity-badge severity-${alert.severity || "unknown"}`}>{alert.severity || "severity unavailable"}</span>
                        <div><h3>{alert.package}</h3><p>{alert.summary}</p><small>{[alert.ecosystem, alert.manifestPath, alert.vulnerableRange && `Affected: ${alert.vulnerableRange}`, alert.fixedVersion && `Fixed in: ${alert.fixedVersion}`].filter(Boolean).join(" · ")}</small></div>
                        {alert.advisoryUrl && <a href={alert.advisoryUrl} target="_blank" rel="noopener noreferrer" className="row-detail-action">Advisory <Icon name="external" size={14} /></a>}
                    </article>)}</div>}
                </section>}

                {languages.length > 0 && (
                    <section className="workspace-section language-section" id="languages">
                        <div className="section-header"><div><h2>Language breakdown</h2><p>Based on GitHub’s language byte counts.</p></div></div>
                        <div className="language-bars" role="img" aria-label={`Language distribution: ${languages.map(([language, bytes]) => `${language} ${Math.round(bytes / languageTotal * 100)} percent`).join(", ")}`}>
                            {languages.map(([language, bytes], index) => <span key={language} className={`language-bar language-tone-${index % 5}`} style={{ width: `${Math.max(1, bytes / languageTotal * 100)}%` }} title={`${language}: ${Math.round(bytes / languageTotal * 100)}%`} />)}
                        </div>
                        <div className="language-legend">{languages.map(([language, bytes], index) => <span key={language}><i className={`language-dot language-tone-${index % 5}`} />{language}<strong>{Math.round(bytes / languageTotal * 100)}%</strong></span>)}</div>
                    </section>
                )}

                <section className="workspace-section reports-section" id="reports">
                    <div className="section-header"><div><h2>Latest AI reports</h2><p>Saved results remain available until a new report replaces them.</p></div></div>
                    {reportError && <div className="inline-error-box" role="alert"><span>{reportError}</span><button type="button" className="quiet-button" onClick={() => { setReportsLoading(true); setReportRetry((value) => value + 1); }}>Retry reports</button></div>}
                    {reportsLoading ? <div className="loading-panel compact-loading"><span className="spinner" /><p>Checking saved reports…</p></div> : (
                        <div className="report-preview-grid">
                            <ReportPreview type="analysis" data={analysis} status={analysisStatus} projectId={id} />
                            <ReportPreview type="review" data={review} status={reviewStatus} projectId={id} />
                        </div>
                    )}
                </section>

                {github && (
                    <section className="workspace-section activity-section" id="activity">
                        <div className="section-header"><div><h2>Recent GitHub activity</h2><p>Recent items returned by the GitHub API.</p></div></div>
                        <div className="activity-grid">
                            <div className="activity-column" id="commits">
                                <h3><Icon name="branch" size={16} /> Recent commits</h3>
                                {github.commits?.length ? github.commits.slice(0, 4).map((commit) => <div className="commit-row" key={commit.sha}><span className="commit-marker" /><div><strong>{commit.message?.split("\n")[0] || "Commit"}</strong><small>{commit.author || "Unknown author"} · {formatDate(commit.date)}</small></div></div>) : <p className="muted-text">{github.availability?.commits === false ? "GitHub could not return commit data." : "No recent commits returned."}</p>}
                            </div>
                            <div className="activity-column" id="contributors">
                                <h3><Icon name="user" size={16} /> Contributors</h3>
                                {github.contributors?.length ? <div className="contributor-list">{github.contributors.slice(0, 6).map((contributor) => <div className="contributor-row" key={contributor.id || contributor.login}><span className="contributor-avatar">{(contributor.login || "?").slice(0, 1).toUpperCase()}</span><strong>{contributor.login || "Contributor"}</strong><span>{Number(contributor.contributions || 0).toLocaleString()} contributions</span></div>)}</div> : <p className="muted-text">{github.availability?.contributors === false ? "GitHub could not return contributor data." : "No contributor data returned."}</p>}
                            </div>
                            <ActivityList title="Open issues" icon="warning" items={github.issues} available={github.availability?.issues !== false} />
                            <ActivityList title="Open pull requests" icon="branch" items={github.pullRequests} available={github.availability?.pullRequests !== false} />
                        </div>
                    </section>
                )}
            </main>
        </>
    );
}

function Metric({ icon, label, value, available }) {
    return <div className="metric-card"><span className="metric-icon"><Icon name={icon} size={16} /></span><span>{label}</span><strong>{available ? Number(value).toLocaleString() : "Unavailable"}</strong></div>;
}

function HealthSignal({ title, value, note }) {
    return <article className="health-signal"><span>{title}</span><strong>{value}</strong><small>{note}</small></article>;
}

function findingText(finding) {
    if (typeof finding === "string") return finding;
    return finding?.title || finding?.explanation || finding?.message || "Finding details unavailable.";
}

function recommendationText(item) {
    if (typeof item === "string") return item.trim();
    return item?.recommendedFix || item?.explanation || item?.title || item?.text || "";
}

function severityRank(severity) {
    return ({ critical: 4, high: 3, medium: 2, low: 1 })[String(severity).toLowerCase()] || 0;
}

function ActivityList({ title, icon, items = [], available = true }) {
    return <div className="activity-column">
        <h3><Icon name={icon} size={16} /> {title}</h3>
        {items.length ? <div className="github-activity-list">{items.map((item) => <a href={item.url} target="_blank" rel="noopener noreferrer" className="github-activity-row" key={item.number}>
            <strong>{item.title || `#${item.number}`}</strong>
            <small>#{item.number}{item.author ? ` · ${item.author}` : ""} · updated {formatDate(item.updatedAt)}</small>
        </a>)}</div> : <p className="muted-text">{available ? "No open items returned by GitHub." : "GitHub could not return this activity data."}</p>}
    </div>;
}

function ReportPreview({ type, data, status, projectId }) {
    const isAnalysis = type === "analysis";
    const available = isAnalysis ? status?.analysisAvailable : status?.reviewAvailable;
    const title = isAnalysis ? "Project analysis" : "Code review";
    const score = isAnalysis ? data?.projectScore : data?.overallScore;
    const summary = isAnalysis ? data?.projectOverview : data?.summary;
    const timestamp = data?.updatedAt || status?.updatedAt;
    return (
        <article className="report-preview">
            <div className="report-preview-top"><span className={`report-mark ${isAnalysis ? "report-mark-ai" : "report-mark-review"}`}><Icon name={isAnalysis ? "branch" : "check"} size={17} /></span><span className={`status-label ${available ? "status-ready" : available === false ? "status-empty" : "status-unknown"}`}>{available ? "Saved" : available === false ? "Not generated" : "Unavailable"}</span></div>
            <h3>{title}</h3>
            {reportsStatusError(status) ? <p>Report status could not be retrieved.</p> : available ? <><p>{summary || "The saved report has no summary."}</p>{Number.isFinite(Number(score)) && <div className="report-score"><strong>{Number(score)}</strong><span>/ 100</span></div>}<small>{timestamp ? `Updated ${formatDate(timestamp, true)}` : "Saved report"}</small></> : <p>Generate a report to see findings and recommendations for this repository.</p>}
            <Link to={`/project/${projectId}/${isAnalysis ? "analysis" : "code-review"}`} className="report-link">{available ? "Open report" : `Generate ${isAnalysis ? "analysis" : "review"}`} <Icon name="arrow" size={15} /></Link>
        </article>
    );
}

const reportsStatusError = (status) => status === null;

function dependabotStatusMessage(status) {
    if (status === "permission_required") return "Dependabot alerts require a GitHub token with Dependabot alerts read permission. No security scan result is available.";
    if (status === "rate_limited") return "GitHub rate limited the alert request. No security scan result is available; try again later.";
    if (status === "unavailable") return "Dependabot alerts are unavailable or disabled for this repository. No security scan result is available.";
    return "GitHub Dependabot could not be reached. No security scan result is available.";
}

export default ProjectDetails;
