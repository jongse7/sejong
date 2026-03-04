# CMS Setup (Supabase + Admin + Web)

## 1. Supabase SQL

Run in SQL Editor:

1. `apps/server/supabase/schema.sql`
2. `apps/server/supabase/seed.sql` (optional)

## 2. Environment Variables

### `apps/server/.env`

```bash
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=YOUR_SECRET_KEY
# Optional legacy fallback:
# SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
ADMIN_API_KEY=change-me
WEB_DEPLOY_HOOK_URL=
```

`WEB_DEPLOY_HOOK_URL` is optional. Add your Vercel deploy hook URL for auto redeploy on CMS writes.

### `apps/admin/.env`

```bash
VITE_API_BASE_URL=http://localhost:8787
```

관리자 비밀번호는 프론트 환경변수로 넣지 않습니다.
관리자 화면에서 서버의 `ADMIN_API_KEY` 값을 직접 입력해 잠금을 해제하세요.

### `apps/web/.env`

```bash
CMS_API_BASE_URL=http://localhost:8787
```

For Vercel production, set `CMS_API_BASE_URL` to your deployed server app URL.

## 3. Development

```bash
pnpm dev
```

Default local URLs:

- Web: `http://localhost:4321` (or next available)
- Admin: `http://localhost:5173` (or next available)
- Server: `http://localhost:8787`

## 4. Publish Flow

1. Write/edit post in admin.
2. Set `status = published`.
3. Web build reads published posts from `CMS_API_BASE_URL` via content loader.
