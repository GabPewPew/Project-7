import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getFileContent } from '../lib/fileStorage';

interface Card {
  id: string;
  frontContent: string;
  backContent: string;
  sourceDocumentId: string | null;
  sourcePageNumber: number | null;
  progress: {
    state: string;
    easeFactor: number;
    interval: number;
    repetitions: number;
    dueDate: string;
  };
}

interface ReviewSessionProps {
  newLimit?: number;
  reviewLimit?: number;
  onClose: () => void;
}

export default function ReviewSession({ 
  newLimit = 20, 
  reviewLimit = 100, 
  onClose 
}: ReviewSessionProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [counts, setCounts] = useState({
    new: 0,
    learning: 0,
    relearning: 0,
    review: 0,
    total: 0,
  });
  
  const cardContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch cards for review
  useEffect(() => {
    const fetchCards = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get<{ cards: Card[], counts: typeof counts }>(
          `http://localhost:3001/api/session/cards?newLimit=${newLimit}&reviewLimit=${reviewLimit}`
        );
        
        setCards(response.data.cards);
        setCounts(response.data.counts);
        setIsLoading(false);
        
        if (response.data.cards.length === 0) {
          setSessionFinished(true);
        } else {
          // Load the first card's image if needed
          loadCardImage(response.data.cards[0]);
        }
      } catch (error) {
        console.error('Error fetching cards:', error);
        setIsLoading(false);
      }
    };
    
    fetchCards();
  }, [newLimit, reviewLimit]);
  
  // Load image for the current card
  const loadCardImage = async (card: Card) => {
    if (card.sourceDocumentId && card.sourcePageNumber !== null) {
      try {
        // Get the PDF image for the specified page - Pass both parameters for noteId and fileName
        const imageKey = `image_${card.sourceDocumentId}_${card.sourcePageNumber}`;
        const imageData = await getFileContent(card.sourceDocumentId, imageKey);
        
        if (imageData) {
          setPageImage(imageData);
        } else {
          setPageImage(null);
          console.warn(`Image not found for ${card.sourceDocumentId} page ${card.sourcePageNumber}`);
        }
      } catch (error) {
        console.error('Error loading card image:', error);
        setPageImage(null);
      }
    } else {
      setPageImage(null);
    }
  };
  
  // Show answer for the current card
  const handleShowAnswer = () => {
    setIsShowingAnswer(true);
  };
  
  // Process the user's response to the card
  const handleResponse = async (response: 'again' | 'hard' | 'good' | 'easy') => {
    if (currentIndex >= cards.length) return;
    
    try {
      // Send the response to the server
      await axios.post('http://localhost:3001/api/session/response', {
        cardId: cards[currentIndex].id,
        response
      });
      
      // Move to the next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsShowingAnswer(false);
        
        // Preload the next card's image
        loadCardImage(cards[currentIndex + 1]);
        
        // Scroll back to top when changing cards
        if (cardContainerRef.current) {
          cardContainerRef.current.scrollTop = 0;
        }
      } else {
        // End of session
        setSessionFinished(true);
      }
    } catch (error) {
      console.error('Error submitting response:', error);
    }
  };
  
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg shadow-xl">
          <h2 className="text-xl font-bold mb-4">Loading cards...</h2>
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (sessionFinished || cards.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <h2 className="text-xl font-bold mb-4">Session Finished</h2>
          <p className="mb-6">
            You've completed all cards for this session. Great job!
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  const currentCard = cards[currentIndex];
  const progressPercent = (currentIndex / cards.length) * 100;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-[900px] h-[700px] max-w-[95vw] max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            Card {currentIndex + 1} of {cards.length}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Progress bar */}
        <div className="px-4 pt-2 pb-3 border-b">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{currentIndex} / {cards.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {counts.new} New
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {counts.review} Review
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {counts.learning + counts.relearning} Learning
            </span>
          </div>
        </div>
        
        {/* Card content */}
        <div 
          ref={cardContainerRef}
          className="flex-grow p-6 overflow-y-auto"
        >
          {/* Front content */}
          <div
            className="prose prose-lg max-w-none mb-6"
            dangerouslySetInnerHTML={{ __html: currentCard.frontContent }}
          />
          
          {/* Back content - conditionally shown */}
          {isShowingAnswer && (
            <>
              <hr className="my-6 border-gray-200" />
              <div
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: currentCard.backContent }}
              />
              
              {/* Page image if available */}
              {pageImage && (
                <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
                  <img 
                    src={pageImage} 
                    alt={`Page ${currentCard.sourcePageNumber}`}
                    className="max-w-full h-auto"
                  />
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="p-4 border-t flex justify-center">
          {!isShowingAnswer ? (
            <button
              onClick={handleShowAnswer}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Show Answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2 w-full max-w-3xl">
              <button 
                onClick={() => handleResponse('again')}
                className="px-4 py-3 rounded-lg text-white font-semibold text-sm bg-red-600 hover:bg-red-700 flex flex-col items-center"
              >
                <span>Again</span>
                <span className="text-xs opacity-80">&lt;1m</span>
              </button>
              <button 
                onClick={() => handleResponse('hard')}
                className="px-4 py-3 rounded-lg text-white font-semibold text-sm bg-orange-500 hover:bg-orange-600 flex flex-col items-center"
              >
                <span>Hard</span>
                <span className="text-xs opacity-80">
                  {currentCard.progress.state === 'new' ? '1d' : `${Math.ceil(currentCard.progress.interval * 1.2)}d`}
                </span>
              </button>
              <button 
                onClick={() => handleResponse('good')}
                className="px-4 py-3 rounded-lg text-white font-semibold text-sm bg-green-600 hover:bg-green-700 flex flex-col items-center"
              >
                <span>Good</span>
                <span className="text-xs opacity-80">
                  {currentCard.progress.state === 'new' ? '1d' : `${Math.ceil(currentCard.progress.interval * (currentCard.progress.easeFactor / 1000))}d`}
                </span>
              </button>
              <button 
                onClick={() => handleResponse('easy')}
                className="px-4 py-3 rounded-lg text-white font-semibold text-sm bg-teal-600 hover:bg-teal-700 flex flex-col items-center"
              >
                <span>Easy</span>
                <span className="text-xs opacity-80">
                  {currentCard.progress.state === 'new' ? '4d' : `${Math.ceil(currentCard.progress.interval * (currentCard.progress.easeFactor / 1000) * 1.3)}d`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 