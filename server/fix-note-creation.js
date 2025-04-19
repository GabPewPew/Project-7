import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createDefaultNoteType() {
  try {
    // Check if the default note type exists
    let defaultNoteType = await prisma.noteType.findFirst({
      where: { name: 'PDF Extract' }
    });
    
    if (!defaultNoteType) {
      console.log('Creating default note type...');
      defaultNoteType = await prisma.noteType.create({
        data: {
          name: 'PDF Extract',
          fields: JSON.stringify([
            'Front',
            'Back',
            'SourceText',
            'PageNumber',
            'SourceDocumentId'
          ]),
          cardTemplates: JSON.stringify([
            {
              name: 'DefaultTemplate',
              frontTemplate: '<div class="front">{{Front}}</div>',
              backTemplate: `
                <div class="back">
                  <div class="question">{{Front}}</div>
                  <hr>
                  <div class="answer">{{Back}}</div>
                </div>
              `
            }
          ])
        }
      });
      console.log(`Created default note type with ID: ${defaultNoteType.id}`);
    } else {
      console.log(`Default note type already exists with ID: ${defaultNoteType.id}`);
    }
    
    // Get existing deck
    const deck = await prisma.deck.findFirst();
    
    if (!deck) {
      console.log('No deck found, creating a default deck...');
      const newDeck = await prisma.deck.create({
        data: {
          name: 'Default Deck'
        }
      });
      console.log(`Created default deck with ID: ${newDeck.id}`);
    } else {
      console.log(`Using existing deck: ${deck.name} (ID: ${deck.id})`);
    }
    
    // Create sample note
    const note = await prisma.note.create({
      data: {
        noteTypeId: defaultNoteType.id,
        fieldValues: JSON.stringify({
          Front: 'Sample Question',
          Back: 'Sample Answer',
          SourceText: 'This is sample source text',
          PageNumber: '1',
          SourceDocumentId: 'sample-doc-id'
        })
      }
    });
    
    console.log(`Created sample note with ID: ${note.id}`);
    
    // Create sample card
    const card = await prisma.card.create({
      data: {
        noteId: note.id,
        deckId: deck ? deck.id : (await prisma.deck.findFirst()).id,
        noteTypeCardTemplateName: 'DefaultTemplate',
        frontContent: '<div class="front">Sample Question</div>',
        backContent: `
          <div class="back">
            <div class="question">Sample Question</div>
            <hr>
            <div class="answer">Sample Answer</div>
          </div>
        `,
        progress: {
          create: {
            repetitions: 0,
            easeFactor: 2500,
            interval: 0,
            dueDate: new Date(),
            state: 'new',
            learningStep: 0
          }
        }
      },
      include: {
        progress: true
      }
    });
    
    console.log(`Created sample card with ID: ${card.id}`);
    console.log(`Card progress record: ${card.progress.id}`);
    
    console.log('Database setup complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultNoteType(); 