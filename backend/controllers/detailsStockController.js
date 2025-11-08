const axios = require("axios");
const { shouldConvertToVND, getExchangeRateToVND } = require("../helper");
require("dotenv").config();

// Cache theo từng symbol
let cache = {}; 
const CACHE_DURATION = 60 * 1000; // cache 1 phút

exports.getDetailsStock = async (req, res) => {
  try {
    const symbol = req.query.symbol?.toUpperCase(); // đảm bảo đồng nhất
    if (!symbol) return res.status(400).json({ message: "Thiếu symbol" });

    // Kiểm tra cache theo symbol
    const cached = cache[symbol];
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_DURATION) {
      console.log("⚡ Using cache for:", symbol);
      return res.json(cached.data);
    }

    console.log("🌐 Fetching new data for:", symbol);

    // ====== Gọi dữ liệu 1d (để lấy thông tin hiện tại) ======
    const baseRes = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
    );

    const result = baseRes.data.chart.result?.[0];
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu cho symbol này" });
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];

    let price = meta.regularMarketPrice;
    let open = quote?.open?.[0] ?? null;
    let high = quote?.high?.[0] ?? null;
    let low = quote?.low?.[0] ?? null;
    let prevClose = meta.chartPreviousClose;
    let volume = quote?.volume?.[0] ?? null;
    let fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
    let fiftyTwoWeekLow = meta.fiftyTwoWeekLow;

    // Chuyển đổi
    const instrumentType = meta.instrumentType;
    let currency = meta.currency;

    if (shouldConvertToVND(instrumentType) && currency !== "VND") {
      const rate = await getExchangeRateToVND(currency);
      price *= rate;
      open *= rate;
      high *= rate;
      low *= rate;
      prevClose *= rate;
      fiftyTwoWeekHigh *= rate;
      fiftyTwoWeekLow *= rate;

      currency = "VND";
    }
    // ==== Tính thay đổi hiện tại ====
    const change = price - prevClose;
    const changePercent = ((change / prevClose) * 100).toFixed(2) * 1;

    // ==== Lấy dữ liệu theo các range cụ thể ====
    const ranges = ["1mo", "3mo", "6mo", "1y"];
    const profits = {};

    await Promise.all(
      ranges.map(async (r) => {
        try {
          const res = await axios.get(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${r}`
          );
          const result = res.data.chart.result?.[0];
          const adjClose = result?.indicators?.adjclose?.[0]?.adjclose?.filter(Boolean);
          if (!adjClose || adjClose.length < 2) return;
          const start = adjClose[0];
          const end = adjClose[adjClose.length - 1];
          const percent = ((end - start) / start) * 100;
          profits[r] = parseFloat(percent.toFixed(2));
        } catch (err) {
          console.warn(`⚠️ Range ${r} failed:`, err.message);
          profits[r] = null;
        }
      })
    );

    // ==== Chuẩn bị dữ liệu trả về ====
    const tickerData = {
      symbol,
      price,
      open,
      high,
      low,
      prevClose,
      volume,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      change,
      changePercent,
      profit: {
        "1M": profits["1mo"],
        "3M": profits["3mo"],
        "6M": profits["6mo"],
        "1Y": profits["1y"],
      },
      currency,
      timestamp: new Date().toISOString(),
    };

    // ==== Lưu cache riêng cho từng symbol ====
    cache[symbol] = { data: tickerData, timestamp: now };

    console.log("✅ Cached:", symbol);

    return res.json(tickerData);
  } catch (error) {
    console.error("❌ Error fetching ticker bar:", error.message);
    return res.status(500).json({ message: "Lỗi khi lấy dữ liệu ticker bar" });
  }
};
