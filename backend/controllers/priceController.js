// backend/controllers/priceController.js
// Production-grade price API for TradingView-like charts
const pool = require('../config/pg');
const { getPriceLatest, setCandlesCache, getCandlesCache } = require('../services/redisCache');

/**
 * Map timeframe to correct table/view
 */
function getTableForTimeframe(tf) {
  const tfMap = {
    '1m': 'price_ohlcv_1m',
    '5m': 'price_ohlcv_5m',
    '15m': 'price_ohlcv_15m',
    '1h': 'price_ohlcv_1h',
    '4h': 'price_ohlcv_4h',
    '1d': 'price_ohlcv'
  };
  return tfMap[tf] || 'price_ohlcv';
}

/**
 * Get timeframe duration in milliseconds
 * Used to filter out incomplete (current) candles
 */
function getTimeframeDuration(tf) {
  const durations = {
    '1m': 60 * 1000,           // 1 minute
    '5m': 5 * 60 * 1000,       // 5 minutes
    '15m': 15 * 60 * 1000,     // 15 minutes
    '1h': 60 * 60 * 1000,      // 1 hour
    '4h': 4 * 60 * 60 * 1000,  // 4 hours
    '1d': 24 * 60 * 60 * 1000  // 1 day
  };
  return durations[tf] || 60 * 1000;
}

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

    // fallback to DB: try price_ticks first (most recent), then price_ohlcv
    let q = `
      SELECT p.price, p.ts FROM price_ticks p
      JOIN assets a ON a.id = p.asset_id
      WHERE a.symbol = $1
      ORDER BY p.ts DESC LIMIT 1
    `;
    let { rows } = await pool.query(q, [symbol]);
    
    if (rows[0]) {
      return res.json({ 
        symbol, 
        price: parseFloat(rows[0].price), 
        ts: rows[0].ts, 
        source: 'ticks' 
      });
    }

    // fallback to price_ohlcv
    q = `
      SELECT p.close as price, p.ts FROM price_ohlcv p
      JOIN assets a ON a.id = p.asset_id
      WHERE a.symbol = $1
      ORDER BY p.ts DESC LIMIT 1
    `;
    ({ rows } = await pool.query(q, [symbol]));
    
    if (!rows[0]) return res.status(404).json({ error: 'no price' });
    
    return res.json({ 
      symbol, 
      price: parseFloat(rows[0].price), 
      ts: rows[0].ts, 
      source: 'ohlcv' 
    });
  } catch (err) {
    console.error('getLatestPrice err', err);
    res.status(500).json({ error: 'failed' });
  }
};

/**
 * GET /api/v1/price/history?symbol=BTCUSDT&tf=1m&limit=500&from=&to=
 * Production-grade chart API (TradingView-like)
 * 
 * Features:
 * - Filters out incomplete (current) candles
 * - Returns candles in ascending order (oldest → newest)
 * - Smart caching with TTL based on timeframe
 * 
 * Supports: 1m, 5m, 15m, 1h, 4h, 1d
 */
exports.getPriceHistory = async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  const tf = (req.query.tf || '1d').toLowerCase();
  const limit = parseInt(req.query.limit || '500', 10);
  const from = req.query.from; // ISO timestamp
  const to = req.query.to;     // ISO timestamp

  if (!symbol) {
    return res.status(400).json({ error: 'symbol required' });
  }

  const validTfs = ['1m', '5m', '15m', '1h', '4h', '1d'];
  if (!validTfs.includes(tf)) {
    return res.status(400).json({ 
      error: 'invalid timeframe', 
      validTfs,
      message: `Supported timeframes: ${validTfs.join(', ')}`
    });
  }

  try {
    // Check cache (only if no from/to specified)
    if (!from && !to) {
      const cached = await getCandlesCache(symbol, tf);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        // Cached data is already filtered and sorted
        return res.json({ 
          symbol, 
          tf, 
          count: Math.min(cached.length, limit),
          candles: cached.slice(0, limit), 
          source: 'cache' 
        });
      }
    }

    const table = getTableForTimeframe(tf);
    const tfDuration = getTimeframeDuration(tf);
    
    // Calculate cutoff time for incomplete candle
    // Current candle bucket is NOT complete yet, so exclude it
    const now = new Date();
    const cutoffTime = to || now.toISOString();
    
    // Build query with optional time range
    let whereClauses = ['a.symbol = $1'];
    let params = [symbol];
    let paramIndex = 2;

    if (from) {
      whereClauses.push(`p.ts >= $${paramIndex}`);
      params.push(from);
      paramIndex++;
    }

    // CRITICAL: Filter out incomplete (current) candle
    // Subtract one timeframe duration to ensure bucket is closed
    const maxTs = new Date(new Date(cutoffTime).getTime() - tfDuration);
    whereClauses.push(`p.ts <= $${paramIndex}`);
    params.push(maxTs.toISOString());
    paramIndex++;

    const q = `
      SELECT p.ts, p.open, p.high, p.low, p.close, p.volume
      FROM ${table} p
      JOIN assets a ON a.id = p.asset_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY p.ts DESC
      LIMIT ${limit}
    `;

    const { rows } = await pool.query(q, params);
    
    if (rows.length === 0) {
      return res.json({ 
        symbol, 
        tf, 
        table,
        count: 0,
        candles: [],
        source: 'db',
        message: 'No data available for this timeframe'
      });
    }

    // Map to candle objects
    const candles = rows.map(r => ({
      ts: r.ts,
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseFloat(r.volume)
    }));

    // CRITICAL: Reverse to get oldest → newest (TradingView standard)
    // DB query returns DESC (newest first), but charts expect ASC
    candles.reverse();

    // Cache if no time range specified (cache complete candles only)
    if (!from && !to && candles.length > 0) {
      // TTL based on timeframe (shorter = more frequent updates)
      const cacheTTL = tf === '1m' ? 30 :      // 30s for 1m
                       tf === '5m' ? 60 :      // 1min for 5m
                       tf === '15m' ? 180 :    // 3min for 15m
                       tf === '1h' ? 300 :     // 5min for 1h
                       tf === '4h' ? 600 :     // 10min for 4h
                       1800;                   // 30min for 1d
      
      await setCandlesCache(symbol, tf, candles, cacheTTL).catch(err => {
        console.error('Cache set error:', err.message);
      });
    }

    return res.json({ 
      symbol, 
      tf, 
      table,
      count: candles.length,
      candles, 
      source: 'db',
      cutoffTime: maxTs.toISOString()
    });

  } catch (err) {
    console.error('getPriceHistory error:', err);
    res.status(500).json({ 
      error: 'failed', 
      message: err.message,
      symbol,
      tf
    });
  }
};
