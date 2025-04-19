import { PrismaClient } from '@prisma/client';
console.log('Script started - importing PrismaClient');
const prisma = new PrismaClient();
console.log('PrismaClient initialized');

async function runDiagnosis() {
  console.log('Starting database diagnosis...');
  
  try {
    console.log('Checking noteTypes table...');
    // Check noteTypes
    try {
      const noteTypes = await prisma.noteType.findMany();
      console.log(`NoteTypes: ${noteTypes.length} records found`);
      if (noteTypes.length > 0) {
        console.log(`First noteType: ${JSON.stringify(noteTypes[0], null, 2)}`);
      } else {
        console.log('No noteTypes found - this may cause issues with card creation');
      }
    } catch (e) {
      console.error('Error querying noteTypes:', e);
    }
    
    console.log('Checking decks table...');
    // Check decks
    try {
      const decks = await prisma.deck.findMany();
      console.log(`Decks: ${decks.length} records found`);
      if (decks.length > 0) {
        console.log(`First deck: ${JSON.stringify(decks[0], null, 2)}`);
      } else {
        console.log('No decks found - this will cause foreign key constraint issues');
      }
    } catch (e) {
      console.error('Error querying decks:', e);
    }
    
    console.log('Checking notes table...');
    // Check notes
    try {
      const notes = await prisma.note.findMany();
      console.log(`Notes: ${notes.length} records found`);
      if (notes.length > 0) {
        console.log(`First note: ${JSON.stringify(notes[0], null, 2)}`);
      } else {
        console.log('No notes found - this will cause foreign key constraint issues');
      }
    } catch (e) {
      console.error('Error querying notes:', e);
    }
    
    console.log('Checking cards table...');
    // Check cards
    try {
      const cards = await prisma.card.findMany();
      console.log(`Cards: ${cards.length} records found`);
      if (cards.length > 0) {
        console.log(`First card: ${JSON.stringify(cards[0], null, 2)}`);
      }
    } catch (e) {
      console.error('Error querying cards:', e);
    }
    
    console.log('Checking card_progress table...');
    // Check card progress
    try {
      const progress = await prisma.cardProgress.findMany();
      console.log(`CardProgress: ${progress.length} records found`);
      if (progress.length > 0) {
        console.log(`First progress record: ${JSON.stringify(progress[0], null, 2)}`);
      }
    } catch (e) {
      console.error('Error querying card progress:', e);
    }
    
    // Try to create a deck if none exists
    const deckCount = await prisma.deck.count();
    console.log(`Deck count is ${deckCount}`);
    if (deckCount === 0) {
      try {
        console.log('Creating a test deck...');
        const testDeck = await prisma.deck.create({
          data: {
            name: `Test Deck ${new Date().toISOString()}`
          }
        });
        console.log(`Created test deck: ${JSON.stringify(testDeck, null, 2)}`);
      } catch (e) {
        console.error('Error creating test deck:', e);
      }
    }
    
    console.log('Diagnosis complete');
  } catch (err) {
    console.error('Error during diagnosis:', err);
  } finally {
    console.log('Disconnecting from database');
    await prisma.$disconnect();
    console.log('Disconnected');
  }
}

console.log('Calling runDiagnosis()');
runDiagnosis(); 