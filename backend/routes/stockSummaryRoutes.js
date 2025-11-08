const express = require("express");
const { getStockSummary } = require("../controllers/stockSummaryController");

const router = express.Router();

router.get("/summary", getStockSummary);

module.exports = router;
