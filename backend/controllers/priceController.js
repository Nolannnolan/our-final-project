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
 * GET /api/v1/price/candles?symbol=BTCUSDT&timeframe=1m&limit=500&start=&end=
 * Standard TradingView-style candles endpoint
 * 
 * Features:
 * - Filters out incomplete (current) candles
 * - Returns candles in ascending order (oldest → newest)
 * - Smart caching with TTL based on timeframe
 * - Standard parameter names (timeframe, start, end)
 * 
 * Supports: 1m, 5m, 15m, 1h, 4h, 1d
 */
exports.getCandles = async (req, res) => {
  const symbol = (req.query.symbol || '').toUpperCase();
  const timeframe = (req.query.timeframe || '1d').toLowerCase();
  const limit = parseInt(req.query.limit || '500', 10);
  const start = req.query.start; // ISO timestamp or unix timestamp
  const end = req.query.end;     // ISO timestamp or unix timestamp

  if (!symbol) {
    return res.status(400).json({ error: 'symbol required' });
  }

  const validTfs = ['1m', '5m', '15m', '1h', '4h', '1d'];
  if (!validTfs.includes(timeframe)) {
    return res.status(400).json({ 
      error: 'invalid timeframe', 
      validTfs,
      message: `Supported timeframes: ${validTfs.join(', ')}`
    });
  }

  try {
    // Convert unix timestamps to ISO if needed
    let startISO = start;
    let endISO = end;
    
    if (start && !isNaN(start)) {
      // Unix timestamp (seconds or milliseconds)
      const timestamp = parseInt(start);
      startISO = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000).toISOString();
    }
    
    if (end && !isNaN(end)) {
      const timestamp = parseInt(end);
      endISO = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000).toISOString();
    }

    // Check cache (only if no time range specified)
    if (!startISO && !endISO) {
      const cached = await getCandlesCache(symbol, timeframe);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return res.json({ 
          symbol, 
          timeframe, 
          count: Math.min(cached.length, limit),
          candles: cached.slice(0, limit), 
          source: 'cache' 
        });
      }
    }

    const table = getTableForTimeframe(timeframe);
    const tfDuration = getTimeframeDuration(timeframe);
    
    // Calculate cutoff time for incomplete candle
    const now = new Date();
    const cutoffTime = endISO || now.toISOString();
    
    // Build query with optional time range
    let whereClauses = ['a.symbol = $1'];
    let params = [symbol];
    let paramIndex = 2;

    if (startISO) {
      whereClauses.push(`p.ts >= $${paramIndex}`);
      params.push(startISO);
      paramIndex++;
    }

    // Filter out incomplete (current) candle
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
        timeframe, 
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

    // Reverse to get oldest → newest (TradingView standard)
    candles.reverse();

    // Cache if no time range specified
    if (!startISO && !endISO && candles.length > 0) {
      const cacheTTL = timeframe === '1m' ? 30 :
                       timeframe === '5m' ? 60 :
                       timeframe === '15m' ? 180 :
                       timeframe === '1h' ? 300 :
                       timeframe === '4h' ? 600 :
                       1800;
      
      await setCandlesCache(symbol, timeframe, candles, cacheTTL).catch(err => {
        console.error('Cache set error:', err.message);
      });
    }

    return res.json({ 
      symbol, 
      timeframe, 
      table,
      count: candles.length,
      candles, 
      source: 'db',
      cutoffTime: maxTs.toISOString()
    });

  } catch (err) {
    console.error('getCandles error:', err);
    res.status(500).json({ 
      error: 'failed', 
      message: err.message,
      symbol,
      timeframe
    });
  }
};

/**
 * GET /api/v1/price/history?symbol=BTCUSDT&tf=1m&limit=500&from=&to=
 * Legacy endpoint - redirects to getCandles
 * Maintained for backward compatibility
 * 
 * @deprecated Use /candles endpoint instead
 */
exports.getPriceHistory = async (req, res) => {
  // Map legacy parameters to new ones
  const symbol = (req.query.symbol || '').toUpperCase();
  const timeframe = (req.query.tf || '1d').toLowerCase();
  const limit = parseInt(req.query.limit || '500', 10);
  const start = req.query.from; // ISO timestamp
  const end = req.query.to;     // ISO timestamp
  
  // Call getCandles with mapped parameters
  req.query.timeframe = timeframe;
  req.query.start = start;
  req.query.end = end;
  
  return exports.getCandles(req, res);

}
