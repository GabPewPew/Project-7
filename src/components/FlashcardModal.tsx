import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, Check, HelpCircle, Eye, Type, RotateCcw } from 'lucide-react';
import { Flashcard } from '../types';
import axios from 'axios';

interface FlashcardModalProps {
  flashcards: Flashcard[];
  currentIndex: number;
  totalCardsInSession: number;
  onClose: () => void;
  onUpdate: (flashcards: Flashcard[]) => void;
  onResponse: (response: 'again' | 'good') => void;
  onPrevious: () => void;
  sessionNewCount: number;
  sessionDueCount: number;
}

type ReviewMode = 'classic' | 'input';

export function FlashcardModal({ 
  flashcards, 
  currentIndex,
  totalCardsInSession,
  onClose, 
  onUpdate, 
  onResponse, 
  onPrevious,
  sessionNewCount,
  sessionDueCount
}: FlashcardModalProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [reviewMode, setReviewMode] = useState<ReviewMode>('classic');
  const [answerInput, setAnswerInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);

  // Add state for resizing
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartPos = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0 });
  
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Center the modal when it first appears
  useEffect(() => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: (window.innerHeight - rect.height) / 2
      });
      // Initialize size based on initial render if needed
      // setSize({ width: rect.width, height: rect.height });
    }
  }, []);

  // Improved version of the reset flip state effect
  useEffect(() => {
    console.log(`[FlashcardModal] currentIndex changed to: ${currentIndex}. Resetting isFlipped to false.`);
    
    // Force immediate reset of flip state
    setIsFlipped(false);
    
    // Clear other related state
    setFeedback(null);
    setAnswerInput('');
    
    // Re-focus input in input mode
    if (reviewMode === 'input' && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [currentIndex, reviewMode]);

  // Add a forced reset when the whole queue changes
  useEffect(() => {
    console.log(`[FlashcardModal] flashcards array changed (length: ${flashcards.length}). Resetting state.`);
    setIsFlipped(false);
    setFeedback(null);
    setAnswerInput('');
  }, [flashcards]);

  const handleDragStart = (e: React.MouseEvent) => {
    // Prevent drag start if clicking on the resize handle
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    
    if (modalRef.current) {
      setIsDragging(true);
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleDrag = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && reviewMode === 'classic' && !isFlipped) {
      e.preventDefault();
      setIsFlipped(true);
    } else if (e.key === 'ArrowLeft') {
      onPrevious();
    } else if (isFlipped) {
      switch (e.key) {
        case '1':
          onResponse('again');
          break;
        case '2':
          onResponse('good');
          break;
      }
    }
  };

  // Resize handler functions
  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { width: size.width, height: size.height };
    // Prevent event bubbling to avoid triggering drag
    e.stopPropagation();
  };

  const handleResize = (e: MouseEvent) => {
    if (isResizing) {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;
      setSize({
        width: Math.max(450, resizeStartSize.current.width + deltaX), // Min width
        height: Math.max(400, resizeStartSize.current.height + deltaY) // Min height
      });
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
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
        handleResize(e);
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
  }, [isDragging, dragOffset, isResizing]); // Add isResizing dependency

  const checkAnswer = async () => {
    if (!answerInput.trim()) return;
    
    setIsCheckingAnswer(true);
    setFeedback(null); // Clear previous feedback
    console.log('Checking answer...');
    
    try {
      const currentCard = flashcards[currentIndex];
      
      // Call the API endpoint to evaluate the answer
      const response = await axios.post('http://localhost:3000/api/check-flashcard-answer', {
        userAnswer: answerInput.trim(),
        correctAnswer: currentCard.back,
        flashcardContent: currentCard
      });
      
      const evaluation = response.data;
      console.log('Received answer evaluation:', evaluation);
      
      // Format feedback text based on the evaluation
      let feedbackText = '';
      
      if (evaluation.score >= 0.9) {
        feedbackText = `✅ Great job! Your answer is correct.\n\n`;
      } else if (evaluation.score >= 0.5) {
        feedbackText = `🔶 Partially correct.\n\n`;
      } else {
        feedbackText = `❌ Your answer needs improvement.\n\n`;
      }
      
      feedbackText += `${evaluation.feedback}\n\n`;
      
      if (evaluation.correctPoints?.length) {
        feedbackText += `What you got right:\n`;
        evaluation.correctPoints.forEach((point: string) => {
          feedbackText += `• ${point}\n`;
        });
        feedbackText += '\n';
      }
      
      if (evaluation.missedPoints?.length) {
        feedbackText += `Areas to improve:\n`;
        evaluation.missedPoints.forEach((point: string) => {
          feedbackText += `• ${point}\n`;
        });
        feedbackText += '\n';
      }
      
      setFeedback(feedbackText);
      console.log('Setting feedback and flipping card');
    } catch (error) {
      console.error('Error checking answer:', error);
      setFeedback("Sorry, there was an error evaluating your answer. Here's the correct answer for reference.");
    } finally {
      setIsCheckingAnswer(false);
      
      // Force a small delay before flipping to ensure state updates are processed
      setTimeout(() => {
        setIsFlipped(true);
        console.log('Card flipped to show answer');
      }, 50);
    }
  };

  const handleDontKnow = () => {
    // Clear any existing feedback
    setFeedback(null); 
    console.log("Don't know button clicked");
    
    // Force a small delay before flipping to ensure state updates are processed
    setTimeout(() => {
      setIsFlipped(true);
      console.log("Don't know: Card flipped to show answer");
    }, 50);
  };

  // Focus on the input when in input mode and card is visible
  useEffect(() => {
    if (reviewMode === 'input' && inputRef.current && !isFlipped) {
      inputRef.current.focus();
    }
  }, [currentIndex, reviewMode, isFlipped]);

  // Add event listener for input refocus - fixes the input focus issue
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (reviewMode === 'input' && !isFlipped && inputRef.current) {
        // Check if click is outside the input area but within the modal
        if (modalRef.current?.contains(e.target as Node) && 
            !inputRef.current.contains(e.target as Node)) {
          // Short timeout to let other click handlers execute first
          setTimeout(() => {
            inputRef.current?.focus();
          }, 10);
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [reviewMode, isFlipped]);

  if (flashcards.length === 0 || currentIndex >= flashcards.length) {
    // Handle cases where index might be out of bounds briefly
    return null; 
  }

  const currentCard = flashcards[currentIndex];

  // Function to render the back content consistently
  const renderBackContent = () => {
    // Fix console log to stringify the object
    console.log(`Rendering back content for card ${currentIndex + 1}:`, JSON.stringify({
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
              <span className="text-xs font-medium text-gray-500">
                {`Source: Page ${currentCard.pageNumber}`}
              </span>
            </div>

            {/* Conditional rendering based on image validity */}
            {currentCard.pageImage && currentCard.pageImage.length > 100 ? (
              // Outer container for margin, border, background
              <div className="mt-2 p-1 bg-white border border-gray-300 rounded">
                  {/* Apply Tailwind classes directly to the image */}
                  <img
                    src={currentCard.pageImage}
                    alt={`Page ${currentCard.pageNumber}`}
                    className="w-full h-auto max-h-[40vh] object-contain" // Use Tailwind for sizing/fitting
                    onError={(e) => {
                      console.error(`Image failed to load for page ${currentCard.pageNumber}:`, e);
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        (e.target as HTMLImageElement).style.display = 'none';
                        // Check if fallback already exists
                        if (!parent.querySelector('.image-fallback-message')) {
                            const fallbackMsg = document.createElement('div');
                            fallbackMsg.className = 'image-fallback-message p-2 text-xs text-gray-500 text-center';
                            fallbackMsg.innerText = 'Image preview unavailable';
                            parent.appendChild(fallbackMsg);
                        }
                      }
                    }}
                    onLoad={(event) => { // Added event parameter for target access
                      console.log(`Page image for page ${currentCard.pageNumber} loaded successfully`);
                       // Remove fallback if image loads successfully later
                       const parent = (event.target as HTMLImageElement).parentElement;
                       const fallback = parent?.querySelector('.image-fallback-message');
                       if (fallback) {
                           fallback.remove();
                       }
                       (event.target as HTMLImageElement).style.display = 'block';
                    }}
                  />
              </div>
            ) : (
              <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 text-center">
                {/* Provide clearer feedback */}
                {currentCard.pageImage ? 'Image preview unavailable' : 'No image available for this page'}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  // --- Calculate derived state for UI --- 
  const remainingCount = totalCardsInSession - currentIndex; // Simple remaining count
  const progressPercent = totalCardsInSession > 0 ? (currentIndex / totalCardsInSession) * 100 : 0;

  return (
    <div 
      className="fixed inset-0 z-50 pointer-events-none" 
      tabIndex={0} 
      onKeyDown={handleKeyDown}
    >
      <div className="absolute inset-0 bg-black bg-opacity-50 pointer-events-auto" onClick={onClose} />
      
      <div
        ref={modalRef}
        className="absolute bg-white rounded-xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden" // Use flex column
        style={{ 
          left: `${position.x}px`, 
          top: `${position.y}px`,
          width: `${size.width}px`, // Apply size state
          height: `${size.height}px`, // Apply size state
          minWidth: '800px', 
          minHeight: '600px', 
          cursor: isDragging ? 'grabbing' : 'default',
          transition: isDragging || isResizing ? 'none' : 'transform 0.15s ease-out'
        }}
      >
        {/* Header with drag handle */}
        <div 
          className="flex items-center justify-between p-4 border-b cursor-grab flex-shrink-0" // Adjusted padding
          onMouseDown={handleDragStart} // Dragging starts here
          onMouseUp={handleDragEnd} // Drag ends here
        >
          <h2 className="text-lg font-bold text-gray-800"> 
            Flashcard {flashcards.length > 0 ? currentIndex + 1 : 0} of {flashcards.length}
          </h2>

          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex items-center bg-gray-100 rounded-md p-1 mr-2">
              <button
                onClick={() => {
                  setReviewMode('classic');
                  setFeedback(null);
                  setAnswerInput('');
                  setIsFlipped(false);
                }}
                className={`px-3 py-1 text-sm rounded-md flex items-center gap-1 ${
                  reviewMode === 'classic' 
                    ? 'bg-white shadow-sm text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Eye size={14} />
                <span>Classic</span>
              </button>
              <button
                onClick={() => {
                  setReviewMode('input');
                  setFeedback(null);
                  setAnswerInput('');
                  setIsFlipped(false);
                }}
                className={`px-3 py-1 text-sm rounded-md flex items-center gap-1 ${
                  reviewMode === 'input' 
                    ? 'bg-white shadow-sm text-blue-600' 
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Type size={14} />
                <span>Input</span> {/* Shortened label */}
              </button>
            </div>
            
            {/* Moved "Back to Question" button - only visible when flipped */}
            {isFlipped && (
              <button
                onClick={() => {
                  setIsFlipped(false);
                  setFeedback(null);
                  if (reviewMode === 'input') {
                    setAnswerInput('');
                  }
                }}
                title="Back to Question"
                className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600 hover:text-gray-800"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Progress Bar and Chips */}
        <div className="px-4 pt-2 pb-3 border-b">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{currentIndex} / {totalCardsInSession}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {sessionNewCount} New
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {sessionDueCount} Review
            </span>
          </div>
        </div>

        {/* Card Content Area - Takes remaining space */}
        <div className="flex-grow p-4 overflow-hidden"> 
          <div className={`
            transform transition-all duration-300 ease-in-out
            relative rounded-xl shadow-lg overflow-hidden h-full
            ${isFlipped ? 'bg-blue-50' : 'bg-white'}
            border-2 border-gray-200 hover:border-gray-300
          `}
          style={{ perspective: '1000px' }}>
            {/* Front Face */}
            <div 
              className={`
                absolute inset-0 w-full h-full flex flex-col p-6
                ${isFlipped ? 'hidden' : 'block'}
              `}
              key={`front-${currentIndex}`}
            >
              <div className="flex-grow flex flex-col items-center justify-center">
                <h3 className="text-xl font-semibold text-center text-gray-800 mb-6">
                  {currentCard.front}
                </h3>
              </div>

              {reviewMode === 'classic' ? (
                <button
                  onClick={() => setIsFlipped(true)}
                  className="mt-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 self-center"
                >
                  Show Answer
                </button>
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
                      onClick={() => {
                        // Only check answer if there's input
                        if (answerInput.trim()) {
                          checkAnswer();
                        }
                      }}
                      disabled={isCheckingAnswer || !answerInput.trim()}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Check size={16} />
                      {isCheckingAnswer ? 'Checking...' : 'Check Answer'}
                    </button>
                    <button
                      onClick={() => {
                        handleDontKnow();
                      }}
                      disabled={isCheckingAnswer}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 flex items-center gap-2"
                    >
                      <HelpCircle size={16} />
                      I don't know
                    </button>
                  </div>
                </div>
              )}
              
              <div className="absolute bottom-2 right-3 text-xs text-gray-400">
                {reviewMode === 'classic' && "Press space to flip"}
              </div>
            </div>

            {/* Back Face */}
            <div 
              className={`
                absolute inset-0 w-full h-full flex flex-col p-6
                ${isFlipped ? 'block' : 'hidden'}
              `}
              key={`back-${currentIndex}`}
            >
              {/* Scrollable content area for the back */}
              <div className="flex-1 overflow-y-auto pr-2 mb-4"> {/* Add margin-bottom */}
                {/* Show feedback only in input mode */}
                {reviewMode === 'input' && feedback && (
                  <div className="prose prose-sm max-w-none mb-4 pb-4 border-b border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-2">Feedback:</h4>
                    <div className="whitespace-pre-line text-gray-700">
                      {feedback}
                    </div>
                  </div>
                )}
                {/* Always show the correct answer and source info */}
                {renderBackContent()} 
              </div>
              
              {/* Anki-Style Response Buttons Area */}
              <div className="flex-shrink-0 mt-auto pt-4 border-t border-gray-200">
                 {/* Use Grid for responsive layout */}
                 <div className="grid grid-cols-2 gap-4">
                   {/* Again Button */}
                   <button 
                     onClick={() => onResponse('again')}
                     className="flex flex-col items-center justify-center w-full px-3 py-3 rounded-lg text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors duration-150 bg-red-600 hover:bg-red-700"
                     title="Show again soon (Press 1)"
                   >
                     <span>Again</span>
                     <span className="text-xs opacity-80">&lt;1m</span>
                   </button>
                   
                   {/* Good Button */} 
                   <button 
                     onClick={() => onResponse('good')}
                     className="flex flex-col items-center justify-center w-full px-3 py-3 rounded-lg text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors duration-150 bg-green-600 hover:bg-green-700"
                     title="Correct, check again later (Press 2)" // Updated title
                   >
                     <span>Good</span>
                      {/* Can optionally show goodCount here later if needed */}
                   </button>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between mt-4 p-4 border-t flex-shrink-0"> {/* Adjusted padding */}
          <button
            onClick={onPrevious}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <div className="text-sm text-gray-500">
            {flashcards.length > 0 ? currentIndex + 1 : 0} / {flashcards.length}
          </div>
          <div className="w-[100px]"></div>
        </div>

        {/* Resize Handle */}
        <div 
          className="resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize flex items-center justify-center" 
          onMouseDown={handleResizeStart}
        >
          <svg viewBox="0 0 10 10" className="text-gray-400 opacity-70" width="10" height="10">
            <path d="M0,10 L10,0 M5,10 L10,5 M0,5 L5,0" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
      </div>
    </div>
  );
}