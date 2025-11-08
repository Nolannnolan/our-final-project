const axios = require("axios");
const { format } = require("date-fns-tz");
const { isMarketOpen, shouldConvertToVND, getExchangeRateToVND } = require("../helper");
require("dotenv").config();


exports.getStockSummary = async (req, res) => {
  try {
    const symbol = req.query.symbol?.toUpperCase();
    const range = req.query.range;
    if (!symbol) {
      return res.status(400).json({ message: "Thiếu symbol" });
    }

    // Gọi dữ liệu chart từ Yahoo
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
    const response = await axios.get(url);
    const result = response.data.chart.result?.[0];
    if (!result) {
      return res.status(404).json({ message: "Không tìm thấy dữ liệu cho symbol này" });
    }

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const timestamps = result.timestamp || [];

    // === Kiểm tra thị trường đang mở ===
    const marketOpen = isMarketOpen(meta);

    // === Xác định giá ===
    let open = quote?.open?.[quote.open.length - 1] ?? null;
    let close = quote?.close?.[quote.close.length - 1] ?? null;
    let priceNow = marketOpen ? meta.regularMarketPrice : close;

    // === Thay đổi trong ngày ===
    let changeNow = open ? priceNow - open : null;
    let percentChangeNow = open ? ((changeNow / open) * 100).toFixed(2) * 1 : null;

    // === Thay đổi trong khoảng range ===
    let adjClose = result.indicators?.adjclose?.[0]?.adjclose?.filter(Boolean);
    let changeByTime = null, percentChangeByTime = null;
    if (adjClose && adjClose.length > 1) {
      let start = adjClose[0];
      let end = adjClose[adjClose.length - 1];
      changeByTime = end - start;
      percentChangeByTime = ((end - start) / start * 100).toFixed(2) * 1;
    }

    // === Xử lý thời gian ===
    const lastTime = meta.regularMarketTime
      ? format(new Date(meta.regularMarketTime * 1000), "HH:mm d 'Thg' M 'UTC+07:00'", { timeZone: "Asia/Ho_Chi_Minh" })
      : null;

    // === Mô tả khoảng thời gian ===
    const rangeTextMap = {
      "1d": "1 NGÀY QUA",
      "5d": "5 NGÀY QUA",
      "1mo": "1 THÁNG QUA",
      "3mo": "3 THÁNG QUA",
      "6mo": "6 THÁNG QUA",
      "1y": "1 NĂM QUA",
      "2y": "2 NĂM QUA",
      "ytd": "TỪ ĐẦU NĂM",
      "max": "TỪ TRƯỚC ĐẾN NAY",
    };

    // Chuyển đổi 
    const instrumentType = meta.instrumentType;
    let currency = meta.currency;

    if (shouldConvertToVND(instrumentType) && currency !== "VND") {
      const rate = await getExchangeRateToVND(currency);
      open *= rate;
      priceNow *= rate;
      changeNow *= rate;
      changeByTime *= rate;
      currency = "VND";
    }

    const data = {
      name: meta.longName || meta.symbol,
      symbol: symbol,
      priceNow,
      changeNow,
      percentChangeNow,
      changeByTime,
      percentChangeByTime,
      time: range.toUpperCase(),
      timeRange: rangeTextMap[range] || range,
      isMarketOpen: marketOpen,
      currency: currency,
      lastUpdate: lastTime,
    };

    return res.json(data);
  } catch (error) {
    console.error("❌ Error fetching stock summary:", error.message);
    return res.status(500).json({ message: "Lỗi khi lấy dữ liệu stock summary" });
  }
};
