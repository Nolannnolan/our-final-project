require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const incomeRoutes = require("./routes/incomeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const newsRoutes = require("./routes/newsRoutes");
const tickerRoutes = require("./routes/newsDashboardRoutes");
const watchlistRoutes = require("./routes/watchlistRoutes");
const financeRoutes = require("./routes/financeRoutes");
const { startBinanceStream } = require("./streams/binanceStream");
const assetsRoutes = require('./routes/assetsRoutes');
const priceRoutes = require('./routes/priceRoutes');

const app = express();

// Middleware to handle CORS
app.use(
    cors({
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

app.use(express.json());

connectDB(); 

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/expense", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/news", newsRoutes);
app.use("/api/v1/ticker", tickerRoutes);
app.use("/api/v1/watchlist", watchlistRoutes);
app.use("/api/v1/finance", financeRoutes);
app.use('/api/v1/assets', assetsRoutes);
app.use('/api/v1/price', priceRoutes);

const debugRoutes = require("./routes/debug");
app.use("/debug", debugRoutes);

// Server uploads folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    // Start Binance stream after server up
    try {
      startBinanceStream();
    } catch (err) {
      console.error('Failed to start Binance stream:', err);
    }
});