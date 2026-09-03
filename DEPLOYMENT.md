# LegalNote - Deployment Configuration

## Health Check Endpoint

The application provides a dedicated health check endpoint for the deployment platform:

- **Endpoint**: `GET /health` - Returns `{ status: 'ok', service: 'LegalNote', timestamp: '...' }`

This endpoint:
- Responds quickly (under 5 seconds)
- Returns HTTP 200 status
- Works without authentication
- Accepts requests without origin headers (for deployment platform health checks)

Note: The root path `/` serves the frontend application, not a health check.

## CORS Configuration

The CORS middleware is configured to:

1. **Allow requests without origin headers** - Health checks from deployment platforms don't send origin headers
2. **Allow Replit domains** - `*.replit.dev` and `*.replit.app` 
3. **Support custom domains** - Set via `ALLOWED_ORIGINS` environment variable

### Setting Up Custom Domains

In your deployment secrets, set:

```
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Multiple domains should be comma-separated.

## Required Environment Variables

For production deployment, ensure these are set in Deployment secrets:

### Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Strong random string (32+ characters)
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` - Object storage bucket ID

### Required for document production (Meeting-to-Matter™ / Bedrock):
- `PRIVILEGED_LLM_PROVIDER` - Must be `bedrock` (privileged client data must not use other LLM providers)
- `BEDROCK_PRIVILEGED_MODEL_ID` - EU inference profile ID, e.g. `eu.anthropic.claude-sonnet-4-6`
- `BEDROCK_REQUEST_TIMEOUT_MS` - optional Bedrock request timeout; defaults to 900000 (15 minutes) for long legal-document generation
- `AWS_REGION` - Must start with `eu-` (e.g. `eu-west-2`)
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - IAM credentials with Bedrock Converse access in that region

The same IAM user/role must also allow voice TTS:

```json
{
  "Effect": "Allow",
  "Action": ["polly:SynthesizeSpeech"],
  "Resource": "*"
}
```

Optional:
- `VOICE_TTS_POLLY_VOICE` - Polly en-GB voice (`Amy` default generative, or `Brian`; `Emma` / `Arthur` use neural)
- `VOICE_TTS_POLLY_ENGINE` - `generative` (default, most natural), `neural`, or `standard`

Without Polly permissions the client falls back to the browser’s robotic system voice.

If `PRIVILEGED_LLM_PROVIDER` is unset, retries fail with:  
`PRIVILEGED_LLM_PROVIDER must be "bedrock"; got "(unset)"`

### Optional:
- `ALLOWED_ORIGINS` - Custom domain(s) for CORS (comma-separated)
- `NODE_ENV` - Set to `production` (usually automatic)
- `PORT` - Server port (default: 5000, usually automatic)
- `APP_URL` - Canonical public URL (e.g. `https://legalnote.ai`) for OAuth redirects and share links

### Microsoft / Outlook Calendar OAuth

Calendar integration uses the same Azure app as Microsoft login unless separate vars are set:

| Variable | Purpose |
|----------|---------|
| `MICROSOFT_CLIENT_ID` | Azure app client ID for calendar (falls back to `MICROSOFT_LOGIN_CLIENT_ID`) |
| `MICROSOFT_CLIENT_SECRET` | Azure client secret **Value** (falls back to `MICROSOFT_LOGIN_CLIENT_SECRET`) |
| `MICROSOFT_TENANT_ID` | Azure tenant ID (default: `common`) |

**Common mistake:** Setting the secret to the Azure **Secret ID** (a UUID like `550e8400-e29b-41d4-a716-446655440000`) instead of the **Value** shown once when creating the secret. This causes `AADSTS7000215: Invalid client secret provided`.

**Fix:**
1. Azure Portal → App registrations → your app → **Certificates & secrets**
2. Create a new client secret and copy the **Value** column immediately
3. Set `MICROSOFT_CLIENT_SECRET` (or `MICROSOFT_LOGIN_CLIENT_SECRET`) to that Value in deployment secrets
4. Redeploy the application

**Azure redirect URI required:** `https://your-domain.com/api/calendar/callback/outlook`

**API permissions:** `Calendars.ReadWrite`, `User.Read`, `offline_access` (admin consent may be required)

## Production vs Development Behavior

### Development (NODE_ENV=development):
- Vite dev server serves frontend
- Health checks return HTML (Vite catches all routes)
- Full error details in responses
- Relaxed security headers

### Production (NODE_ENV=production):
- Static files served from `dist/`
- Health checks return JSON correctly
- Sanitized error messages
- Strict security headers (CSP, HSTS)

## Troubleshooting

### Health Check Failing
- Ensure health check endpoint returns within 5 seconds
- Verify CORS allows requests without origin headers ✓
- Check that `/health` or `/` returns HTTP 200 ✓

### CORS Errors in Production
- Set `ALLOWED_ORIGINS` environment variable with your production domain(s)
- Ensure domains include protocol (https://)
- Verify no trailing slashes in domain URLs

### Environment Variable Issues
- Application validates required variables at startup
- Check logs for "Environment validation failed" errors
- Ensure `SESSION_SECRET` is 32+ characters in production

## Manual database migrations

Run these on Neon when deploying schema changes that are not applied by `drizzle-kit push`:

- `scripts/display-name-confirmed-at.sql` — adds `users.display_name_confirmed_at` so display names can be confirmed once and locked against OAuth overwrites
- `scripts/integrations-onboarding-pref.sql` — integrations onboarding preference flag
- `scripts/meeting-reminder-columns.sql` — adds `scheduled_meetings.reminder_30m_sent_at` / `reminder_10m_sent_at` (required after meeting-reminder deploy; without these, Upcoming Meetings fails to load)
- `scripts/evaluation-starts-at.sql` — adds `firms.evaluation_starts_at` for governed evaluation configuration date
- `scripts/firm-billing.sql` — firm Stripe subscription columns for Boutique conversion
