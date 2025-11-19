// backend/controllers/priceController.js
const pool = require('../config/pg');
const { getPriceLatest, setCandlesCache, getCandlesCache } = require('../services/redisCache');

/**
 * GET /api/v1/price/latest?symbol=BTCUSDT
 */
exports.getLatestPrice = async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    // try redis cache first
    const cached = await getPriceLatest(symbol);
    if (cached) return res.json({ symbol, price: parseFloat(cached), source: 'redis' });

    // fallback to DB: latest price from price_ohlcv close (most recent ts)
    const q = `
      SELECT p.close, p.ts FROM price_ohlcv p
      JOIN assets a ON a.id = p.asset_id
      WHERE a.symbol = $1
      ORDER BY p.ts DESC LIMIT 1
    `;
    const { rows } = await pool.query(q, [symbol]);
    if (!rows[0]) return res.status(404).json({ error: 'no price' });
    return res.json({ symbol, price: parseFloat(rows[0].close), ts: rows[0].ts, source: 'db' });
  } catch (err) {
    console.error('getLatestPrice err', err);
    res.status(500).json({ error: 'failed' });
  }
};

/**
 * GET /api/v1/price/history?symbol=BTCUSDT&tf=1d&limit=365
 */
exports.getPriceHistory = async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  const tf = (req.query.tf || '1d').toLowerCase();
  const limit = parseInt(req.query.limit || '500', 10);

  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  try {
    // check cache
    const cached = await getCandlesCache(symbol, tf);
    if (cached) return res.json({ symbol, tf, candles: cached, source: 'cache' });

    // Query DB: return latest `limit` candles for given tf
    // We assume price_ohlcv stores multiple timeframes in ts (if we fetch both 1d & 1h)
    const q = `
      SELECT p.ts, p.open, p.high, p.low, p.close, p.volume
      FROM price_ohlcv p
      JOIN assets a ON a.id = p.asset_id
      WHERE a.symbol = $1
      ORDER BY p.ts DESC
      LIMIT $2
    `;
    const { rows } = await pool.query(q, [symbol, limit]);
    const candles = rows.map(r => ({
      ts: r.ts,
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume)
    }));

    // cache and return
    await setCandlesCache(symbol, tf, candles, 300);
    return res.json({ symbol, tf, candles, source: 'db' });
  } catch (err) {
    console.error('getPriceHistory err', err);
    res.status(500).json({ error: 'failed' });
  }
};
