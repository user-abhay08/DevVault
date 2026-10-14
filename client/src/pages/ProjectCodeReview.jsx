import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function ProjectCodeReview() {
    const { id } = useParams();

    const [review, setReview] = useState(null);
    const [projectTitle, setProjectTitle] = useState("");
    const [projectUrl, setProjectUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [message, setMessage] = useState("");
    const rawScore = Number(review?.overallScore);
    const scoreValue = review?.overallScore !== null && review?.overallScore !== undefined && Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 100
        ? rawScore
        : null;

    useEffect(() => {
        let active = true;
        api.get(`/projects/${id}`).then((response) => {
            if (active) {
                const project = response.data.project || response.data;
                setProjectTitle(project.title || "");
                setProjectUrl(project.github_url || "");
            }
        }).catch(() => { if (active) { setProjectTitle(""); setProjectUrl(""); } });
        (async () => {
            try {
                const response = await api.get(`/ai/project/${id}/code-review`);
                if (active) setReview(response.data);
            } catch (error) {
                if (!active) return;
                if (error.response?.status === 404) setReview(null);
                else setMessage(error.response?.data?.message || "Failed to load code review.");
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [id]);

    const generateReview = async () => {
        try {
            setGenerating(true);
            setMessage("");

            const response = await api.post(
                `/ai/project/${id}/code-review`
            );

            setReview(
                response.data.review ||
                response.data
            );

        } catch (error) {
            setMessage(
                error.response?.data?.message ||
                "Code review generation failed."
            );
        } finally {
            setGenerating(false);
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
                            Loading AI code review...
                        </h3>

                        <p>
                            Retrieving your saved code review.
                        </p>
                    </div>
                </main>
            </>
        );
    }

    return (
        <>
            <Navbar />

            <main className="analysis-page">

                {/* HEADER */}

                <section className="analysis-header">

                    <div>

                        <p className="eyebrow">
                            {projectTitle ? `PROJECTS / ${projectTitle} / CODE REVIEW` : `PROJECT #${id}`}
                        </p>

                        <h1>
                            AI Code Review
                        </h1>

                        <p>
                            AI-reported findings from the files listed below. Findings and fixes require developer review.
                        </p>

                    </div>

                    <div className="analysis-actions">

                        <Link
                            to={`/project/${id}`}
                            className="secondary-button"
                        >
                            ← Project
                        </Link>

                        <Link
                            to={`/project/${id}/analysis`}
                            className="secondary-button"
                        >
                            Project Analysis
                        </Link>

                        <button
                            onClick={generateReview}
                            disabled={generating}
                            className="primary-button"
                        >
                            {generating
                                ? "Running review…"
                                : review
                                    ? "Run new review"
                                    : "Run review"}
                        </button>

                    </div>

                </section>


                {/* ERROR */}

                {message && (
                    <div className="error-card">

                        <strong>
                            Code Review Error
                        </strong>

                        <p>
                            {message}
                        </p>

                    </div>
                )}


                {/* GENERATING */}

                {generating && (
                    <div className="generating-card">

                        <div className="ai-loader">
                            AI
                        </div>

                        <h2>
                            Gemini is reviewing your code
                        </h2>

                        <p>
                            Fetching source files and analyzing
                            your project's code quality, security,
                            performance and maintainability.
                        </p>

                        <div className="loading-bar">
                            <div />
                        </div>

                    </div>
                )}


                {/* EMPTY */}

                {!review && !generating && (
                    <div className="empty-state ai-empty-state">

                        <div className="ai-empty-icon">
                            AI
                        </div>

                        <h2>
                            No Code Review Yet
                        </h2>

                        <p>
                            Generate an AI-powered review of
                            your project's source code.
                        </p>

                        <button
                            onClick={generateReview}
                            className="primary-button"
                        >
                            Run code review
                        </button>

                    </div>
                )}


                {/* REVIEW */}

                {review && !generating && (
                    <div className="analysis-content">

                        {/* SCORE */}

                        <section className="score-card-large" id="review-summary">

                            <div className="score-main">

                                <p>
                                    OVERALL CODE SCORE
                                </p>

                                {scoreValue !== null ? <div className="score-ring" role="meter" aria-label="Code review score" aria-valuemin="0" aria-valuemax="100" aria-valuenow={scoreValue} style={{ "--score": `${scoreValue}%` }}><div><strong>{scoreValue}</strong><span>/100</span></div></div> : <div className="score-unavailable"><strong>—</strong><span>/100</span></div>}
                                <span className="score-scale">Scale: 0–100</span>

                            </div>

                            <div className="score-description">

                                <h3>
                                    AI Code Assessment
                                </h3>

                                <p>
                                    {review.summary ||
                                        "No summary available."}
                                </p>

                            </div>

                        </section>

                        <section className="review-count-grid" aria-label="Review finding counts">
                            {[ ["Code quality", review.codeQuality], ["Security", review.security], ["Performance", review.performance], ["Maintainability", review.maintainability] ].map(([label, items]) => (
                                <article className="review-count-card" key={label}>
                                    <span>{label}</span><strong>{Array.isArray(items) ? items.length : 0}</strong><small>findings</small>
                                </article>
                            ))}
                        </section>

                        <nav className="review-tabs" aria-label="Review report sections">
                            <a href="#review-summary">Summary</a><a href="#review-issues">Issues</a><a href="#review-security">Security</a>
                            <a href="#review-performance">Performance</a><a href="#review-maintainability">Maintainability</a><a href="#review-recommendations">Recommendations</a>
                        </nav>


                        {/* CODE QUALITY */}

                        <ReviewSection
                            sectionId="review-quality"
                            number="01"
                            label="QUALITY"
                            title="Code Quality"
                            items={review.codeQuality}
                            repositoryUrl={projectUrl}
                        />


                        {/* BUGS */}

                        <ReviewSection
                            sectionId="review-issues"
                            number="02"
                            label="RELIABILITY"
                            title="Potential Bugs"
                            items={review.bugs}
                            repositoryUrl={projectUrl}
                        />


                        {/* SECURITY */}

                        <ReviewSection
                            sectionId="review-security"
                            number="03"
                            label="SECURITY"
                            title="Security"
                            items={review.security}
                            repositoryUrl={projectUrl}
                        />


                        {/* PERFORMANCE */}

                        <ReviewSection
                            sectionId="review-performance"
                            number="04"
                            label="PERFORMANCE"
                            title="Performance"
                            items={review.performance}
                            repositoryUrl={projectUrl}
                        />


                        {/* MAINTAINABILITY */}

                        <ReviewSection
                            sectionId="review-maintainability"
                            number="05"
                            label="ENGINEERING"
                            title="Maintainability"
                            items={review.maintainability}
                            repositoryUrl={projectUrl}
                        />


                        {/* RECOMMENDATIONS */}

                        <ReviewSection
                            sectionId="review-recommendations"
                            number="06"
                            label="IMPROVEMENT"
                            title="Recommendations"
                            items={review.recommendations}
                            repositoryUrl={projectUrl}
                        />


                        {/* REVIEWED FILES */}

                        <section className="analysis-card" id="review-files">

                            <div className="analysis-card-title">

                                <span className="section-icon">
                                    07
                                </span>

                                <div>

                                    <p className="eyebrow">
                                        SOURCE
                                    </p>

                                    <h2>
                                        Reviewed Files
                                    </h2>

                                    <p className="analysis-text">
                                        This review covers the readable source files listed here (up to 15 files and 200 KB total).
                                    </p>
                                    {review.sourceScan && <p className="source-scan-note">Secretlint scanned source before AI review. Files flagged for potential credentials were withheld from Gemini; only listed files were reviewed.</p>}

                                </div>

                            </div>

                            {review.reviewedFiles?.length ? (
                                <div className="tag-container">
                                {review.reviewedFiles.map(
                                    (file, index) => (
                                        <span
                                            className="tag"
                                            key={index}
                                        >
                                            {file}
                                        </span>
                                    )
                                )}
                                </div>
                            ) : <p className="analysis-text">No reviewed file list was saved with this result.</p>}

                        </section>


                        {/* TIMESTAMP */}

                        {review.updatedAt && (
                            <p className="timestamp">

                                Last reviewed:{" "}

                                {new Date(
                                    review.updatedAt
                                ).toLocaleString()}

                            </p>
                        )}

                    </div>
                )}

            </main>
        </>
    );
}


/*
 * Renders both:
 *
 * 1. String findings
 * 2. Object findings:
 *
 * {
 *     file: "...",
 *     line: 25,
 *     message: "..."
 * }
 */

function ReviewSection({
    sectionId,
    number,
    label,
    title,
    items,
    repositoryUrl
}) {

    return (
        <section className="analysis-card" id={sectionId}>

            <div className="analysis-card-title">

                <span className="section-icon">
                    {number}
                </span>

                        <div>

                    <p className="eyebrow">
                        {label}
                    </p>

                    <h2>
                        {title}
                    </h2>

                                    <span className="finding-count" aria-label={`${Array.isArray(items) ? items.length : 0} findings`}>
                                        {Array.isArray(items) ? items.length : 0}
                                    </span>

                </div>

            </div>


            {items && items.length > 0 ? (

                <div className="code-findings">

                    {items.map((item, index) => (

                        <div
                            className="code-finding"
                            key={index}
                        >

                            <div className="finding-number">
                                {index + 1}
                            </div>

                            <div className="finding-content">

                                {typeof item === "string" ? <>
                                    <p>{item}</p>
                                    <small className="evidence-note">Legacy saved finding; source evidence was not stored.</small>
                                </> : <>
                                    <div className="finding-heading">
                                        <h3>{item.title || item.message || "Code finding"}</h3>
                                        {item.severity && <span className={`severity-badge severity-${item.severity}`}>{item.severity}</span>}
                                    </div>
                                    <p>{item.explanation || item.description || "No explanation was saved."}</p>
                                    {item.file && <div className="finding-file">{item.lineStart ? `Line ${item.lineStart}${item.lineEnd && item.lineEnd !== item.lineStart ? `–${item.lineEnd}` : ""} · ` : ""}{item.file}
                                        {githubFileUrl(repositoryUrl, item.file, item.lineStart, item.lineEnd) && <> · <a href={githubFileUrl(repositoryUrl, item.file, item.lineStart, item.lineEnd)} target="_blank" rel="noopener noreferrer">Open source</a></>}
                                    </div>}
                                    {item.evidence && <blockquote className="finding-evidence"><code>{item.evidence}</code></blockquote>}
                                    {item.evidence && item.evidenceVerified && <small className="evidence-note evidence-verified">Evidence excerpt matched the reviewed source.</small>}
                                    {item.evidence && !item.evidenceVerified && <small className="evidence-note">This excerpt could not be matched exactly to the reviewed source.</small>}
                                    {item.impact && <p className="finding-impact"><strong>Impact:</strong> {item.impact}</p>}
                                    {item.recommendedFix && <p className="finding-fix"><strong>Suggested fix:</strong> {item.recommendedFix}</p>}
                                </>}

                            </div>

                        </div>

                    ))}

                </div>

            ) : (

                <p className="analysis-text">
                    No findings reported in this category.
                </p>

            )}

        </section>
    );
}

function githubFileUrl(repositoryUrl, file, lineStart, lineEnd) {
    try {
        const repository = new URL(repositoryUrl);
        if (repository.protocol !== "https:" || !["github.com", "www.github.com"].includes(repository.hostname)) return null;
        const parts = repository.pathname.split("/").filter(Boolean);
        if (parts.length !== 2 || !file || file.split("/").some((part) => part === "..")) return null;
        const path = file.split("/").map(encodeURIComponent).join("/");
        const line = Number.isInteger(lineStart) && lineStart > 0 ? `#L${lineStart}${Number.isInteger(lineEnd) && lineEnd > lineStart ? `-L${lineEnd}` : ""}` : "";
        return `https://github.com/${parts.map(encodeURIComponent).join("/")}/blob/HEAD/${path}${line}`;
    } catch {
        return null;
    }
}


export default ProjectCodeReview;
