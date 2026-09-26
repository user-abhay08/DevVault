import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function ProjectCodeReview() {
    const { id } = useParams();

    const [review, setReview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [message, setMessage] = useState("");

    const fetchReview = async () => {
        try {
            setLoading(true);
            setMessage("");

            const response = await api.get(
                `/ai/project/${id}/code-review`
            );

            setReview(response.data);

        } catch (error) {
            if (error.response?.status === 404) {
                setReview(null);
            } else {
                setMessage(
                    error.response?.data?.message ||
                    "Failed to load code review."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReview();
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
                            PROJECT #{id}
                        </p>

                        <h1>
                            AI Code Review
                        </h1>

                        <p>
                            AI-powered analysis of your project's
                            source code.
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
                                ? "Reviewing..."
                                : review
                                    ? "Refresh Review"
                                    : "Generate Review"}
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
                            Generate Code Review
                        </button>

                    </div>
                )}


                {/* REVIEW */}

                {review && !generating && (
                    <div className="analysis-content">

                        {/* SCORE */}

                        <section className="score-card-large">

                            <div className="score-main">

                                <p>
                                    OVERALL CODE SCORE
                                </p>

                                <div>

                                    <strong>
                                        {review.overallScore ?? 0}
                                    </strong>

                                    <span>
                                        /100
                                    </span>

                                </div>

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


                        {/* CODE QUALITY */}

                        <ReviewSection
                            number="01"
                            label="QUALITY"
                            title="Code Quality"
                            items={review.codeQuality}
                        />


                        {/* BUGS */}

                        <ReviewSection
                            number="02"
                            label="RELIABILITY"
                            title="Potential Bugs"
                            items={review.bugs}
                        />


                        {/* SECURITY */}

                        <ReviewSection
                            number="03"
                            label="SECURITY"
                            title="Security"
                            items={review.security}
                        />


                        {/* PERFORMANCE */}

                        <ReviewSection
                            number="04"
                            label="PERFORMANCE"
                            title="Performance"
                            items={review.performance}
                        />


                        {/* MAINTAINABILITY */}

                        <ReviewSection
                            number="05"
                            label="ENGINEERING"
                            title="Maintainability"
                            items={review.maintainability}
                        />


                        {/* RECOMMENDATIONS */}

                        <ReviewSection
                            number="06"
                            label="IMPROVEMENT"
                            title="Recommendations"
                            items={review.recommendations}
                        />


                        {/* REVIEWED FILES */}

                        <section className="analysis-card">

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

                                </div>

                            </div>

                            <div className="tag-container">

                                {review.reviewedFiles?.map(
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
    number,
    label,
    title,
    items
}) {

    return (
        <section className="analysis-card">

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

                                {typeof item === "string" ? (

                                    <p>
                                        {item}
                                    </p>

                                ) : (

                                    <>

                                        {item.file && (
                                            <div className="finding-file">
                                                {item.file}
                                            </div>
                                        )}

                                        {item.line && (
                                            <div className="finding-line">
                                                Line {item.line}
                                            </div>
                                        )}

                                        <p>
                                            {item.message ||
                                                item.description ||
                                                JSON.stringify(item)}
                                        </p>

                                    </>

                                )}

                            </div>

                        </div>

                    ))}

                </div>

            ) : (

                <p className="analysis-text">
                    No issues identified.
                </p>

            )}

        </section>
    );
}


export default ProjectCodeReview;