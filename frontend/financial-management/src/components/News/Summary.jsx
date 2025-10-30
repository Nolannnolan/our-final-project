import React from 'react'

const Summary = () => {
    const marketIndices = [
    {
      name: 'VNI',
      value: '1,234.56',
      change: 2.5,
      positive: true
    },
    {
      name: 'BTC',
      value: '$45,678',
      change: -1.2,
      positive: false
    },
    {
      name: 'ETH',
      value: '$3,456',
      change: 3.8,
      positive: true
    },
    {
      name: 'GOLD',
      value: '$1,890',
      change: 0.5,
      positive: true
    },
    {
      name: 'BTC',
      value: '$45,678',
      change: -1.2,
      positive: false
    },
    {
      name: 'ETH',
      value: '$3,456',
      change: 3.8,
      positive: true
    },
    {
      name: 'GOLD',
      value: '$1,890',
      change: 0.5,
      positive: true
    },
    {
      name: 'BTC',
      value: '$45,678',
      change: -1.2,
      positive: false
    },
    {
      name: 'ETH',
      value: '$3,456',
      change: 3.8,
      positive: true
    },
    {
      name: 'GOLD',
      value: '$1,890',
      change: 0.5,
      positive: true
    }
  ];
  return (
    <>
        <div className='card flex flex-nowrap w-full overflow-x-auto space-x-10 scroll-thin'>
        {marketIndices.map((item, index) => (
            <div key={index} className="flex items-center gap-2.5 whitespace-nowrap flex-shrink-0">
                <span className="font-medium text-sm text-gray-700">
                {item.name}
                </span>
                <span className="font-semibold text-gray-900 text-sm">{item.value}</span>
                <span className={`text-sm font-semibold ${item.positive ? 'text-green-500' : 'text-red-500'}`}>
                {item.positive ? '+' : ''}
                {item.change}%
                </span>
            </div>
            ))}
        </div>
    </>
  )
}

export default Summary
