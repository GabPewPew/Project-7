import React, { useEffect, useRef, useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  InsertThematicBreak,
  InsertImage,
  MDXEditorMethods,
  codeBlockPlugin,
  imagePlugin,
  tablePlugin,
  frontmatterPlugin,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
} from '@mdxeditor/editor';

interface NotesEditorProps {
  notes: string;
  images?: Array<{ url: string; caption?: string }>;
  onNotesChange: (notes: string) => void;
  onExport: (format: 'pdf' | 'docx') => void;
  isLoading?: boolean;
}

const CustomToolbar = () => (
  <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap px-4 py-3 border-b border-gray-200 bg-white">
    <div className="flex items-center gap-2">
      <UndoRedo />
    </div>

    <div className="h-6 w-px bg-gray-200" />
    
    <div className="flex items-center gap-2">
      <BoldItalicUnderlineToggles />
    </div>

    <div className="h-6 w-px bg-gray-200" />

    <div className="flex-shrink-0">
      <BlockTypeSelect />
    </div>

    <div className="h-6 w-px bg-gray-200" />

    <div className="flex items-center gap-2">
      <ListsToggle />
      <CreateLink />
      <InsertImage />
      <InsertThematicBreak />
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500">
    <FileText className="w-12 h-12 mb-4" />
    <p className="text-lg font-medium">No notes generated yet</p>
    <p className="text-sm">Click "Generate Notes" to get started</p>
  </div>
);

export default function NotesEditor({ notes, images, onNotesChange, onExport, isLoading }: NotesEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null);
  const [localContent, setLocalContent] = useState<string>('');

  useEffect(() => {
    if (notes?.trim()) {
      const processedContent = processNotesWithImages(notes);
      setLocalContent(processedContent);
      
      // Force editor update when content changes
      if (editorRef.current) {
        editorRef.current.setMarkdown(processedContent);
      }
    }
  }, [notes, images]);

  const processNotesWithImages = (markdown: string): string => {
    if (!images || images.length === 0) return markdown;

    let processedMarkdown = markdown;
    const sections = processedMarkdown.split(/(?=^#{1,6}\s)/m);
    let imageIndex = 0;

    processedMarkdown = sections.map(section => {
      const shouldAddImage = imageIndex < images.length && (
        section.toLowerCase().includes('figure') ||
        section.toLowerCase().includes('diagram') ||
        section.toLowerCase().includes('illustration') ||
        /^#{1,3}\s+(overview|introduction|summary|conclusion)/i.test(section)
      );

      if (shouldAddImage) {
        const image = images[imageIndex++];
        return `${section.trim()}\n\n![${image.caption || `Figure ${imageIndex}`}](${image.url})\n`;
      }
      return section;
    }).join('\n\n');

    while (imageIndex < images.length) {
      const image = images[imageIndex++];
      if (image.caption && !processedMarkdown.includes(image.url)) {
        processedMarkdown += `\n\n![${image.caption}](${image.url})\n`;
      }
    }

    return processedMarkdown;
  };

  const handleEditorChange = (content: string) => {
    setLocalContent(content);
    onNotesChange(content);
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Generated Notes</h3>
        </div>
        <div className="flex gap-x-2">
          <button
            onClick={() => onExport('pdf')}
            disabled={!localContent || isLoading}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 
                     rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 mr-1.5" />
            PDF
          </button>
          <button
            onClick={() => onExport('docx')}
            disabled={!localContent || isLoading}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 
                     rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4 mr-1.5" />
            DOCX
          </button>
        </div>
      </div>

      <div className="relative">
        {isLoading ? (
          <LoadingSpinner />
        ) : !localContent ? (
          <EmptyState />
        ) : (
          <MDXEditor
            ref={editorRef}
            markdown={localContent}
            onChange={handleEditorChange}
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
              imagePlugin(),
              tablePlugin(),
              frontmatterPlugin(),
              toolbarPlugin({
                toolbarContents: () => <CustomToolbar />
              })
            ]}
            contentEditableClassName="prose prose-slate max-w-none min-h-[500px] text-base leading-relaxed px-6 py-4"
          />
        )}
      </div>
    </div>
  );
}