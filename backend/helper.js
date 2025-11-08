const axios = require("axios");

const NON_CONVERT_TYPES = [
  "INDEX",
  "CURRENCY",
  "ETF",
  "FUTURE",
  "MUTUALFUND",
];

/**
 * ✅ Kiểm tra xem instrumentType có cần quy đổi không
 * @param {string} instrumentType 
 * @returns {boolean}
 */
function shouldConvertToVND(instrumentType) {
  if (!instrumentType) return true; // Nếu không có thông tin, mặc định quy đổi
  return !NON_CONVERT_TYPES.includes(instrumentType.toUpperCase());
}

/**
 * ✅ Lấy tỉ giá từ currency → VND
 * @param {string} currency Mã tiền tệ (VD: "USD", "EUR")
 * @returns {number} tỷ giá so với VND, mặc định 1 nếu lỗi hoặc là VND
 */
async function getExchangeRateToVND(currency) {
  try {
    if (!currency || currency === "VND") return 1;

    const pair = `${currency}VND=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${pair}?interval=1d&range=1d`;

    const res = await axios.get(url);
    const result = res.data.chart?.result?.[0];
    const rate = result?.meta?.regularMarketPrice;

    if (rate && !isNaN(rate)) {
      return rate;
    }

    console.warn(`⚠️ Không lấy được tỷ giá cho ${currency}, dùng mặc định 1`);
    return 1;
  } catch (err) {
    console.error(`❌ Lỗi khi lấy tỷ giá ${currency}→VND:`, err.message);
    return 1;
  }
}

function isMarketOpen(meta){
  try {
    if (!meta?.currentTradingPeriod?.regular) return false;

    const now = Math.floor(Date.now() / 1000);
    const { start, end } = meta.currentTradingPeriod.regular;

    // Nếu là crypto hoặc không có phiên giao dịch cố định thì coi như luôn mở
    if (meta.instrumentType === "CRYPTOCURRENCY") return true;

    return now >= start && now <= end;
  } catch {
    return false;
  }
};


module.exports = {
  shouldConvertToVND,
  getExchangeRateToVND,
  isMarketOpen
};
