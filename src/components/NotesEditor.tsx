import React from 'react';
import { FileText, Download } from 'lucide-react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  CodeMirrorEditor,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertThematicBreak,
  InsertCodeBlock,
  ConditionalContents,
  ChangeCodeMirrorLanguage,
  codeMirrorPlugin,
  codeBlockPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  diffSourcePlugin,
  frontmatterPlugin,
  directivesPlugin,
  AdmonitionDirectiveDescriptor,
  InsertAdmonition,
} from '@mdxeditor/editor';

interface NotesEditorProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  onExport: (format: 'pdf' | 'docx') => void;
}

export default function NotesEditor({ notes, onNotesChange, onExport }: NotesEditorProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center">
          <FileText className="w-5 h-5 text-gray-500 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Generated Notes</h3>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onExport('pdf')}
            className="flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Download className="w-4 h-4 mr-1.5" />
            PDF
          </button>
          <button
            onClick={() => onExport('docx')}
            className="flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Download className="w-4 h-4 mr-1.5" />
            DOCX
          </button>
        </div>
      </div>
      <div className="p-6">
        <div className="prose prose-slate max-w-none">
          <MDXEditor
            markdown={notes}
            onChange={onNotesChange}
            plugins={[
              headingsPlugin(),
              listsPlugin(),
              quotePlugin(),
              thematicBreakPlugin(),
              markdownShortcutPlugin(),
              codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
              codeMirrorPlugin({ codeBlockLanguages: { txt: 'Plain Text', js: 'JavaScript' } }),
              linkPlugin(),
              linkDialogPlugin(),
              imagePlugin(),
              tablePlugin(),
              frontmatterPlugin(),
              directivesPlugin({ directiveDescriptors: [AdmonitionDirectiveDescriptor] }),
              toolbarPlugin({
                toolbarContents: () => (
                  <div className="flex flex-wrap gap-2">
                    <UndoRedo />
                    <BoldItalicUnderlineToggles />
                    <BlockTypeSelect />
                    <CreateLink />
                    <InsertThematicBreak />
                    <InsertCodeBlock />
                    <InsertAdmonition />
                  </div>
                )
              })
            ]}
            contentEditableClassName="min-h-[500px] text-[16px] sm:text-[18px] leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}