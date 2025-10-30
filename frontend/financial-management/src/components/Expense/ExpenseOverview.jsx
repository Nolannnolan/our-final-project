import React, { useEffect, useState } from 'react'
import { prepareExpenseLineChartData } from '../../utils/helper'
import CustomLineChart from '../Charts/CustomLineChart'
import CustomBarChart from '../Charts/CustomBarChart'

const ExpenseOverview = ({transactions, onAddExpense}) => {
  const [chatData, setChatData] = useState([])
    useEffect(()=>{
      const result = prepareExpenseLineChartData(transactions)
      setChatData(result)

      return () =>{}
    }, [transactions])
  return (
    <>
      <div className = "card">
          <div className='flex items-center justify-between'>
              <div className=''>
                  <h5 className='text-lg'>Expense Overview</h5>
                  <p className='text-xs text-gray-400 mt-0.5'>
                      Track your spending over time and gain insights into where your money goes.
                  </p>
              </div>

              <button className='add-btn' onClick={onAddExpense}>
                  <i className="fa-solid fa-plus text-lg"></i> 
                  Add Expense
              </button>
          </div>

          <div className='mt-10'>
            <CustomBarChart data={chatData} dataKey = "category" />
          </div>
      </div>

      <div className = "card my-2">
          <div className='flex items-center justify-between'>
              <div className=''>
                  <h5 className='text-lg'>Expense Overview</h5>
                  <p className='text-xs text-gray-400 mt-0.5'>
                      Track your spending over time and gain insights into where your money goes.
                  </p>
              </div>
          </div>

          <div className='mt-10'>
            <CustomLineChart data={chatData} dataKey = "category" />
          </div>
      </div>
    </>
    
  )
}

export default ExpenseOverview
