import React, { useState, useEffect, useCallback } from 'react';
import { NoteBlock } from '../types';
import { EditableBlock } from './EditableBlock';

interface NoteRendererProps {
  blocks: NoteBlock[];
  onChange?: (blocks: NoteBlock[]) => void;
}

export function NoteRenderer({ blocks, onChange }: NoteRendererProps) {
  const [localBlocks, setLocalBlocks] = useState<NoteBlock[]>([]);

  useEffect(() => {
    if (JSON.stringify(blocks) !== JSON.stringify(localBlocks)) {
      setLocalBlocks(blocks);
    }
  }, [blocks]);

  const handleBlockChange = useCallback((blockId: string, updatedBlock: NoteBlock) => {
    setLocalBlocks(prevBlocks => {
      const newBlocks = prevBlocks.map(block =>
        block.id === blockId ? { ...updatedBlock, id: block.id } : block
      );
      onChange?.(newBlocks);
      return newBlocks;
    });
  }, [onChange]);

  const handleKeyDown = useCallback((blockId: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      setLocalBlocks(prevBlocks => {
        const blockIndex = prevBlocks.findIndex(b => b.id === blockId);
        if (blockIndex === -1) return prevBlocks;

        const newBlock: NoteBlock = {
          id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          type: 'paragraph',
          content: ''
        };

        const newBlocks = [
          ...prevBlocks.slice(0, blockIndex + 1),
          newBlock,
          ...prevBlocks.slice(blockIndex + 1)
        ];

        onChange?.(newBlocks);
        return newBlocks;
      });
    }
  }, [onChange]);

  if (!blocks || !Array.isArray(blocks)) {
    console.warn('Invalid blocks input');
    return null;
  }

  return (
    <div className="prose prose-neutral max-w-none mt-6">
      {localBlocks.map(block => (
        <EditableBlock
          key={block.id}
          block={block}
          onChange={(updatedBlock) => handleBlockChange(block.id, updatedBlock)}
          onKeyDown={(e) => handleKeyDown(block.id, e)}
        />
      ))}
    </div>
  );
}