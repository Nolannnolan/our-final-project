import React from 'react'
import {
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

const CustomLineChartIncomeExpense = ({expenseData, incomeData}) => {
  const mergeIncomeExpenseData = (incomeData, expenseData) => {
    const allMonths = [
      ...new Set([...incomeData.map(i => i.month), ...expenseData.map(e => e.month)]),
    ];

    return allMonths.map(month => {
      const incomeItem = incomeData.find(i => i.month === month);
      const expenseItem = expenseData.find(e => e.month === month);

      return {
        month,
        source: incomeItem ? incomeItem.source : "",
        category: expenseItem ? expenseItem.category : "",
        amountIncome: incomeItem ? incomeItem.amount : 0,
        amountExpense: expenseItem ? expenseItem.amount : 0,
      };
    });
  };

  const mergedData = mergeIncomeExpenseData(incomeData, expenseData);

  // 🔸 Custom Tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white shadow-md rounded-lg p-2 border border-gray-300">
          <p className="text-xs font-semibold text-blue-700 mb-1">{item.month}</p>
          <p className="text-sm text-gray-700">
            Nguồn thu: <span className="font-medium">{item.source || "-"}</span>
          </p>
          <p className="text-sm text-gray-700">
            Loại chi: <span className="font-medium">{item.category || "-"}</span>
          </p>
          <p className="text-sm text-gray-700">
            Thu nhập:{" "}
            <span className="text-green-600 font-semibold">${item.amountIncome}</span>
          </p>
          <p className="text-sm text-gray-700">
            Chi tiêu:{" "}
            <span className="text-red-600 font-semibold">${item.amountExpense}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  // 🔸 Biểu đồ giữ nguyên form cũ (AreaChart có gradient)
  return (
    <div className="bg-white rounded-xl shadow p-4 mt-4">

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={mergedData}>
          <defs>
            {/* Gradient thu nhập */}
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>

            {/* Gradient chi tiêu */}
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#555" }} stroke="none" />
          <YAxis tick={{ fontSize: 12, fill: "#555" }} stroke="none" />
          <Tooltip content={<CustomTooltip />} />

          {/* Thu nhập */}
          <Area
            type="monotone"
            dataKey="amountIncome"
            stroke="#22c55e"
            fill="url(#incomeGradient)"
            strokeWidth={3}
            dot={{ r: 3, fill: "#16a34a" }}
            name="Thu nhập"
          />

          {/* Chi tiêu */}
          <Area
            type="monotone"
            dataKey="amountExpense"
            stroke="#ef4444"
            fill="url(#expenseGradient)"
            strokeWidth={3}
            dot={{ r: 3, fill: "#dc2626" }}
            name="Chi tiêu"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CustomLineChartIncomeExpense
