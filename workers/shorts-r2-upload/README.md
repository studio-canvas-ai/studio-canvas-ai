# Shorts R2 stream upload (Cloudflare Worker)

Same-origin mobile-safe upload: browser → `studio-canvas-ai.com/api/shorts/stream-upload` → R2.

## Production flow

1. `POST /api/shorts/presign` (Vercel) → R2 presigned PUT URL
2. `POST /api/shorts/stream-upload/v1/session` JSON `{ target }` → short PUT URL (same origin)
3. `PUT /api/shorts/stream-upload/v1/put/:id` → Worker streams body to R2

## Routes (wrangler.toml)

- `www.studio-canvas-ai.com/api/shorts/stream-upload*`
- `studio-canvas-ai.com/api/shorts/stream-upload*`

Requires domain nameservers on Cloudflare.

## Deploy

```bash
cd workers/shorts-r2-upload
npm install
CLOUDFLARE_API_TOKEN=... npx wrangler deploy
```

## Localhost fallback

`workers.dev` legacy paths (`/v1/session`, `/v1/put/:id`) remain for localhost mobile testing.
