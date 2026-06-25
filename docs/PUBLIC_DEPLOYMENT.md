# Public deployment access (Itinerary Live)

## Current status

The preview URL  
`https://trip-connect-egk99gb7m-montyhaseldens-projects.vercel.app/`  
**is not publicly accessible**. Unauthenticated visitors receive HTTP **302** to Vercel SSO:

```
location: https://vercel.com/sso-api?url=...
```

Schools cannot open the homepage, pricing, signup, or login without a Vercel account until this is changed.

## Fix in Vercel (required before sending to schools)

1. Open the **trip-connect** project in [Vercel Dashboard](https://vercel.com).
2. Go to **Settings → Deployment Protection** (or **Settings → General → Deployment Protection**).
3. For the environment you intend to share publicly:
   - **Production**: disable “Vercel Authentication” / SSO for Production, **or** deploy to a custom production domain with protection off for Production only.
   - **Preview**: if sharing a preview URL, disable protection for Preview deployments **or** promote a build to Production on a public domain.
4. Save and re-test with an incognito window (not logged into Vercel):

   ```bash
   curl -sI "https://YOUR-PUBLIC-URL/" | head -5
   ```

   Expect **HTTP/2 200** (or 307 to `/` on www), **not** a redirect to `vercel.com/sso-api`.

## Recommended for school launch

| Approach | Notes |
|----------|--------|
| **Custom domain on Production** | e.g. `app.itinerarylive.app` — set `APP_URL` / `NEXT_PUBLIC_APP_URL` to this URL in Vercel env. |
| **Production without SSO** | Keep Preview deployments protected; only Production is public. |
| **Do not share preview URLs** | `*.vercel.app` preview links often have protection enabled by default on team projects. |

## Environment variables (production)

Set on Vercel for correct links in emails and redirects:

- `APP_URL` — canonical public URL (https, no trailing slash)
- `NEXT_PUBLIC_APP_URL` — same value if client-side links need it
- `BILLING_ENFORCEMENT_DISABLED` — `false` on staging/production for real trial behaviour
- Database migrated with `npm run db:apply` on the production database

## Acceptance check

A school staff member (no Vercel login) can open:

- `/`
- `/pricing`
- `/signup?type=school`
- `/login`
- `/terms`, `/privacy`, `/contact`
