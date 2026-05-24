import { marked } from 'marked';
import hljs from 'highlight.js';

// Configure marked with highlight.js syntax highlighting
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }) {
      const validLang = lang && hljs.getLanguage(lang) ? lang : null;
      const highlighted = validLang
        ? hljs.highlight(text, { language: validLang }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs${validLang ? ` language-${validLang}` : ''}">${highlighted}</code></pre>`;
    }
  }
});

/**
 * Render a markdown string to safe HTML.
 * Returns empty string for null/blank input.
 */
export function renderMarkdown(input: string | null | undefined): string {
  if (!input?.trim()) return '';
  const html = marked.parse(input) as string;
  return html;
}
