# LegalNote Cookie Policy

**Last Updated:** July 2026  
**Company:** LegalNote Technologies Ltd (registered in England and Wales, No. 16788981)  
**Status:** Requires legal counsel review before publication  

---

## 1. Introduction

This Cookie Policy explains how LegalNote Technologies Ltd ("LegalNote", "we", "us", "our") uses cookies and similar technologies on legalnote.ai and the LegalNote application.

## 2. What are cookies?

Cookies are small text files stored on your device when you visit a website. They help the Service authenticate you and remember limited interface preferences.

## 3. Cookies we use

### 3.1 Strictly necessary cookies

These cookies are required for the Service to function and cannot be disabled if you wish to use authenticated features.

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `connect.sid` | Server-side session identifier (express-session with a Postgres session store). Authenticates your logged-in session after Google or Microsoft sign-in. | Approximately 4 hours (aligned to session lifetime) |

In production this cookie is set httpOnly, sameSite lax, and secure.

### 3.2 Functional cookies

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `sidebar_state` | Remembers whether the in-app sidebar is open or collapsed. | Persistent (long max-age set by the client UI) |

### 3.3 Cookies we do not use

- We do not set analytics cookies (no Google Analytics, PostHog, Mixpanel or similar in the application).
- We do not use marketing or advertising cookies.
- We do not set a separate CSRF cookie in current code.
- Theme and many UI preferences are stored in local or session storage, not cookies.

### 3.4 Local storage (not cookies)

The application may store non-cookie data in browser storage, for example UI drafts or preferences. This is limited to operating the product and is not used for cross-site advertising.

## 4. Third-party cookies and related technologies

When you use certain features, third parties may process data or set their own cookies on their domains:

| Service | When it appears | More information |
|---------|-----------------|------------------|
| Google | Sign-in, and optional Google Calendar | [policies.google.com/privacy](https://policies.google.com/privacy) |
| Microsoft | Sign-in, and optional Outlook or SharePoint | [privacy.microsoft.com](https://privacy.microsoft.com) |
| Stripe | Checkout and billing | [stripe.com/privacy](https://stripe.com/privacy) |

OAuth providers may set cookies on their own domains during sign-in. LegalNote does not control those cookies.

## 5. Managing cookies

You can view, delete or block cookies in your browser settings. Blocking `connect.sid` will prevent you from remaining signed in, and authenticated use of LegalNote will not work.

## 6. Do Not Track

LegalNote does not currently alter its behaviour in response to "Do Not Track" signals. We do not operate third-party advertising trackers in the application.

## 7. Changes to this policy

We may update this Cookie Policy from time to time. Changes will be posted with an updated "last updated" date.

## 8. Contact us

Email: privacy@legalnote.ai.

LegalNote Technologies Ltd, 71–75 Shelton Street, Covent Garden, London WC2H 9JQ, United Kingdom.

*This Cookie Policy is governed by the laws of England and Wales. It reflects cookies actually set by LegalNote application code as of July 2026 and is not legal advice.*
