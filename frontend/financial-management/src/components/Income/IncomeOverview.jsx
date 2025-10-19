import React, { useEffect, useState } from 'react'
import { prepareIncomeChartData } from '../../utils/helper'
import CustomBarChart from '../Charts/CustomBarChart'

const IncomeOverview = ({transactions, onAddIncome}) => {
    const [chatData, setChatData] = useState([])
    useEffect(()=>{
        const result = prepareIncomeChartData(transactions)
        console.log(result)
        setChatData(result)

        return () =>{}
    }, [transactions])
  return (
    <div className = "card">
        <div className='flex items-center justify-between'>
            <div className=''>
                <h5 className='text-lg'>Income Overview</h5>
                <p className='text-xs text-gray-400 mt-0.5'>
                    Track your earnings over time and analyze you income trends
                </p>
            </div>

            <button className='add-btn' onClick={onAddIncome}>
                <i className="fa-solid fa-plus text-lg"></i> 
                Add Income
            </button>
        </div>

        <div className = "mt-10">
            <CustomBarChart data = {chatData} dataKey="source"/>
        </div>
    </div>
  )
}

export default IncomeOverview
