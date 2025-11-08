const express = require("express");
const { getNews } = require("../controllers/newsController");

const router = express.Router();

// Endpoint: /api/news
router.get("/", getNews);

module.exports = router;
