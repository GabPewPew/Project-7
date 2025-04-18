import Handlebars from 'handlebars';

// Register Handlebars helpers for card templates
Handlebars.registerHelper('isEmpty', function(value) {
  return !value || value.length === 0;
});

Handlebars.registerHelper('isNotEmpty', function(value) {
  return value && value.length > 0;
});

Handlebars.registerHelper('or', function() {
  return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
});

Handlebars.registerHelper('and', function() {
  return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
});

// Cloze helpers
Handlebars.registerHelper('cloze', function(text, index) {
  if (!text) return '';
  
  // Parse cloze deletions in format {{c1::text}} or {{c1::text::hint}}
  const clozeRegex = /{{c(\d+)::([^:}]+)(?:::([^}]+))?}}/g;
  
  // Replace with spans for easy styling
  if (index) {
    // Replace specific index with span
    return new Handlebars.SafeString(
      text.replace(clozeRegex, function(match, clozeIndex, content, hint) {
        if (parseInt(clozeIndex) === parseInt(index)) {
          return `<span class="cloze">[${hint || '...'}]</span>`;
        }
        return content;
      })
    );
  } else {
    // Show all clozes in full
    return new Handlebars.SafeString(
      text.replace(clozeRegex, function(match, clozeIndex, content, hint) {
        return content;
      })
    );
  }
});

Handlebars.registerHelper('reveal', function(text) {
  if (!text) return '';
  
  // Parse cloze deletions and replace with spans
  const clozeRegex = /{{c(\d+)::([^:}]+)(?:::([^}]+))?}}/g;
  
  return new Handlebars.SafeString(
    text.replace(clozeRegex, function(match, clozeIndex, content, hint) {
      return `<span class="cloze-revealed">${content}</span>`;
    })
  );
});

/**
 * Renders a card template with field values
 * @param {string} template - The Handlebars template string
 * @param {Object} fieldValues - Object with field name/value pairs
 * @returns {string} - Rendered HTML
 */
export function renderTemplate(template, fieldValues) {
  try {
    const compiledTemplate = Handlebars.compile(template);
    
    // If fieldValues is a JSON string, parse it
    const fields = typeof fieldValues === 'string' 
      ? JSON.parse(fieldValues) 
      : fieldValues;
    
    return compiledTemplate(fields);
  } catch (error) {
    console.error('Error rendering template:', error);
    return `<div class="error">Error rendering template: ${error.message}</div>`;
  }
}

/**
 * Generates card content from a note and its template
 * @param {Object} note - The note object with fieldValues
 * @param {Object} cardTemplate - The card template with frontTemplate and backTemplate
 * @returns {Object} - Object with rendered front and back HTML
 */
export function generateCardContent(note, cardTemplate) {
  const { frontTemplate, backTemplate } = cardTemplate;
  const fieldValues = typeof note.fieldValues === 'string' 
    ? JSON.parse(note.fieldValues) 
    : note.fieldValues;
  
  const frontHtml = renderTemplate(frontTemplate, fieldValues);
  const backHtml = renderTemplate(backTemplate, fieldValues);
  
  return {
    frontContent: frontHtml,
    backContent: backHtml
  };
} 