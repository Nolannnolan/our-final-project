import React from 'react'
import moment from 'moment'
import TransactionInfoCard from '../Cards/TransactionInfoCard'

const ExpenseTransactions = ({transactions, onSeeMore}) => {
  return (
    <div className = "card">
      <div className = "flex items-center justify-between">
        <h5 className = "text-lg">Expenses in 30days</h5>
        <button className = "card-btn" onClick = {onSeeMore}>See All <i className="fa-solid fa-arrow-right "></i></button>
      </div>

      <div className = "mt-6">
        {transactions?.slice(0,5).map((item) => (
            <TransactionInfoCard
                key = {item._id}
                title = {item.type == "expense" ? item.category : item.source}
                icon={item.icon}
                date={moment(item.date).format("Do MMM YYYY")}
                amount={item.amount}
                type={item.type}
                hideDeleteBtn
            />
        ))}
      </div>
    </div>
  )
  
}

export default ExpenseTransactions
