import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children }) {

    const location = useLocation();

    const token = localStorage.getItem("token");

    if (!token) {

        return (
            <Navigate
                to="/"
                replace
                state={{
                    from: location.pathname
                }}
            />
        );
    }

    return children;
}

export default ProtectedRoute;