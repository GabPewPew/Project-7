import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Layers, Plus } from 'lucide-react';

// Type to match the backend response for /api/decks
type DeckSummary = {
  id: string;
  name: string;
  newCount: number;
  learnCount: number;
  dueCount: number;
};

interface DecksViewProps {
  onDeckSelect: (deckId: string) => void; // Function to call when a deck is clicked
}

export function DecksView({ onDeckSelect }: DecksViewProps) {
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDecks = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log('[DecksView] Fetching decks from /api/decks...');
        const response = await axios.get<DeckSummary[]>('/api/decks');
        console.log('[DecksView] Received decks:', response.data);
        setDecks(response.data);
      } catch (err) {
        console.error('[DecksView] Error fetching decks:', err);
        setError('Failed to load decks. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDecks();
  }, []); // Empty dependency array means this runs once on mount

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading decks...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600 bg-red-50 border border-red-200 rounded">{error}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Layers className="mr-2 text-blue-600" />
          Decks
        </h1>
        {/* Optional: Add Deck Button */}
        {/* 
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
          <Plus size={16} className="mr-1" />
          Add Deck
        </button> 
        */}
      </div>

      {decks.length === 0 ? (
        <p className="text-gray-600 text-center">No decks found. Generate notes from files to create decks.</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <ul className="divide-y divide-gray-200">
            {decks.map((deck) => (
              <li key={deck.id}>
                <a 
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onDeckSelect(deck.id);
                  }}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-blue-700 hover:underline">
                      {deck.name}
                    </span>
                    {/* Counts Area */}
                    <div className="flex space-x-4 text-sm font-medium">
                      <span className="text-blue-600" title="New Cards">{deck.newCount}</span>
                      <span className="text-orange-600" title="Learning Cards">{deck.learnCount}</span>
                      <span className="text-green-600" title="Cards Due for Review">{deck.dueCount}</span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Export the component as default or named as needed
export default DecksView; 