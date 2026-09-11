const express = require ('express');
const cors  = require('cors');
const userRouter = require('./routes/users.routes');
const authRouter = require('./routes/auth.routes');
const errorHandler = require('./middleware/error.middleware');
const projectRoutes = require("./routes/projects.routes");
const profileRoutes = require('./routes/profile.routes');
const githubRoutes = require("./routes/github.routes");
const aiRoutes = require("./routes/ai.routes");
const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL
}));
app.use(express.json()); // json parsing


// CURD
app.get("/api/health",(req,res) =>{
    res.json({
        status: 'ok',
        message : 'devvault api is running'
    });
});

app.use('/api/users', userRouter);
app.use('/api/auth',authRouter);
app.use('/api/projects',projectRoutes);
app.use('/api/profile',profileRoutes);  
app.use('/api/github',githubRoutes);
app.use("/api/ai",aiRoutes); 
app.use(errorHandler);

module.exports = app;
