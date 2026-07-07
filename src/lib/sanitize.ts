import DOMPurify from "dompurify";

/**
 * HTML sanitization helper (Audit Fix #10 / P2).
 *
 * Use this EVERYWHERE we inject user-provided HTML into the DOM via
 * `dangerouslySetInnerHTML`. Without sanitization, an admin-compromised
 * account (or a stored-XSS payload) could execute arbitrary JS in other
 * admins' browsers.
 *
 * Default config:
 *   - strips <script>, <iframe>, <object>, <embed>, on* attributes
 *   - allows safe formatting tags (p, b, i, ul, ol, li, a, br, strong, em)
 *   - allows inline styles via `style` attr (Tailwind prose relies on them)
 *   - forces `target="_blank" rel="noopener noreferrer"` on links
 *
 * Usage:
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(template) }} />
 */

const ALLOWED_TAGS = [
  "p", "br", "b", "i", "strong", "em", "u", "s",
  "ul", "ol", "li",
  "a", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "blockquote", "pre", "code",
  "img",
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = [
  "href", "title", "alt", "src", "width", "height",
  "style", "class", "id", "target", "rel",
];

const sanitized = DOMPurify();

sanitized.setConfig({
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "style"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
});

// Force safe links.
sanitized.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer nofollow");
  }
});

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return sanitized.sanitize(dirty, {
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
  }) as string;
}

export default sanitizeHtml;
