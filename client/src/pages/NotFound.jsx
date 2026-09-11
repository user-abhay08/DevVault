import { Link } from "react-router-dom";

function NotFound() {

    return (
        <div className="not-found">

            <div className="not-found-code">
                404
            </div>

            <h1>
                Page Not Found
            </h1>

            <p>
                The page you're looking for doesn't exist.
            </p>

            <Link
                to="/dashboard"
                className="primary-button"
            >
                Back to Dashboard
            </Link>

        </div>
    );
}

export default NotFound;