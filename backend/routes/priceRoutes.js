// backend/routes/priceRoutes.js
const express = require('express');
const { getLatestPrice, getPriceHistory } = require('../controllers/priceController');

const router = express.Router();

router.get('/latest', getLatestPrice);
router.get('/history', getPriceHistory);

module.exports = router;
