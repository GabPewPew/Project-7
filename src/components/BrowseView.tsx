import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Card {
  id: string;
  frontContent: string;
  backContent: string;
  sourceDocumentId: string | null;
  sourcePageNumber: number | null;
  createdAt: string;
  progress: {
    state: string;
    easeFactor: number;
    interval: number;
    repetitions: number;
    dueDate: string;
  };
  note: {
    fieldValues: string;
    noteType: {
      name: string;
    };
  };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function BrowseView() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: 1,
    limit: 50,
    pages: 0
  });
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  
  useEffect(() => {
    fetchCards(pagination.page, pagination.limit);
  }, [pagination.page, pagination.limit]);
  
  const fetchCards = async (page: number, limit: number) => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `/api/cards/all?page=${page}&limit=${limit}`
      );
      
      setCards(response.data.cards);
      setPagination(response.data.pagination);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching cards:', error);
      setIsLoading(false);
    }
  };
  
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };
  
  const handleLimitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    setPagination(prev => ({ ...prev, page: 1, limit: newLimit }));
  };
  
  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };
  
  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
  };
  
  const closeCardView = () => {
    setSelectedCard(null);
  };
  
  // Generate page numbers for pagination
  const pageNumbers = [];
  const maxVisiblePages = 5;
  const startPage = Math.max(
    1, 
    pagination.page - Math.floor(maxVisiblePages / 2)
  );
  const endPage = Math.min(
    pagination.pages, 
    startPage + maxVisiblePages - 1
  );
  
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Browse Cards</h1>
      
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded w-full"></div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-between items-center">
            <div>
              Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} cards
            </div>
            <div className="flex items-center">
              <label htmlFor="limit" className="mr-2">Show:</label>
              <select 
                id="limit"
                className="border rounded px-2 py-1"
                value={pagination.limit}
                onChange={handleLimitChange}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Front
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Back
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interval
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ease
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    State
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No cards found
                    </td>
                  </tr>
                ) : (
                  cards.map(card => (
                    <tr 
                      key={card.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleCardClick(card)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 truncate max-w-xs">
                          {stripHtml(card.frontContent).substring(0, 50)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 truncate max-w-xs">
                          {stripHtml(card.backContent).substring(0, 50)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(card.progress.dueDate).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {card.progress.interval < 1 
                            ? `${Math.round(card.progress.interval * 1440)}m` 
                            : `${Math.round(card.progress.interval)}d`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {(card.progress.easeFactor / 1000).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${card.progress.state === 'new' ? 'bg-blue-100 text-blue-800' : ''}
                          ${card.progress.state === 'learning' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${card.progress.state === 'review' ? 'bg-green-100 text-green-800' : ''}
                          ${card.progress.state === 'relearning' ? 'bg-red-100 text-red-800' : ''}
                        `}>
                          {card.progress.state}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 rounded border bg-white disabled:opacity-50"
            >
              Previous
            </button>
            
            <div className="flex space-x-1">
              {pagination.page > 1 && pageNumbers[0] > 1 && (
                <>
                  <button 
                    onClick={() => handlePageChange(1)}
                    className="px-3 py-1 rounded border bg-white"
                  >
                    1
                  </button>
                  {pageNumbers[0] > 2 && (
                    <span className="px-3 py-1">...</span>
                  )}
                </>
              )}
              
              {pageNumbers.map(number => (
                <button
                  key={number}
                  onClick={() => handlePageChange(number)}
                  className={`px-3 py-1 rounded border ${
                    pagination.page === number 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white'
                  }`}
                >
                  {number}
                </button>
              ))}
              
              {pagination.page < pagination.pages && pageNumbers[pageNumbers.length - 1] < pagination.pages && (
                <>
                  {pageNumbers[pageNumbers.length - 1] < pagination.pages - 1 && (
                    <span className="px-3 py-1">...</span>
                  )}
                  <button 
                    onClick={() => handlePageChange(pagination.pages)}
                    className="px-3 py-1 rounded border bg-white"
                  >
                    {pagination.pages}
                  </button>
                </>
              )}
            </div>
            
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="px-3 py-1 rounded border bg-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
      
      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Card Details</h3>
              <button 
                onClick={closeCardView}
                className="p-1 rounded-full hover:bg-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Front</h4>
                <div 
                  className="p-4 border rounded-lg bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: selectedCard.frontContent }}
                />
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Back</h4>
                <div 
                  className="p-4 border rounded-lg bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: selectedCard.backContent }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Due Date</h4>
                  <p>{new Date(selectedCard.progress.dueDate).toLocaleString()}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">State</h4>
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${selectedCard.progress.state === 'new' ? 'bg-blue-100 text-blue-800' : ''}
                    ${selectedCard.progress.state === 'learning' ? 'bg-yellow-100 text-yellow-800' : ''}
                    ${selectedCard.progress.state === 'review' ? 'bg-green-100 text-green-800' : ''}
                    ${selectedCard.progress.state === 'relearning' ? 'bg-red-100 text-red-800' : ''}
                  `}>
                    {selectedCard.progress.state}
                  </span>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Interval</h4>
                  <p>
                    {selectedCard.progress.interval < 1 
                      ? `${Math.round(selectedCard.progress.interval * 1440)} minutes` 
                      : `${Math.round(selectedCard.progress.interval)} days`}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Ease Factor</h4>
                  <p>{(selectedCard.progress.easeFactor / 1000).toFixed(2)}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Repetitions</h4>
                  <p>{selectedCard.progress.repetitions}</p>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Note Type</h4>
                  <p>{selectedCard.note.noteType.name}</p>
                </div>
                
                {selectedCard.sourcePageNumber && (
                  <div>
                    <h4 className="font-semibold mb-2">Source Page</h4>
                    <p>{selectedCard.sourcePageNumber}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 