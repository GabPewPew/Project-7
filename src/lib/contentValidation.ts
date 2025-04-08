import { SavedNote } from '../types';

export function isDuplicateContent(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.trim() === b.trim();
}

export function checkForDuplicateNotes(
  newContent: string,
  savedNotes: Record<string, SavedNote>,
  currentFileName: string
): boolean {
  if (!newContent || !savedNotes || typeof newContent !== 'string') {
    console.warn('⚠️ Invalid content for duplicate check');
    return false;
  }

  for (const [noteId, note] of Object.entries(savedNotes)) {
    if (isDuplicateContent(newContent, note.content)) {
      console.warn(
        "⚠️ Duplicate note content detected between:",
        currentFileName,
        "and",
        note.fileName,
        "\nContent preview:",
        newContent.slice(0, 300)
      );
      return true;
    }
  }
  return false;
}

export function validateContent(content: string, fileName: string): boolean {
  if (!content || typeof content !== 'string') {
    console.warn(`⚠️ Invalid content for ${fileName}`);
    return false;
  }

  if (content.length < 500) {
    console.warn(`⚠️ File content too short for ${fileName} (${content.length} chars) — might cause poor Gemini response`);
    return false;
  }

  // Log content preview for debugging
  console.log(`📄 Content validation for ${fileName}:`, {
    length: content.length,
    preview: content.slice(0, 100)
  });

  return true;
}