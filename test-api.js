// Script to test API endpoints
// @ts-check
import fetch from 'node-fetch';

async function testGenerateFlashcards() {
  console.log('Testing /api/generate-flashcards endpoint...');
  
  const testData = {
    noteTitle: 'Test Note ' + new Date().toISOString(),
    noteContent: 'This is a test note with content for testing flashcard generation.',
    rawText: 'Additional raw text for context in the flashcard generation process.'
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/generate-flashcards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success! Generated flashcards:', data.count);
      console.log('First card:', data.cards[0]);
    } else {
      console.error('❌ API Error:', data.error);
      if (data.details) {
        console.error('Details:', data.details);
      }
    }
  } catch (error) {
    console.error('❌ Fetch Error:', error);
  }
}

// Run the test
testGenerateFlashcards(); 