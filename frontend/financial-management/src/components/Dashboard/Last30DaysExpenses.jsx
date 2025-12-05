import React, { useEffect, useState } from 'react'
import { prepareExpenseBarChartData } from '../../utils/helper'
import CustomBarChart from '../Charts/CustomBarChart'

const Last30DaysExpenses = ({data, dataKey}) => {
    const [chartData, setChartData] = useState([])
    useEffect(()=>{
        const result = prepareExpenseBarChartData(data)
        setChartData(result)
    },[data])
  return (
    <div className = "card col-span-1">
        <div className='flex items-center justify-between'>
            <h5 className = "text-lg">Chi tiêu 30 ngày gần nhất</h5>
        </div>
        <CustomBarChart data={chartData} dataKey="category"/>
    </div>
  )
}

export default Last30DaysExpenses
