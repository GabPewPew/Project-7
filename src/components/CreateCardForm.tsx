import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface NoteType {
  id: string;
  name: string;
  fields: string; // JSON string to be parsed
}

interface CreateCardFormProps {
  sourceDocumentId?: string;
  pageNumber?: number;
  sourceText?: string;
  front?: string;
  back?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CreateCardForm({
  sourceDocumentId,
  pageNumber,
  sourceText,
  front = '',
  back = '',
  onSuccess,
  onCancel
}: CreateCardFormProps) {
  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [selectedNoteTypeId, setSelectedNoteTypeId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({
    Front: front,
    Back: back,
    SourceText: sourceText || '',
    PageNumber: pageNumber?.toString() || '',
    SourceDocumentId: sourceDocumentId || ''
  });
  
  // Fetch note types on component mount
  useEffect(() => {
    const initializeDefaultNoteType = async () => {
      try {
        // Ensure default note type exists (consider moving this to app startup)
        await axios.post('/api/note-types/default');
        setNoteTypes(sampleNoteTypes); // Replace with actual types from response if needed
        
        setSelectedNoteTypeId(sampleNoteTypes[0].id);
      } catch (error) {
        console.error('Error initializing default note type:', error);
        setError('Failed to initialize default note type. Please try again.');
      }
    };
    
    initializeDefaultNoteType();
  }, []);
  
  // Update field values when props change
  useEffect(() => {
    setFieldValues(prev => ({
      ...prev,
      Front: front || prev.Front,
      Back: back || prev.Back,
      SourceText: sourceText || prev.SourceText,
      PageNumber: pageNumber?.toString() || prev.PageNumber,
      SourceDocumentId: sourceDocumentId || prev.SourceDocumentId
    }));
  }, [front, back, sourceText, pageNumber, sourceDocumentId]);
  
  const handleFieldChange = (field: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedNoteTypeId) {
      setError('Please select a note type.');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.post('/api/notes', {
        noteTypeId: selectedNoteTypeId,
        fieldValues: fieldValues
      });
      
      setIsLoading(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating note:', error);
      setError('Failed to create note. Please try again.');
      setIsLoading(false);
    }
  };
  
  // Parse fields from the selected note type
  const fields = selectedNoteTypeId && noteTypes.length > 0
    ? JSON.parse(noteTypes.find(nt => nt.id === selectedNoteTypeId)?.fields || '[]')
    : [];
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">Create Flashcard</h2>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Note Type
          </label>
          <select
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={selectedNoteTypeId}
            onChange={(e) => setSelectedNoteTypeId(e.target.value)}
            disabled={noteTypes.length <= 1}
          >
            {noteTypes.length === 0 ? (
              <option value="">Loading note types...</option>
            ) : (
              noteTypes.map(noteType => (
                <option key={noteType.id} value={noteType.id}>
                  {noteType.name}
                </option>
              ))
            )}
          </select>
        </div>
        
        {fields.map((field: string) => (
          <div key={field} className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              {field}
            </label>
            {field === 'SourceText' ? (
              <textarea
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                rows={4}
                value={fieldValues[field] || ''}
                onChange={(e) => handleFieldChange(field, e.target.value)}
              />
            ) : (
              <input
                type="text"
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                value={fieldValues[field] || ''}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                readOnly={field === 'SourceDocumentId' || field === 'PageNumber'}
              />
            )}
          </div>
        ))}
        
        <div className="flex justify-end space-x-2">
          {onCancel && (
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Card'}
          </button>
        </div>
      </form>
    </div>
  );
} 