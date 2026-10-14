const errorHandler = (err,req,res,next) =>{
    console.error("Unhandled API error:", err.code || err.name || "Error", err.message);

    const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    res.status(status).json({
        message: "Internal server error"
    });
};

module.exports = errorHandler;
