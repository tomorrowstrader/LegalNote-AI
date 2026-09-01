/**
 * Public /consent/:token HTML — LegalNote branded, minimal Consent / Decline.
 * No matter titles or client identifiers in the page body.
 */

import { legalNoteBrandMarkLightHtml } from './email';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandMark(): string {
  return legalNoteBrandMarkLightHtml();
}

function pageShell(opts: { title: string; body: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.title)}</title>
  <style>
    :root {
      --bg: #faf9f7;
      --ink: #3d3028;
      --muted: #6b5e54;
      --line: #e8e4df;
      --accent: #c97d4d;
      --black: #111111;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,125,77,0.12), transparent 55%),
        var(--bg);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      padding: 32px 20px 48px;
    }
    .wrap {
      max-width: 440px;
      margin: 0 auto;
    }
    .card {
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 28px 24px 24px;
      box-shadow: 0 8px 28px rgba(61, 48, 40, 0.06);
    }
    h1 {
      margin: 0 0 12px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 26px;
      font-weight: 400;
      line-height: 1.25;
      color: var(--ink);
      text-align: center;
    }
    p {
      margin: 0 0 14px;
      font-size: 15px;
      line-height: 1.55;
      color: var(--muted);
      text-align: center;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 24px;
    }
    button {
      appearance: none;
      width: 100%;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      padding: 14px 18px;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-primary {
      background: var(--black);
      color: #ffffff;
      border: none;
    }
    .btn-primary:hover { background: #2a2a2a; }
    .btn-secondary {
      background: transparent;
      color: var(--ink);
      border: 1px solid var(--line);
    }
    .btn-secondary:hover { background: #f3f0ec; }
    .status {
      display: none;
      margin-top: 18px;
      padding: 14px 16px;
      border-radius: 10px;
      font-size: 14px;
      line-height: 1.45;
      text-align: center;
    }
    .status.ok {
      display: block;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .status.err {
      display: block;
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 11px;
      color: #8a7d72;
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${brandMark()}
    <div class="card">
      ${opts.body}
    </div>
    <p class="footer">LegalNote · Meeting to Matter</p>
  </div>
</body>
</html>`;
}

export function renderConsentNotFoundPage(): string {
  return pageShell({
    title: "Consent not found",
    body: `
      <h1>Link not found</h1>
      <p>This consent link is invalid or has been removed. Please contact your solicitor if you still need to respond.</p>
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

export function renderConsentExpiredPage(): string {
  return pageShell({
    title: "Consent expired",
    body: `
      <h1>This link has expired</h1>
      <p>Please contact your solicitor if you still need to give or decline recording consent.</p>
    `,
  });
}

export function renderConsentDecisionPage(token: string): string {
  const safeToken = escapeHtml(token);
  return pageShell({
    title: "Recording consent",
    body: `
      <h1>Recording consent</h1>
      <p>Your solicitor would like to record your meeting to prepare accurate attendance notes. Audio is kept confidential and deleted within 7 days.</p>
      <p>Please choose one option below.</p>
      <div class="actions" id="actions">
        <button type="button" class="btn-primary" onclick="submitResponse('granted')" data-testid="button-grant-consent">I consent</button>
        <button type="button" class="btn-secondary" onclick="submitResponse('declined')" data-testid="button-confirm-decline">Decline recording</button>
      </div>
      <div class="status" id="status" role="status"></div>
      <script>
        async function submitResponse(responseType) {
          var status = document.getElementById('status');
          var actions = document.getElementById('actions');
          status.className = 'status';
          status.textContent = '';
          try {
            var response = await fetch('/api/pre-consent/acknowledge/${safeToken}', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ responseType: responseType })
            });
            var data = await response.json();
            if (response.ok) {
              actions.style.display = 'none';
              status.className = 'status ok';
              status.textContent = data.message || 'Thank you — your response has been recorded.';
            } else {
              status.className = 'status err';
              status.textContent = data.message || 'Something went wrong. Please try again.';
            }
          } catch (e) {
            status.className = 'status err';
            status.textContent = 'Something went wrong. Please try again.';
          }
        }
      </script>
    `,
  });
}
