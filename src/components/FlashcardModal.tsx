import React, { useState, useRef, useEffect } from 'react';
import { X, Check, HelpCircle, Eye, Type, RotateCcw } from 'lucide-react';
import { Flashcard } from '../types';
import axios from 'axios';
import { FaArrowLeft } from 'react-icons/fa';

// Define the possible response values more explicitly
type FlashcardResponse = 'again' | 'hard' | 'good' | 'easy';

interface FlashcardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: Flashcard[];
  initialIndex?: number;
  reviewMode?: 'classic' | 'spaced' | 'input';
  onRespond?: (difficulty: FlashcardResponse) => void;
  onPrevious?: () => void;
  modalSize: { width: number; height: number };
  onResize: (size: { width: number; height: number }) => void;
  sessionNewCount: number;
  sessionDueCount: number;
}

export const FlashcardModal: React.FC<FlashcardModalProps> = ({
  isOpen,
  onClose,
  cards,
  initialIndex = 0,
  reviewMode = 'classic',
  onRespond,
  onPrevious,
  modalSize,
  onResize,
  sessionNewCount,
  sessionDueCount,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Center the modal when it first appears
  useEffect(() => {
    if (modalRef.current && isOpen) {
      const attemptCenter = () => {
        if (!modalRef.current) return;
        const rect = modalRef.current.getBoundingClientRect();
        // Ensure width/height are not zero before calculating
        if (rect.width > 0 && rect.height > 0) {
            setPosition({
            x: (window.innerWidth - rect.width) / 2,
            y: (window.innerHeight - rect.height) / 2
            });
            console.log(`[FlashcardModal] Centered at x: ${(window.innerWidth - rect.width) / 2}, y: ${(window.innerHeight - rect.height) / 2}`);
            // modalRef.current.focus(); // Delay or remove focus to see if it helps
        } else {
            console.warn("[FlashcardModal] Centering attempt failed: Modal dimensions are zero.");
        }
      };
      // Attempt immediate centering, then again slightly delayed
      attemptCenter();
      const timeoutId = setTimeout(attemptCenter, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, initialIndex]);

  // Reset flip state based on the initialIndex prop changing
  useEffect(() => {
    // --- DEBUG LOG --- 
    console.log(`[FlashcardModal Effect 1] initialIndex changed to: ${initialIndex}. Setting isFlipped: false.`);
    // --- END DEBUG LOG ---
    setIsFlipped(false);
    setFeedback(null);
    setAnswerInput('');
    // --- EDIT: Reset position to trigger recentering --- 
    setPosition({ x: -9999, y: -9999 }); // Move offscreen temporarily
    // --- END EDIT ---
    if (reviewMode === 'input' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [initialIndex, reviewMode]); 

  // Reset state when the cards array itself changes
  useEffect(() => {
    console.log(`[FlashcardModal] cards prop changed (length: ${cards.length}). Resetting state.`);
    setIsFlipped(false);
    setFeedback(null);
    setAnswerInput('');
  }, [cards]); 

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    if (modalRef.current) {
      setIsDragging(true);
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - position.x, 
        y: e.clientY - position.y 
      });
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Update mouse event listeners for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({ 
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStartPos.current.x;
        const deltaY = e.clientY - resizeStartPos.current.y;
        onResize({ 
          width: Math.max(450, resizeStartSize.current.width + deltaX),
          height: Math.max(400, resizeStartSize.current.height + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, isResizing, onResize, position.x, position.y]); 

  const checkAnswer = async () => {
    if (!answerInput.trim()) return;
    setIsCheckingAnswer(true);
    setFeedback(null); 
    console.log('Checking answer...');
    try {
      const currentCard = cards[initialIndex]; 
      const response = await axios.post('/api/check-flashcard-answer', {
        userAnswer: answerInput.trim(),
        correctAnswer: currentCard.back,
        flashcardContent: currentCard
      });
      const evaluation = response.data;
      console.log('Received answer evaluation:', evaluation);
      let feedbackText = '';
      if (evaluation.score >= 0.9) feedbackText = `✅ Great job! Your answer is correct.\n\n`;
      else if (evaluation.score >= 0.5) feedbackText = `🔶 Partially correct.\n\n`;
      else feedbackText = `❌ Your answer needs improvement.\n\n`;
      feedbackText += `${evaluation.feedback}\n\n`;
      if (evaluation.correctPoints?.length) {
        feedbackText += `What you got right:\n`;
        evaluation.correctPoints.forEach((point: string) => { feedbackText += `• ${point}\n`; });
        feedbackText += '\n';
      }
      if (evaluation.missedPoints?.length) {
        feedbackText += `Areas to improve:\n`;
        evaluation.missedPoints.forEach((point: string) => { feedbackText += `• ${point}\n`; });
        feedbackText += '\n';
      }
      setFeedback(feedbackText);
      console.log('Setting feedback and flipping card');
    } catch (error) {
      console.error('Error checking answer:', error);
      setFeedback("Sorry, there was an error evaluating your answer. Here's the correct answer for reference.");
    } finally {
      setIsCheckingAnswer(false);
      setTimeout(() => setIsFlipped(true), 50);
    }
  };

  const handleDontKnow = () => {
    setFeedback(null); 
    console.log("Don't know button clicked");
    setTimeout(() => setIsFlipped(true), 50);
  };

  // Focus logic now depends on initialIndex prop
  useEffect(() => {
    if (reviewMode === 'input' && inputRef.current && !isFlipped) {
      inputRef.current.focus();
    }
  }, [initialIndex, reviewMode, isFlipped]);

  // Refocus logic remains the same
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (reviewMode === 'input' && !isFlipped && inputRef.current) {
        if (modalRef.current?.contains(e.target as Node) && !inputRef.current.contains(e.target as Node)) {
          setTimeout(() => inputRef.current?.focus(), 10);
        }
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [reviewMode, isFlipped]);

  const handlePrevious = () => {
    if (onPrevious) onPrevious();
  };

  const handleRespond = (difficulty: FlashcardResponse) => {
    if (onRespond) onRespond(difficulty);
  };

  // Use initialIndex prop for card access check
  if (cards.length === 0 || initialIndex >= cards.length) { 
    return null; 
  }
  const currentCard = cards[initialIndex]; 

  // --- DEBUG LOG --- 
  console.log(`[FlashcardModal Render] Rendering Card Index: ${initialIndex}, isFlipped: ${isFlipped}`);
  // --- END DEBUG LOG ---

  const renderBackContent = () => {
    console.log(`Rendering back content for card ${initialIndex + 1}:`, JSON.stringify({
      hasPageNumber: !!currentCard.pageNumber,
      pageNumber: currentCard.pageNumber,
      hasPageImage: !!currentCard.pageImage,
      imageLength: currentCard.pageImage?.length || 0
    }));
    return (
      <>
        <h4 className="font-medium text-gray-700 mb-3">Answer:</h4>
        <p className="text-gray-800 whitespace-pre-line">{currentCard.back}</p>
        {currentCard.pageNumber && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{`Source: Page ${currentCard.pageNumber}`}</span>
            </div>
            {currentCard.pageImage && currentCard.pageImage.length > 100 ? (
              <div className="mt-2 p-1 bg-white border border-gray-300 rounded">
                  <img src={currentCard.pageImage} alt={`Page ${currentCard.pageNumber}`} className="w-full h-auto max-h-[40vh] object-contain"
                    onError={(e) => { /* Error handling */ }}
                    onLoad={(event) => { /* Load handling */ }}
                  />
              </div>
            ) : (
              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 text-center">
                {currentCard.pageImage ? 'Image preview unavailable' : 'No image available for this page'}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  const progressPercent = cards.length > 0 ? ((initialIndex + 1) / cards.length) * 100 : 0; 

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      setIsResizing(true);
      resizeStartPos.current = { x: e.clientX, y: e.clientY };
      resizeStartSize.current = { width: modalSize.width, height: modalSize.height };
      e.stopPropagation();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 
        ${isOpen ? 'visible bg-black bg-opacity-50' : 'invisible'}
        transition-opacity duration-300 ease-in-out
        ${isOpen ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        ref={modalRef}
        className={`flashcard-modal-container relative bg-white rounded-lg shadow-xl overflow-hidden min-h-[450px]`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${modalSize.width}px`,
          height: `${modalSize.height}px`,
          maxWidth: '95vw',
          maxHeight: '90vh',
          cursor: isResizing ? 'nwse-resize' : 'default',
        }}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header with drag handle */}
        <div 
          className="flex items-center justify-between p-4 border-b cursor-grab flex-shrink-0" 
          onMouseDown={handleDragStart} 
          onMouseUp={handleDragEnd} 
        >
          <h2 className="text-lg font-bold text-gray-800">Flashcard {cards.length > 0 ? initialIndex + 1 : 0} of {cards.length}</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-md p-1 mr-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                  setAnswerInput('');
                  setFeedback(null);
                }}
                className={`px-3 py-1 text-sm rounded-md flex items-center gap-1 ${reviewMode === 'classic' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                <Eye size={14} />
                <span>Classic</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                  setAnswerInput('');
                  setFeedback(null);
                }}
                className={`px-3 py-1 text-sm rounded-md flex items-center gap-1 ${reviewMode === 'input' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:bg-gray-200'}`}
              >
                <Type size={14} />
                <span>Input</span>
              </button>
            </div>
            {isFlipped && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                  setFeedback(null);
                  if (reviewMode === 'input') setAnswerInput('');
                }}
                title="Back to Question"
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 hover:text-gray-800"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            <button onClick={onClose} title="Close" className="p-1.5 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Progress Bar and Chips */}
        <div className="px-4 pt-2 pb-3 border-b">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{initialIndex + 1} / {cards.length}</span> 
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{sessionNewCount} New</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{sessionDueCount} Review</span>
          </div>
        </div>

        {/* Card Content Area */}
        <div className="flex-grow p-4 overflow-y-auto"> 
          {/* --- Front Face --- */}
          {!isFlipped && (
            <div key={`front-${initialIndex}`} className="w-full h-full flex flex-col p-6 bg-white border-2 border-gray-200 rounded-xl shadow-lg">
              {(() => {
                  console.log(`[FlashcardModal Render Logic] Rendering FRONT for index ${initialIndex}`); 
                  return null;
              })()}
              <div className="flex-grow flex flex-col justify-center min-h-[200px] h-full px-4 py-8">
                <h3 className="text-xl font-semibold text-center text-gray-800">{currentCard.front}</h3>
              </div>
              {reviewMode === 'classic' ? ( 
                <button onClick={(e) => { 
                    e.stopPropagation(); 
                    console.log('[FlashcardModal] Show Answer clicked. Setting isFlipped to true.');
                    setIsFlipped(true); 
                }} className="mt-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 self-center flashcard-show-answer">Show Answer</button> 
              ) : ( 
                <div className="w-full mt-4 space-y-4 flex-shrink-0">
                  <textarea
                    ref={inputRef}
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Type your answer here..."
                    className="w-full h-24 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isFlipped}
                  />
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); if (answerInput.trim()) checkAnswer(); }}
                      disabled={isCheckingAnswer || !answerInput.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Check size={16} />
                      {isCheckingAnswer ? 'Checking...' : 'Check Answer'}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDontKnow(); }}
                      disabled={isCheckingAnswer}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center gap-2"
                    >
                      <HelpCircle size={16} />
                      I don't know
                    </button>
                  </div>
                </div>
              )}
              <div className="absolute bottom-3 right-3 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{reviewMode === 'classic' && "Press space to flip"}</div>
            </div>
          )}

          {/* --- Back Face --- */}
          {isFlipped && (
            <div key={`back-${initialIndex}`} className="flashcard-back-face w-full h-full flex flex-col p-6 bg-blue-50 border-2 border-gray-200 rounded-xl shadow-lg">
              {(() => { 
                  console.log(`[FlashcardModal Render Logic] Rendering BACK for index ${initialIndex}`);
                  return null;
              })()}
              <div className="flex-1 overflow-y-auto pr-2 mb-4"> 
                {reviewMode === 'input' && feedback && ( 
                  <div className="prose prose-sm max-w-none mb-4 pb-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-2">Feedback:</h4>
                    <div className="whitespace-pre-line text-gray-700">{feedback}</div>
                  </div>
                )}
                {renderBackContent()} 
              </div>
              {/* Rating Buttons */}
              <div className="mt-4 flex flex-col sm:flex-row justify-around p-2 space-y-2 sm:space-y-0 sm:space-x-2 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); handleRespond('again'); }} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg shadow transition duration-150 ease-in-out transform hover:scale-105 text-center">
                  Again <span className="text-sm font-normal">(Key 1)</span><br />
                  <span className="text-xs font-normal">&lt;1m</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleRespond('hard'); }} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-lg shadow transition duration-150 ease-in-out transform hover:scale-105 text-center">
                  Hard <span className="text-sm font-normal">(Key 2)</span><br />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleRespond('good'); }} className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg shadow transition duration-150 ease-in-out transform hover:scale-105 text-center">
                  Good <span className="text-sm font-normal">(Key 3)</span><br />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleRespond('easy'); }} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow transition duration-150 ease-in-out transform hover:scale-105 text-center">
                  Easy <span className="text-sm font-normal">(Key 4)</span><br />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mt-4 p-4 border-t flex-shrink-0 flex-wrap"> 
          <button onClick={(e) => { e.stopPropagation(); handlePrevious(); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200" disabled={initialIndex === 0}>
            <FaArrowLeft className="w-4 h-4" /> Previous
          </button>
          <div className="text-sm text-gray-500">{cards.length > 0 ? initialIndex + 1 : 0} / {cards.length}</div>
          <div className="w-[100px]"></div>
        </div>

        {/* Resize Handle */}
        <div 
          onMouseDown={handleMouseDown} 
          className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          style={{ width: '20px', height: '20px', bottom: '0', right: '0' }}
        />
      </div>
    </div>
  );
};