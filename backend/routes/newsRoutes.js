const express = require("express");
const axios = require("axios");
const Parser = require("rss-parser");
const cheerio = require("cheerio");

const router = express.Router();
const parser = new Parser();

// Cấu hình nguồn và logo
const sources = [
  {
    name: "VietNamPlus",
    url: "https://www.vietnamplus.vn/rss/kinhte/taichinh-343.rss",
    logo: "https://upload.wikimedia.org/wikipedia/vi/a/a8/Logo_Vietnam%2B.png",
  },
  {
    name: "VTC News",
    url: "https://vtcnews.vn/rss/kinh-te.rss",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/VTC_official_logo.svg/1024px-VTC_official_logo.svg.png",
  },
  {
    name: "VNExpress",
    url: "https://vnexpress.net/rss/kinh-doanh.rss",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/VnExpress.net_Logo.svg/2560px-VnExpress.net_Logo.svg.png",
  },
];

let cachedNews = [];
let lastUpdated = null;

// Hàm lấy image từ description
const extractImage = (item) => {
  // Ưu tiên lấy từ description
  let html = item.description || item.content || "";

  // Nếu description không có <img> thì thử lấy từ content:encoded
  if (!/<img[^>]+src=/.test(html) && item["content:encoded"]) {
    html = item["content:encoded"];
  }

  try {
    const $ = cheerio.load(html);
    const imgSrc = $("img").attr("src");
    return imgSrc || null;
  } catch (err) {
    console.error("Error parsing image:", err.message);
    return null;
  }
}

const fetchRSSData = async () => {

  try {
    const results = await Promise.all(
      sources.map(async (src) => {
        try {
        const { data } = await axios.get(src.url, {
          headers: { "User-Agent": "Mozilla/5.0 (Node.js Server)" },
          timeout: 10000,
        });
        const feed = await parser.parseString(data);

        return feed.items.slice(0, 10).map((item) => ({
          title: item.title,
          link: item.link,
          sortDate: item.pubDate,
          pubDate: new Date(item.pubDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
          image: extractImage(item),
          source: src.name,
          logo: src.logo,
        }));

        } catch (err) {
        console.error(`❌ Lỗi khi tải RSS từ ${src.name}:`, err.message);
        return []; // tránh crash toàn bộ
        }
      })
    );

    // Gộp tất cả
    const allNews = results.flat();

    // Sắp xếp theo pubDate (mới nhất trước)
    allNews.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
    cachedNews = allNews; // 🆕 cập nhật cache
    lastUpdated = new Date(); 

  } catch (error) {
    console.error("RSS Fetch Error:", error.message);
    res.status(500).json({ status: "error", message: "Failed to fetch RSS feeds" });
  }
}

fetchRSSData();

// 🆕 4️⃣ Tự động gọi lại mỗi 10 phút
setInterval(fetchRSSData, 10 * 60 * 1000);

// Endpoint chỉ trả về dữ liệu cache
router.get("/", (req, res) => {
  res.json({
    status: "success",
    lastUpdated,
    total: cachedNews.length,
    data: cachedNews,
  });
});

module.exports = router;
