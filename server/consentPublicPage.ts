/**
 * Public /consent/:token HTML — LegalNote branded, minimal Consent / Decline.
 * No matter titles or client identifiers in the page body.
 */

import { legalNoteEmailWordmarkLightUrl } from './email';

/** Change when the page's CSS or JS changes, so browsers don't keep an old copy. */
const ASSET_VERSION = "1";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageShell(opts: { title: string; body: string; script?: boolean }): string {
  // Styles and scripts are separate files: the production security policy blocks inline ones.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(opts.title)}</title>
  <link rel="icon" href="/favicon.ico">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&display=swap">
  <link rel="stylesheet" href="/assets/consent/consent-page.css?v=${ASSET_VERSION}">
</head>
<body>
  <main class="wrap">
    <div class="brand">
      <img src="${escapeHtml(legalNoteEmailWordmarkLightUrl())}" alt="LegalNote" width="200" height="62">
      <div class="brand-tagline">Meeting to Matter</div>
    </div>
    <div class="card">
      ${opts.body}
    </div>
    <p class="footer">LegalNote · Meeting to Matter</p>
  </main>${opts.script ? `\n  <script src="/assets/consent/consent-page.js?v=${ASSET_VERSION}"></script>` : ""}
</body>
</html>`;
}

export function renderConsentNotFoundPage(): string {
  return pageShell({
    title: "Consent not found",
    body: `
      <h1>Link not found</h1>
      <p>This consent link is invalid or has been removed. Please contact the person who sent this link if you still need to respond.</p>
    `,
  });
}

export function renderConsentAlreadyRespondedPage(statusLabel: string, respondedAt: string): string {
  return pageShell({
    title: "Response recorded",
    body: `
      <h1>Already recorded</h1>
      <p>Your response (<strong>${escapeHtml(statusLabel)}</strong>) was saved on ${escapeHtml(respondedAt)}.</p>
    `,
  });
}

export function renderConsentExpiredPage(senderPhrase = "the person who sent this link"): string {
  return pageShell({
    title: "Consent expired",
    body: `
      <h1>This link has expired</h1>
      <p>Please contact ${escapeHtml(senderPhrase)} if you still need to give or decline recording consent.</p>
    `,
  });
}

export function renderConsentDecisionPage(token: string, senderName = "The person who sent this"): string {
  const safeToken = escapeHtml(token);
  return pageShell({
    title: "Recording consent",
    script: true,
    body: `
      <h1>Recording consent</h1>
      <p>${escapeHtml(senderName)} would like to record your meeting to prepare an attendance note, a written record of what was discussed. Audio is kept confidential and deleted within 7 days.</p>
      <p>Please choose one option below.</p>
      <div class="actions" id="actions" data-token="${safeToken}">
        <button type="button" class="btn-primary" data-response="granted" data-testid="button-grant-consent">I consent</button>
        <button type="button" class="btn-secondary" data-response="declined" data-testid="button-confirm-decline">Decline recording</button>
      </div>
      <div class="status" id="status" role="status"></div>
    `,
  });
}
