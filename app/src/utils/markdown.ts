// Minimal, safe Markdown → HTML renderer for the AI Advisor response.
//
// The AI returns GitHub-flavored Markdown restricted to headings, bold, lists,
// paragraphs, and inline code (see the system prompt in advisor-prompt.ts). We
// render only that subset. Every piece of model text is HTML-escaped BEFORE any
// tag is introduced, so a response can never inject markup — no dependency, no
// dangerouslySetInnerHTML of raw model output.

/** Escape the five HTML-significant characters. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Apply inline formatting (bold, inline code) to already-escaped text. */
function renderInline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code class="md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/**
 * Render a restricted Markdown subset to sanitized HTML.
 * Supports: ##/### headings, - and * bullets, 1. numbered lists, paragraphs.
 */
export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];

  let listType: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${renderInline(escapeHtml(paragraph.join(' ')))}</p>`);
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Blank line — paragraph/list break.
    if (line.trim() === '') {
      flushParagraph();
      closeList();
      continue;
    }

    // Headings.
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length; // 2, 3, or 4
      const content = renderInline(escapeHtml(heading[2].trim()));
      html.push(`<h${level} class="md-h${level}">${content}</h${level}>`);
      continue;
    }

    // Unordered list item.
    const bullet = /^[-*]\s+(.*)$/.exec(line.trim());
    if (bullet) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        html.push('<ul class="md-ul">');
        listType = 'ul';
      }
      html.push(`<li>${renderInline(escapeHtml(bullet[1].trim()))}</li>`);
      continue;
    }

    // Ordered list item.
    const numbered = /^\d+\.\s+(.*)$/.exec(line.trim());
    if (numbered) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        html.push('<ol class="md-ol">');
        listType = 'ol';
      }
      html.push(`<li>${renderInline(escapeHtml(numbered[1].trim()))}</li>`);
      continue;
    }

    // Blockquote (used for the interrupted-stream marker).
    const quote = /^>\s?(.*)$/.exec(line.trim());
    if (quote) {
      flushParagraph();
      closeList();
      html.push(
        `<blockquote class="md-quote">${renderInline(escapeHtml(quote[1].trim()))}</blockquote>`
      );
      continue;
    }

    // Otherwise, accumulate into the current paragraph.
    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();
  return html.join('\n');
}
