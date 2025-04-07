import React from 'react';
import { CheckCircle, Target, BookOpen, AlertCircle } from 'lucide-react';

interface MarkdownNode {
  type: string;
  content: string | MarkdownNode[];
  level?: number;
}

function parseMarkdown(markdown: string): MarkdownNode[] {
  const lines = markdown.split('\n');
  const nodes: MarkdownNode[] = [];
  let currentList: MarkdownNode[] = [];
  let inList = false;

  for (const line of lines) {
    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inList) {
        nodes.push({ type: 'list', content: currentList });
        currentList = [];
        inList = false;
      }
      nodes.push({
        type: 'heading',
        level: headingMatch[1].length,
        content: headingMatch[2].trim()
      });
      continue;
    }

    // Lists
    const listMatch = line.match(/^[-*•]\s+(.+)$/);
    if (listMatch) {
      if (!inList) {
        inList = true;
        currentList = [];
      }
      currentList.push({
        type: 'listItem',
        content: listMatch[1].trim()
      });
      continue;
    }

    // End list if we're not in a list item
    if (inList && line.trim() !== '') {
      nodes.push({ type: 'list', content: currentList });
      currentList = [];
      inList = false;
    }

    // Paragraphs
    if (line.trim() !== '') {
      nodes.push({
        type: 'paragraph',
        content: line.trim()
      });
    }
  }

  // Add any remaining list
  if (inList && currentList.length > 0) {
    nodes.push({ type: 'list', content: currentList });
  }

  return nodes;
}

function renderNode(node: MarkdownNode, index: number): React.ReactNode {
  switch (node.type) {
    case 'heading':
      const HeadingTag = `h${node.level}` as keyof JSX.IntrinsicElements;
      const isSpecialSection = typeof node.content === 'string' && (
        node.content.toLowerCase().includes('conclusion') ||
        node.content.toLowerCase().includes('learning objectives') ||
        node.content.toLowerCase().includes('key points') ||
        node.content.toLowerCase().includes('important')
      );

      if (isSpecialSection) {
        const Icon = node.content.toLowerCase().includes('conclusion') ? CheckCircle :
                    node.content.toLowerCase().includes('learning objectives') ? Target :
                    node.content.toLowerCase().includes('key points') ? BookOpen :
                    AlertCircle;

        return (
          <div key={index} className="my-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-gray-900">
              <Icon className="w-5 h-5 text-blue-600" />
              <HeadingTag className="font-semibold m-0">
                {typeof node.content === 'string' ? node.content : ''}
              </HeadingTag>
            </div>
          </div>
        );
      }

      return (
        <HeadingTag key={index} className="font-semibold mt-6 mb-4 text-gray-900">
          {typeof node.content === 'string' ? node.content : ''}
        </HeadingTag>
      );

    case 'paragraph':
      return (
        <p key={index} className="my-4 text-gray-700 leading-relaxed">
          {typeof node.content === 'string' ? node.content : ''}
        </p>
      );

    case 'list':
      return (
        <ul key={index} className="my-4 space-y-2">
          {Array.isArray(node.content) && node.content.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-700">
              <span className="mt-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0" />
              <span>{typeof item.content === 'string' ? item.content : ''}</span>
            </li>
          ))}
        </ul>
      );

    default:
      return null;
  }
}

export function renderMarkdownToJSX(markdown: string): React.ReactNode[] {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const nodes = parseMarkdown(markdown);
  return nodes.map((node, index) => renderNode(node, index));
}