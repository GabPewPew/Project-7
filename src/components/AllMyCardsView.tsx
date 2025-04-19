import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Type to match the backend response for /api/decks
type DeckSummary = {
  id: string;
  name: string;
  newCount: number;
  learnCount: number;
  dueCount: number;
};

interface AllMyCardsViewProps { // Renamed interface
  onDeckSelect: (deckId: string) => void; // Function to call when a deck is clicked
}

// Renamed Component
export function AllMyCardsView({ onDeckSelect }: AllMyCardsViewProps) { 
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDecks = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('[AllMyCardsView] Fetching decks from /api/decks...'); // Updated log prefix
      const response = await axios.get<DeckSummary[]>('/api/decks');
      console.log('[AllMyCardsView] Received decks:', response.data);
      setDecks(response.data);
    } catch (err) {
      console.error('[AllMyCardsView] Error fetching decks:', err);
      setError('Failed to load decks. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []); // Empty dependency array means this runs once on mount

  const handleDeleteDeck = async (deckId: string, deckName: string) => {
    if (deletingId === deckId) return;

    if (window.confirm(`Are you sure you want to delete the deck "${deckName}"? This will delete all associated cards and their review progress.`)) {
      setDeletingId(deckId);
      try {
        console.log(`[AllMyCardsView] Sending DELETE request for deck ID: ${deckId}`);
        const response = await axios.delete(`/api/decks/${deckId}`);
        console.log('[AllMyCardsView] Deck deletion response:', response.data);
        toast.success(response.data.message || `Deck "${deckName}" deleted.`);
        fetchDecks();
      } catch (err: any) {
        console.error(`[AllMyCardsView] Error deleting deck ${deckId}:`, err);
        const errorMessage = err.response?.data?.error || err.message || 'Failed to delete deck.';
        toast.error(`Error deleting deck: ${errorMessage}`);
      } finally {
        setDeletingId(null);
      }
    }
  };

  if (loading && decks.length === 0) {
    return <div className="p-6 text-center text-gray-500">Loading decks...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        {/* Update Title */}
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Layers className="mr-2 text-blue-600" />
          All My Cards (Decks)
        </h1>
      </div>

      {decks.length === 0 && !loading ? (
        <p className="text-gray-600 text-center">No decks found. Generate notes from files to create decks.</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <ul className="divide-y divide-gray-200">
            {decks.map((deck) => (
              <li key={deck.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <a 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onDeckSelect(deck.id);
                  }}
                  className="flex-grow mr-4"
                >
                  <span className="text-lg font-semibold text-blue-700 hover:underline">
                    {deck.name}
                  </span>
                </a>
                {/* Counts and Delete Area */}
                <div className="flex items-center space-x-4 text-sm font-medium">
                  <span className="text-blue-600 w-6 text-center" title="New Cards">{deck.newCount}</span>
                  <span className="text-orange-600 w-6 text-center" title="Learning Cards">{deck.learnCount}</span>
                  <span className="text-green-600 w-6 text-center" title="Cards Due for Review">{deck.dueCount}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDeck(deck.id, deck.name);
                    }}
                    title={`Delete deck "${deck.name}"`}
                    disabled={deletingId === deck.id}
                    className="p-1 text-gray-400 hover:text-red-600 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === deck.id ? (
                      <svg className="animate-spin h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Export the component as default or named as needed
// Ensure default export matches if needed by App.tsx import
export default AllMyCardsView; 