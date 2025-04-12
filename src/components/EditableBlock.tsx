import React, { useState, useRef, useEffect } from 'react';
import { NoteBlock } from '../types';
import { CheckCircle, Target, BookOpen, AlertCircle } from 'lucide-react';

interface EditableBlockProps {
  block: NoteBlock;
  onChange: (updatedBlock: NoteBlock) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export function EditableBlock({ block, onChange, onKeyDown }: EditableBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [originalContent, setOriginalContent] = useState(
    block.type === 'bullet' ? block.items?.[0] || '' : block.content || ''
  );
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.textContent = 
        block.type === 'bullet' ? block.items?.[0] || '' : block.content || '';
    }
  }, [block]);

  const handleFocus = () => {
    setIsEditing(true);
    setOriginalContent(
      block.type === 'bullet' ? block.items?.[0] || '' : block.content || ''
    );
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (contentRef.current) {
      const newContent = contentRef.current.textContent || '';
      
      // Only trigger onChange if content actually changed
      if (newContent !== originalContent) {
        if (block.type === 'bullet') {
          onChange({ ...block, items: [newContent] });
        } else {
          onChange({ ...block, content: newContent });
        }
      }
    }
  };

  const commonStyles = "outline-none px-1.5 py-0.5 transition-colors duration-100";

  const isSpecialHeading = block.type === 'heading' && (
    block.content.toLowerCase().includes('conclusion') ||
    block.content.toLowerCase().includes('learning objectives') ||
    block.content.toLowerCase().includes('key points') ||
    block.content.toLowerCase().includes('important')
  );

  if (block.type === 'heading') {
    if (isSpecialHeading) {
      const Icon = block.content.toLowerCase().includes('conclusion') ? CheckCircle :
                  block.content.toLowerCase().includes('learning objectives') ? Target :
                  block.content.toLowerCase().includes('key points') ? BookOpen :
                  AlertCircle;

      return (
        <div className="my-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 text-gray-900">
            <Icon className="w-5 h-5 text-blue-600" />
            <div
              ref={contentRef}
              contentEditable
              onBlur={handleBlur}
              onKeyDown={onKeyDown}
              onFocus={handleFocus}
              className={`font-semibold m-0 ${commonStyles}`}
              suppressContentEditableWarning
            >
              {block.content}
            </div>
          </div>
        </div>
      );
    }

    const HeadingTag = `h${block.level}` as keyof JSX.IntrinsicElements;
    return (
      <HeadingTag
        className={`font-semibold text-gray-900 ${
          block.level === 1 ? 'text-3xl mb-6' :
          block.level === 2 ? 'text-2xl mb-4' :
          'text-xl mb-3'
        }`}
      >
        <div
          ref={contentRef}
          contentEditable
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          onFocus={handleFocus}
          className={commonStyles}
          suppressContentEditableWarning
        >
          {block.content}
        </div>
      </HeadingTag>
    );
  }

  if (block.type === 'paragraph') {
    return (
      <div
        ref={contentRef}
        contentEditable
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        onFocus={handleFocus}
        className={`text-gray-700 leading-relaxed mb-4 ${commonStyles}`}
        suppressContentEditableWarning
      >
        {block.content}
      </div>
    );
  }

  if (block.type === 'bullet' && block.items) {
    return (
      <ul className="space-y-2 mb-4">
        {block.items.map((item, index) => (
          <li key={`${block.id}-${index}`} className="flex items-start gap-2 text-gray-700">
            <span className="mt-1.5 w-1.5 h-1.5 bg-gray-400 rounded-full flex-shrink-0" />
            <div
              ref={contentRef}
              contentEditable
              onBlur={handleBlur}
              onKeyDown={onKeyDown}
              onFocus={handleFocus}
              className={`flex-1 ${commonStyles}`}
              suppressContentEditableWarning
            >
              {item}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}