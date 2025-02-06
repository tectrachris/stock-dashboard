import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

const StockDashboard = () => {
  const [stockData, setStockData] = useState({
    Incorrect: [],
    Missing: [],
    Faulty: [],
    'Not Inspected': [],
    'Returned': []
  });
  const [loading, setLoading] = useState(true);
  const [selectedBuyer, setSelectedBuyer] = useState('all');
  const [activeStatus, setActiveStatus] = useState('Incorrect');
  const [statusCounts, setStatusCounts] = useState({});
  const [stockActions, setStockActions] = useState({});
  const [otherActions, setOtherActions] = useState({});
  const [statusHistory, setStatusHistory] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);

  // Define columns order and configuration
  const columns = [
    { key: 'Stock Id', label: 'Stock ID' },
    { key: 'Product', label: 'Product' },
    { key: 'Description', label: 'Description' },
    { key: 'Age', label: 'Age' },
    { key: 'Qty', label: 'Qty' },
    { key: 'Stock Cost', label: 'Stock Cost' },
    { key: 'Action', label: 'Action' },
    { key: 'Duration', label: 'Duration' },
    { key: 'Buyer', label: 'Buyer' },
    { key: 'Comments', label: 'Comments' },
    { key: 'Supplier', label: 'Supplier' }
  ];

  // Define main buyers
  const mainBuyers = {
    'Steve': 'Steve Vallance',
    'Chris': 'Chris Hall',
    'Pat': 'Patrick Boydell',
    'Felix': 'Felix Barber'
  };

  const actionOptions = [
    'Select action...',
    'Waiting on Credit',
    'Received Credit',
    'Requested Credit',
    'Writedown',
    'Move Cost',
    'Scrap',
    'Other'
  ];

  const getDuration = (startDate, endDate) => {
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDuration = (days) => {
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    return remainingDays ? `${weeks}w ${remainingDays}d` : `${weeks}w`;
  };

  const filterAndSortData = (data) => {
    let filtered = selectedBuyer === 'all' 
      ? data
      : selectedBuyer === 'Other'
        ? data.filter(item => {
            const buyer = item.Buyer?.trim();
            return buyer && !Object.values(mainBuyers).includes(buyer);
          })
        : data.filter(item => {
            const buyer = item.Buyer?.trim();
            return buyer === mainBuyers[selectedBuyer];
          });
    
    return filtered.sort((a, b) => {
      const costA = Number(a['Stock Cost']) || 0;
      const costB = Number(b['Stock Cost']) || 0;
      return costB - costA;
    });
  };

  // Load status history
  useEffect(() => {
    const savedHistory = localStorage.getItem('statusHistory');
    if (savedHistory) {
      setStatusHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Load Excel data
  useEffect(() => {
    const loadExcelData = async () => {
      try {
        const response = await window.fs.readFile('Full.xlsx');
        const workbook = XLSX.read(new Uint8Array(response), { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);
        const currentDate = new Date();

        // Load saved actions
        if (Object.keys(stockActions).length === 0) {
          const savedActions = localStorage.getItem('stockActions');
          if (savedActions) {
            setStockActions(JSON.parse(savedActions));
          }
        }
        
        if (Object.keys(otherActions).length === 0) {
          const savedOtherActions = localStorage.getItem('stockOtherActions');
          if (savedOtherActions) {
            setOtherActions(JSON.parse(savedOtherActions));
          }
        }

        // Update status history
        const newStatusHistory = { ...statusHistory };
        data.forEach(item => {
          const stockId = item['Stock Id'];
          const status = item.Status;
          
          if (!newStatusHistory[stockId]) {
            newStatusHistory[stockId] = {
              status,
              startDate: currentDate.toISOString(),
              history: []
            };
          } else if (newStatusHistory[stockId].status !== status) {
            newStatusHistory[stockId].history.push({
              status: newStatusHistory[stockId].status,
              duration: getDuration(new Date(newStatusHistory[stockId].startDate), currentDate)
            });
            newStatusHistory[stockId].status = status;
            newStatusHistory[stockId].startDate = currentDate.toISOString();
          }
        });

        setStatusHistory(newStatusHistory);
        localStorage.setItem('statusHistory', JSON.stringify(newStatusHistory));
        setLastUpdate(currentDate.toISOString());

        // Helper functions
        const shouldExcludeFromIncorrect = (item) => {
          const comments = (item.Comments || '').toUpperCase();
          const exclusionTerms = ['VOK', 'V.OK', 'VIS', 'VISUAL'];
          return exclusionTerms.some(term => comments.includes(term));
        };

        const isReturnedStock = (item) => {
          const stockId = String(item['Stock Id'] || '');
          return stockId.endsWith('-1');
        };

        // Categorize data
        const categorizedData = {
          'Incorrect': data.filter(item => 
            item.Status === 'Incorrect' && !shouldExcludeFromIncorrect(item)
          ),
          'Missing': data.filter(item => item.Status === 'Missing'),
          'Faulty': data.filter(item => item.Status === 'Faulty'),
          'Not Inspected': data.filter(item => item.Status === 'Not Inspected'),
          'Returned': data.filter(isReturnedStock)
        };

        // Calculate counts
        const counts = {
          'Incorrect': categorizedData['Incorrect'].length,
          'Missing': categorizedData['Missing'].length,
          'Faulty': categorizedData['Faulty'].length,
          'Not Inspected': categorizedData['Not Inspected'].length,
          'Returned': categorizedData['Returned'].length
        };

        setStatusCounts(counts);
        setStockData(categorizedData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading Excel file:', error);
        setLoading(false);
      }
    };

    loadExcelData();
  }, [statusHistory]);

  const handleActionChange = (stockId, action) => {
    const newStockActions = {
      ...stockActions,
      [stockId]: action
    };
    setStockActions(newStockActions);
    localStorage.setItem('stockActions', JSON.stringify(newStockActions));
  };

  const handleOtherActionChange = (stockId, text) => {
    const newOtherActions = {
      ...otherActions,
      [stockId]: text
    };
    setOtherActions(newOtherActions);
    localStorage.setItem('stockOtherActions', JSON.stringify(newOtherActions));
  };

  const renderCellContent = (item, column) => {
    switch (column.key) {
      case 'Stock Cost':
        return `£${Number(item[column.key]).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'Duration':
        return statusHistory[item['Stock Id']] && 
               formatDuration(getDuration(new Date(statusHistory[item['Stock Id']].startDate), new Date()));
      case 'Action':
        return (
          <div className="space-y-2">
            <select 
              className="border rounded-md px-2 py-1 w-full"
              value={stockActions[item['Stock Id']] || 'Select action...'}
              onChange={(e) => handleActionChange(item['Stock Id'], e.target.value)}
            >
              {actionOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {stockActions[item['Stock Id']] === 'Other' && (
              <input
                type="text"
                className="border rounded-md px-2 py-1 w-full"
                placeholder="Specify other action..."
                value={otherActions[item['Stock Id']] || ''}
                onChange={(e) => handleOtherActionChange(item['Stock Id'], e.target.value)}
              />
            )}
          </div>
        );
      default:
        return item[column.key];
    }
  };

  const filteredData = useMemo(() => filterAndSortData(stockData[activeStatus] || []), [stockData, selectedBuyer, activeStatus]);

  if (loading) {
    return (
      <div className="m-4 p-6 bg-white rounded-lg shadow">
        Loading stock data...
      </div>
    );
  }

  const statuses = ['Incorrect', 'Missing', 'Faulty', 'Not Inspected', 'Returned'];

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-6">Stock Management Dashboard</h2>
          
          {/* Status Summary Cards */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            {statuses.map(status => (
              <div 
                key={status}
                className={`bg-gray-50 p-4 rounded-lg cursor-pointer ${
                  activeStatus === status ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setActiveStatus(status)}
              >
                <div className="text-lg font-semibold text-gray-700">{status}</div>
                <div className="text-3xl font-bold text-blue-600">
                  {statusCounts[status] || 0}
                </div>
                <div className="text-sm text-gray-600">
                  £{stockData[status].reduce((sum, item) => sum + (Number(item['Stock Cost']) || 0), 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          {/* Buyer Selection */}
          <div className="flex space-x-4 mb-6">
            {[...Object.keys(mainBuyers), 'Other', 'all'].map((buyer) => (
              <div key={buyer} className="flex flex-col">
                <button
                  className={`px-4 py-2 rounded-lg ${
                    selectedBuyer === buyer
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setSelectedBuyer(buyer)}
                >
                  {buyer === 'all' ? 'All Buyers' : buyer}
                </button>
                <div className="text-sm text-gray-600 text-center mt-1">
                  £{(stockData[activeStatus] || [])
                    .filter(item => {
                      if (buyer === 'all') return true;
                      if (buyer === 'Other') {
                        return item.Buyer?.trim() && !Object.values(mainBuyers).includes(item.Buyer?.trim());
                      }
                      return item.Buyer?.trim() === mainBuyers[buyer];
                    })
                    .reduce((sum, item) => sum + (Number(item['Stock Cost']) || 0), 0)
                    .toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          {/* Data Table */}
          <div className="pb-16">
            <div className="table-container overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map(column => (
                      <th
                        key={column.key}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.map((item) => (
                    <tr key={item['Stock Id']} className="hover:bg-gray-50">
                      {columns.map(column => (
                        <td key={column.key} className="px-6 py-4 whitespace-nowrap">
                          {renderCellContent(item, column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockDashboard;