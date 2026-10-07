/** TipTap getHTML() output. Markdown notes do not start with a block tag. */
export function isEditorHtml(content: string | null | undefined): boolean {
  return /^\s*<(?:p|h[1-6]|ul|ol|div|blockquote|table|ins|del)\b/i.test(content ?? "");
}

/**
 * Undo autolinks of "Name.No" style fragments. TipTap's linker treats the
 * Norway TLD as a URL, so "Jen.No" becomes a link and later edits can leave
 * only "No" visible while "Jen" survives in the href.
 */
export function repairNameAutolinks(html: string): string {
  return html.replace(/<a\b([^>]*)>([^<]*)<\/a>/gi, (full, attrs: string, text: string) => {
    const hrefMatch = String(attrs).match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    const href = hrefMatch?.[1] ?? hrefMatch?.[2];
    if (!href) return full;
    // Keep the href's own casing. URL.hostname lowercases it, which would hide "Jen".
    const hostMatch = href.match(/^https?:\/\/([A-Za-z][A-Za-z'-]{0,30})\.([A-Za-z]{2,12})\/?$/);
    if (!hostMatch) return full;
    const name = hostMatch[1];
    const tld = hostMatch[2];
    if (!/^[A-Z][a-zA-Z'-]{1,30}$/.test(name)) return full;
    const label = text.replace(/\s+/g, " ").trim();
    const domain = `${name}.${tld}`;
    if (label.toLowerCase() === tld.toLowerCase() || label.toLowerCase() === domain.toLowerCase()) {
      return `${name}. ${tld}`;
    }
    return full;
  });
}
