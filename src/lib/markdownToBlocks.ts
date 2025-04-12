import { NoteBlock } from '../types';

function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function markdownToNoteBlocks(markdown: string): NoteBlock[] {
  if (!markdown || typeof markdown !== 'string') {
    console.warn('Invalid markdown input');
    return [];
  }

  const lines = markdown.split('\n');
  const blocks: NoteBlock[] = [];
  let bulletBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length) {
      blocks.push({
        id: generateBlockId(),
        type: 'bullet',
        content: '',
        items: [...bulletBuffer]
      });
      bulletBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      continue;
    }

    // Handle headings
    if (trimmed.startsWith('### ')) {
      flushBullets();
      blocks.push({
        id: generateBlockId(),
        type: 'heading',
        level: 3,
        content: trimmed.slice(4).trim()
      });
    } else if (trimmed.startsWith('## ')) {
      flushBullets();
      blocks.push({
        id: generateBlockId(),
        type: 'heading',
        level: 2,
        content: trimmed.slice(3).trim()
      });
    } else if (trimmed.startsWith('# ')) {
      flushBullets();
      blocks.push({
        id: generateBlockId(),
        type: 'heading',
        level: 1,
        content: trimmed.slice(2).trim()
      });
    } 
    // Handle bullet points
    else if (trimmed.startsWith('- ')) {
      bulletBuffer.push(trimmed.slice(2).trim());
    }
    // Handle everything else as paragraphs
    else {
      flushBullets();
      blocks.push({
        id: generateBlockId(),
        type: 'paragraph',
        content: trimmed
      });
    }
  }

  // Flush any remaining bullets
  flushBullets();

  return blocks;
}