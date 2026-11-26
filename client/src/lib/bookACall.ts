/**
 * Where every "Book a call" button sends a prospect: LegalNote's own booking
 * page, legalnote.ai/talk. If that page can't offer times it shows a backup
 * booking link and an email option itself, so buttons never need to change.
 */
export const BOOK_A_CALL_URL = "/talk";

const isInternal = (url: string) => url.startsWith("/");

/** Link props for an <a>: the same tab for our own page, a new tab for anything else. */
export function bookACallLinkProps(source?: string): { href: string; target?: string; rel?: string } {
  const href = source && isInternal(BOOK_A_CALL_URL) ? `${BOOK_A_CALL_URL}?src=${encodeURIComponent(source)}` : BOOK_A_CALL_URL;
  return isInternal(BOOK_A_CALL_URL) ? { href } : { href, target: "_blank", rel: "noopener noreferrer" };
}

export function openBookACall(source?: string): void {
  const { href, target } = bookACallLinkProps(source);
  if (target) window.open(href, target, "noopener,noreferrer");
  else window.location.href = href;
}
