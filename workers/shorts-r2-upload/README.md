# Shorts R2 upload proxy (Cloudflare Worker)

Streams mobile browser `PUT` bodies to a presigned Cloudflare R2 URL.  
Avoids mobile Chrome failures on direct cross-origin R2 PUT and Vercel 4.5 MB body limits.

## Flow

1. App calls `POST /api/shorts/presign` (Vercel) → receives `uploadUrl` (R2 presign).
2. Mobile browser `PUT` → `https://upload.studio-canvas-ai.com/v1/put`
   - Header: `X-R2-Upload-Url: <presigned R2 URL>`
   - Body: raw video bytes (no `Content-Type`)
3. Worker forwards the stream to R2.

## Deploy

```bash
cd workers/shorts-r2-upload
npm install
npx wrangler login
npx wrangler deploy
```

### Custom domain (recommended)

In Cloudflare dashboard → Workers → `studio-canvas-shorts-r2-upload` → Settings → Domains:

- Add route: `upload.studio-canvas-ai.com/v1/*`

### Vercel env

Set in production:

```
NEXT_PUBLIC_SHORTS_UPLOAD_PROXY_URL=https://upload.studio-canvas-ai.com
```

Or use the `*.workers.dev` URL from first deploy until DNS is ready.

Redeploy Vercel after setting the env var.

## Local dev

```bash
npm run dev
# Worker on http://localhost:8787
# NEXT_PUBLIC_SHORTS_UPLOAD_PROXY_URL=http://localhost:8787
```
