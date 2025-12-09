/**
 * Market Routes - Tickers, Stats, Movers
 */

const express = require('express');
const {
  getTicker,
  getTickersBulk,
  getMarketMovers,
  getMarketStats,
  getTickerDetail,
  getVNGainers,
  getVNLosers,
  getTickerSummary
} = require('../controllers/marketController');

const router = express.Router();

// Single ticker with 24h stats
router.get('/ticker', getTicker);

// Ticker summary (formatted for specific UI requirements)
router.get('/summary', getTickerSummary);

// Detailed ticker with historical performance
router.get('/ticker-detail', getTickerDetail);

// Bulk tickers
router.get('/tickers', getTickersBulk);

// Market movers (gainers, losers, most active)
router.get('/movers', getMarketMovers);

// Vietnamese market movers
router.get('/vn-gainers', getVNGainers);
router.get('/vn-losers', getVNLosers);

// Overall market statistics
router.get('/stats', getMarketStats);

module.exports = router;
