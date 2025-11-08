const express = require("express");
const { getDetailsStock } = require("../controllers/detailsStockController");

const router = express.Router();

router.get("/", getDetailsStock);

module.exports = router;
