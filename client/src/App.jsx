import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProjectDetails from "./pages/ProjectDetails";
import ProjectAnalysis from "./pages/ProjectAnalysis";
import ProjectCodeReview from "./pages/ProjectCodeReview";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import GitHubOAuthCallback from "./pages/GitHubOAuthCallback";
import ProtectedRoute from "./components/ProtectedRoute";
import { ThemeProvider } from "./components/ThemeProvider";

function App() {
    return (
        <ThemeProvider>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/oauth/callback" element={<GitHubOAuthCallback />} />

                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/project/:id"
                    element={
                        <ProtectedRoute>
                            <ProjectDetails />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/project/:id/analysis"
                    element={
                        <ProtectedRoute>
                            <ProjectAnalysis />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/project/:id/code-review"
                    element={
                        <ProtectedRoute>
                            <ProjectCodeReview />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/profile"
                    element={
                        <ProtectedRoute>
                            <Profile />
                        </ProtectedRoute>
                    }
                />

                <Route path="*" element={<NotFound />} />
            </Routes>
        </BrowserRouter>
        </ThemeProvider>
    );
}

export default App;
