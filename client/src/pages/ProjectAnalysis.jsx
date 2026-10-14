import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../services/api";
import Navbar from "../components/Navbar";

function ProjectAnalysis() {

    const { id } = useParams();

    const [analysis, setAnalysis] = useState(null);
    const [status, setStatus] = useState(null);
    const [projectTitle, setProjectTitle] = useState("");

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    const [message, setMessage] = useState("");
    const rawScore = Number(analysis?.projectScore);
    const scoreValue = analysis?.projectScore !== null && analysis?.projectScore !== undefined && Number.isFinite(rawScore) && rawScore >= 0 && rawScore <= 100
        ? rawScore
        : null;
    const lastUpdatedAt = analysis?.updatedAt || status?.updatedAt || status?.updated_at;


    const fetchAnalysis = async () => {

        try {

            const statusResponse =
                await api.get(
                    `/ai/project/${id}/analysis/status`
                );

            setStatus(statusResponse.data);

            if (
                statusResponse.data.analysisAvailable
            ) {

                const response =
                    await api.get(
                        `/ai/project/${id}/analysis`
                    );

                setAnalysis(
                    response.data.analysis ||
                    response.data
                );

            } else {

                setAnalysis(null);
            }

        } catch (error) {

            setMessage(
                error.response?.data?.message ||
                "Failed to load AI analysis."
            );

        } finally {

            setLoading(false);
        }
    };


    useEffect(() => {
        let active = true;
        api.get(`/projects/${id}`).then((response) => {
            if (active) setProjectTitle((response.data.project || response.data).title || "");
        }).catch(() => { if (active) setProjectTitle(""); });
        (async () => {
            try {
                const statusResponse = await api.get(`/ai/project/${id}/analysis/status`);
                if (!active) return;
                setStatus(statusResponse.data);
                if (statusResponse.data.analysisAvailable) {
                    const response = await api.get(`/ai/project/${id}/analysis`);
                    if (active) setAnalysis(response.data.analysis || response.data);
                } else if (active) {
                    setAnalysis(null);
                }
            } catch (error) {
                if (active) setMessage(error.response?.data?.message || "Failed to load AI analysis.");
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [id]);


    const generateAnalysis = async () => {

        setGenerating(true);
        setMessage("");

        try {

            const response =
                await api.post(
                    `/ai/project/${id}/analyze`
                );

            setAnalysis(
                response.data.analysis ||
                response.data
            );

            await fetchAnalysis();

        } catch (error) {

            setMessage(
                error.response?.data?.message ||
                "AI analysis failed."
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
                            Loading AI analysis...
                        </h3>

                        <p>
                            Retrieving your saved analysis.
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

                {/* Header */}

                <section className="analysis-header">

                    <div>

                        <p className="eyebrow">
                            {projectTitle ? `PROJECTS / ${projectTitle} / AI ANALYSIS` : `PROJECT #${id}`}
                        </p>

                        <h1>
                            AI Project Analysis
                        </h1>

                        <p>
                            Intelligent engineering insights
                            generated from your GitHub project.
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
                            to={`/project/${id}/code-review`}
                            className="secondary-button"
                        >
                            AI Code Review
                        </Link>


                        <button
                            onClick={generateAnalysis}
                            disabled={generating}
                            className="primary-button"
                        >
                            {generating
                                ? "Running analysis…"
                                : analysis
                                    ? "Run new analysis"
                                    : "Run analysis"}
                        </button>

                    </div>

                </section>


                {/* Error */}

                {message && (

                    <div className="error-card">

                        <strong>
                            Analysis Error
                        </strong>

                        <p>
                            {message}
                        </p>

                    </div>
                )}


                {/* Generating */}

                {generating && (

                    <div className="generating-card">

                        <div className="ai-loader">
                            AI
                        </div>

                        <h2>
                            Gemini is analyzing your project
                        </h2>

                        <p>
                            Reviewing your repository data and
                            generating engineering insights.
                        </p>

                        <div className="loading-bar">
                            <div />
                        </div>

                    </div>
                )}


                {/* Empty */}

                {!analysis &&
                    !generating && (

                        <div className="empty-state ai-empty-state">

                            <div className="ai-empty-icon">
                                AI
                            </div>

                            <h2>
                                No AI analysis yet
                            </h2>

                            <p>
                                Generate an AI-powered review of
                                this developer project.
                            </p>

                            <button
                                onClick={generateAnalysis}
                                className="primary-button"
                            >
                                Run analysis
                            </button>

                        </div>
                    )}


                {/* Analysis */}

                {analysis &&
                    !generating && (

                        <div className="analysis-content">


                            {/* Score */}

                            <section className="score-card-large">

                                <div className="score-main">

                                    <p>
                                        OVERALL PROJECT SCORE
                                    </p>

                                    {scoreValue !== null ? <div className="score-ring" role="meter" aria-label="Project assessment score" aria-valuemin="0" aria-valuemax="100" aria-valuenow={scoreValue} style={{ "--score": `${scoreValue}%` }}><div><strong>{scoreValue}</strong><span>/100</span></div></div> : <div className="score-unavailable"><strong>—</strong><span>/100</span></div>}
                                    <span className="score-scale">Scale: 0–100</span>

                                </div>


                                <div className="score-description">

                                    <h3>
                                        AI Assessment
                                    </h3>

                                    <p>
                                        This score represents the
                                        AI's assessment based on the
                                        available project and
                                        repository information.
                                    </p>

                                </div>

                            </section>


                            {/* Overview */}

                            <section className="analysis-card">

                                <div className="analysis-card-title">

                                    <span className="section-icon">
                                        01
                                    </span>

                                    <div>

                                        <p className="eyebrow">
                                            SUMMARY
                                        </p>

                                        <h2>
                                            Project Overview
                                        </h2>

                                    </div>

                                </div>

                                <p className="analysis-text">
                                    {analysis.projectOverview ||
                                        "No overview available."}
                                </p>

                            </section>


                            {/* Technologies */}

                            <section className="analysis-card">

                                <div className="analysis-card-title">

                                    <span className="section-icon">
                                        02
                                    </span>

                                    <div>

                                        <p className="eyebrow">
                                            STACK
                                        </p>

                                        <h2>
                                            Technologies
                                        </h2>

                                    </div>

                                </div>

                                <div className="tag-container">

                                    {analysis.technologies?.map(
                                        (technology, index) => (

                                            <span
                                                className="tag"
                                                key={index}
                                            >
                                                {technology}
                                            </span>

                                        )
                                    )}

                                </div>

                            </section>


                            {/* Strengths / Weaknesses */}

                            <div className="analysis-grid">

                                <section className="analysis-card finding-positive">

                                    <div className="analysis-card-title">

                                        <span className="section-icon">
                                            03
                                        </span>

                                        <div>

                                            <p className="eyebrow">
                                                POSITIVE
                                            </p>

                                            <h2>
                                                Strengths
                                            </h2>

                                        </div>

                                    </div>

                                    <ul className="analysis-list">

                                        {analysis.strengths?.map(
                                            (item, index) => (

                                                <li key={index}>
                                                    {item}
                                                </li>

                                            )
                                        )}

                                    </ul>

                                </section>


                                <section className="analysis-card finding-risk">

                                    <div className="analysis-card-title">

                                        <span className="section-icon">
                                            04
                                        </span>

                                        <div>

                                            <p className="eyebrow">
                                                IMPROVE
                                            </p>

                                            <h2>
                                                Weaknesses
                                            </h2>

                                        </div>

                                    </div>

                                    <ul className="analysis-list">

                                        {analysis.weaknesses?.map(
                                            (item, index) => (

                                                <li key={index}>
                                                    {item}
                                                </li>

                                            )
                                        )}

                                    </ul>

                                </section>

                            </div>


                            {/* Recommendations */}

                            <section className="analysis-card">

                                <div className="analysis-card-title">

                                    <span className="section-icon">
                                        05
                                    </span>

                                    <div>

                                        <p className="eyebrow">
                                            IMPROVEMENT
                                        </p>

                                        <h2>
                                            Recommendations
                                        </h2>

                                    </div>

                                </div>

                                <ul className="analysis-list">

                                    {analysis.recommendations?.map(
                                        (item, index) => (

                                            <li key={index}>
                                                {item}
                                            </li>

                                        )
                                    )}

                                </ul>

                            </section>


                            {/* Next Steps */}

                            <section className="analysis-card">

                                <div className="analysis-card-title">

                                    <span className="section-icon">
                                        06
                                    </span>

                                    <div>

                                        <p className="eyebrow">
                                            ACTION PLAN
                                        </p>

                                        <h2>
                                            Recommended Next Steps
                                        </h2>

                                    </div>

                                </div>

                                <ol className="analysis-list numbered">

                                    {(
                                        analysis.next_steps ||
                                        analysis.nextSteps ||
                                        []
                                    ).map(
                                        (item, index) => (

                                            <li key={index}>
                                                {item}
                                            </li>

                                        )
                                    )}

                                </ol>

                            </section>


                            {/* Timestamp */}

                            {lastUpdatedAt && (

                                    <p className="timestamp">

                                        Last analyzed:{" "}

                                        {new Date(lastUpdatedAt).toLocaleString()}

                                    </p>

                                )}

                        </div>
                    )}

            </main>
        </>
    );
}

export default ProjectAnalysis;
