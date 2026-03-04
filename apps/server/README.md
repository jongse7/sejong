# @portfolio/server

Hono API for Portfolio CMS.

## Environment

Create `.env` in `apps/server`:

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
# Optional legacy fallback:
# SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
ADMIN_API_KEY=change-me
WEB_DEPLOY_HOOK_URL=
```

`WEB_DEPLOY_HOOK_URL` is optional. If set, content mutations trigger a web redeploy hook.

## Local Dev

```bash
pnpm --filter ./apps/server dev
```

## API Routes

- `GET /api/health`
- `GET /api/public/profile`
- `GET /api/public/tags`
- `GET /api/public/posts`
- `GET /api/public/posts/:slug`
- `GET /api/admin/profile`
- `PUT /api/admin/profile`
- `GET /api/admin/posts`
- `GET /api/admin/posts/:id`
- `POST /api/admin/posts`
- `PATCH /api/admin/posts/:id`
- `DELETE /api/admin/posts/:id`
- `GET /api/admin/tags`
- `POST /api/admin/tags`
- `PATCH /api/admin/tags/:id`
- `DELETE /api/admin/tags/:id`

Admin endpoints require `x-admin-key: <ADMIN_API_KEY>`.

## Supabase SQL

Run:

1. `apps/server/supabase/schema.sql`
2. `apps/server/supabase/seed.sql` (optional)
