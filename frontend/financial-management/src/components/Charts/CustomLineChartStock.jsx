import React, { useState } from "react";
import StockMarket from "../News/StockMarket";
import TitleStock from "../News/TitleStock";

const CustomLineChartStock = ({symbol}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1D');
  const data = {
    name: "VnIndex",
    symbol: "^VNI",
    priceNow: "1.640,58",
    changeNow: -14.31,
    percentChangeNow: -0.86,
    changeByTime: -33.39,
    percentChangeByTime: -1.99,
    time: "5D",
    timeRange: "5 NGÀY QUA",
    isMarketOpen: false,
    lastUpdate: "12:16 6 Thg 11 UTC+07:00",
    currency: "VND",
  };
  return (
    <StockMarket symbol={symbol}>
      <TitleStock data = {data}/>
      <div className="text-lg font-semibold text-center text-blue-800">
        Hello from CustomLineChartStock 👋
      </div>
    </StockMarket>
  );
};

export default CustomLineChartStock;
