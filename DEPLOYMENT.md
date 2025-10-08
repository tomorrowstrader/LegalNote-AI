# LegalNote AI - Deployment Configuration

## Health Check Endpoint

The application provides a dedicated health check endpoint for the deployment platform:

- **Endpoint**: `GET /health` - Returns `{ status: 'ok', service: 'LegalNote AI', timestamp: '...' }`

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

### Optional:
- `ALLOWED_ORIGINS` - Custom domain(s) for CORS (comma-separated)
- `NODE_ENV` - Set to `production` (usually automatic)
- `PORT` - Server port (default: 5000, usually automatic)

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
