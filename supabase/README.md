# Supabase (Studio Canvas AI2)

## Role in this app

| Concern | Where it lives |
|--------|----------------|
| Google / social OAuth | **Supabase Auth** (`auth.users`) |
| Registered members (admin list) | **`public.profiles`** where `terms_agreed = true` |
| App session (credits, plan, payments) | **NextAuth JWT** + local `lib/db` JSON store |

Flow: `signInWithOAuth` → `/auth/callback` → `/auth/bridge` → if `terms_agreed` is false → `/terms-consent` → `POST /api/terms/agree` upserts profile + provisions local user → app.

## Apply schema (required once on new project)

1. Open Supabase Dashboard → **SQL Editor**
2. Paste and run: [`migrations/20260801_profiles_rls.sql`](./migrations/20260801_profiles_rls.sql)
3. Paste and run: [`migrations/20260803_profiles_terms_agreed.sql`](./migrations/20260803_profiles_terms_agreed.sql)
4. Paste and run: [`migrations/20260822_studio_user_stores.sql`](./migrations/20260822_studio_user_stores.sql) (recent files / upload vault / trained vault durable store)
5. Paste and run: [`migrations/20260822_studio_user_store_snapshots.sql`](./migrations/20260822_studio_user_store_snapshots.sql) (admin rollback snapshots)
6. Paste and run: [`migrations/20260824_profiles_active_session.sql`](./migrations/20260824_profiles_active_session.sql) (single-device session lock: `active_session_id`)
7. Confirm **Table Editor** shows `public.profiles` with `terms_agreed` / `terms_agreed_at` (and `active_session_id` after step 6)

`auth.users` is created automatically by Supabase — do not recreate it.

## Current project (canonical — do not mix with test projects)

| Field | Value |
|--------|--------|
| Name | Studio Canvas AI2 |
| Region | Northeast Asia (Seoul) |
| Project ref | `oorujqbivznftsyqilyj` |
| URL | `https://oorujqbivznftsyqilyj.supabase.co` |
| IdP OAuth callback | `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback` |
| Site URL | `https://www.studio-canvas-ai.com` |
| Redirect URLs | `https://www.studio-canvas-ai.com/**` |

**Retired / never use for production:** `ysdccsfpxduqcqxgwuy` (test project; wrong
`redirect_uri` → Kakao **KOE006**).

## Vercel env (Production)

```
NEXT_PUBLIC_SUPABASE_URL=https://oorujqbivznftsyqilyj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_AxCvc2Tip52WVL70oprCbw_PAb4ktlm
SUPABASE_SERVICE_ROLE_KEY=<service_role secret — admin member list>
NEXT_PUBLIC_SITE_URL=https://www.studio-canvas-ai.com
```

Redeploy after changing any `NEXT_PUBLIC_*` variable.

## Google Cloud / Supabase Google provider

Primary login path is **Supabase Auth** (`signInWithGoogle` → `/auth/callback` → bridge).
Do **not** point Google’s Authorized redirect URI at `/api/auth/callback/google`.

| Field | Value |
|--------|--------|
| App name | Studio Canvas AI |
| Client ID | `962424226912-lc143aodb29ppf9s4f9e78fr777oqih.apps.googleusercontent.com` |
| Client type | Web application |
| Authorized JavaScript origins | `https://www.studio-canvas-ai.com`, `https://studio-canvas-ai.vercel.app`, `http://localhost:3000` |
| **Authorized redirect URI (required)** | `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback` (= `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`) |
| Scopes | `openid`, `email`, `profile` |

1. Google Cloud Console → Credentials → Web client → add the **Supabase** redirect URI above.
2. Supabase → Authentication → Providers → Google → enable and paste Client ID + Client Secret.
3. Supabase → Authentication → URL Configuration:
   - Site URL: `https://www.studio-canvas-ai.com`
   - Redirect URLs: `https://www.studio-canvas-ai.com/**`, `https://studio-canvas-ai.vercel.app/**`, `http://localhost:3000/**`

App env does **not** need `GOOGLE_CLIENT_*` while Supabase Google is enabled (those are Auth.js fallback only). Still required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_SECRET`, `NEXT_PUBLIC_SITE_URL`.

## Facebook / Instagram OAuth (`facebook` — Meta unified)

Meta’s Facebook Login backs **both** the Facebook and Instagram buttons.
App code always uses `provider: 'facebook'` (never `custom:instagram`).

- `signInWithFacebook()` / `signInWithInstagram()` (alias)
- `redirectTo: ${origin}/auth/callback?next=…` → PKCE → `/auth/bridge` → NextAuth cookie

### Meta / Facebook Developers

| Field | Value |
|--------|--------|
| App ID | `1527934262363418` |
| App Domains | `studio-canvas-ai.com`, `www.studio-canvas-ai.com` |
| Valid OAuth Redirect URI | `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback` |
| Client / Web OAuth Login | **Enabled** |
| Enforce HTTPS | **Enabled** |
| Privacy Policy URL | Prefer `https://www.studio-canvas-ai.com/privacy` |
| App Secret | → Supabase Facebook provider only (never in frontend) |

### Supabase → Authentication → Providers → Facebook

1. Enable Facebook with App ID + App Secret
2. Prefer enabling **Allow users without an email**
3. Site URL: `https://www.studio-canvas-ai.com`
4. Redirect URLs must include:
   - `https://www.studio-canvas-ai.com/**`
   - `https://studio-canvas-ai.com/**`

Do **not** configure a separate Supabase Instagram custom provider for site login.

### Scopes / `Invalid Scopes: email`

Do not pass `scopes: "email"` unless Meta Use cases → Authentication includes **email**.
Until then, omit scopes; missing email uses synthetic `@users.facebook.id`.

Start OAuth on **www** so PKCE cookies match the callback host.

## Microsoft Custom OAuth (`custom:microsoft`)

App code: `signInWithMicrosoft()` → `provider: 'custom:microsoft'`,
`redirectTo: window.location.origin` (production: `https://www.studio-canvas-ai.com`).
Authorize/Token/Issuer URLs live **only in the Supabase dashboard** (not hardcoded in app code).

> Do **not** set app `redirectTo` to `/auth/v1/callback` on the site host.
> That path is Supabase’s provider callback on `*.supabase.co`.

### AADSTS70016 (tenant mismatch)

If Authorization/Token/Issuer used a **fixed tenant ID**, logins from other Microsoft
accounts fail with `AADSTS70016` (app not found in that directory). All endpoints must
use the **`common`** tenant so personal + any org accounts work.

### Azure / Entra app registration

| Field | Value |
|--------|--------|
| Redirect URI (Web) | `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback` |
| Supported account types | **Accounts in any org directory and personal Microsoft accounts** (matches `common`) |
| Client ID / Secret | → Supabase Custom provider |

### Supabase → Authentication → Providers → Custom (identifier: `microsoft`)

| Field | Value |
|--------|--------|
| Provider id (app call) | `custom:microsoft` |
| Provider type | OAuth2 / OIDC |
| Authorization URL | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` |
| Token URL | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| Issuer URL | `https://login.microsoftonline.com/common/v2.0` |
| JWKS URI | `https://login.microsoftonline.com/common/discovery/v2.0/keys` |
| Userinfo URL | `https://graph.microsoft.com/oidc/userinfo` |
| Scopes | `openid profile email offline_access` |
| Client ID / Secret | from Azure app registration |

Auth Redirect URLs must include `https://www.studio-canvas-ai.com/**`.

## Kakao OAuth (`kakao`)

Built-in Supabase provider. App code: `signInWithKakao()` → **`provider: 'kakao'`**
(not `custom:kakao`).

`redirectTo: /auth/callback?next=…` → bridge (same as Google/Naver).

### Kakao Developers

| Field | Value |
|--------|--------|
| Redirect URI | `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback` |
| Kakao Login | **ON** |
| Consent items | `profile_nickname`, `profile_image`; enable `account_email` if available (Biz / Individual) |
| REST API key | → Supabase Kakao **Client ID** |
| Client Secret | → Supabase Kakao **Client Secret** |

### KOE205 (`account_email`)

Personal (non-Biz) Kakao apps cannot use `account_email`. The app sets:

```ts
queryParams: { scope: "profile_nickname,profile_image" }
```

so the authorize request does not ask for email. Also enable Supabase Kakao →
**Allow users without an email**. The bridge synthesizes `{kakaoId}@users.kakao.id`
when email is missing.

### Supabase → Authentication → Providers → Kakao

1. Enable **Kakao** (built-in)
2. Paste REST API key + Client Secret
3. Prefer **Allow users without an email**
4. Do **not** rely on a Custom provider named `kakao` for site login

Optional helpers (not required for built-in path): `/api/auth/kakao/userinfo`,
`supabase/functions/kakao-userinfo` — kept for experiments only.

## Naver Custom OAuth (`custom:naver`)

Naver’s `/v1/nid/me` nests fields under `response`, so pointing Supabase Userinfo
URL at Naver directly causes `Error getting user email from external provider`.

### Flatten proxies (pick one Userinfo URL)

| Option | Userinfo URL |
|--------|----------------|
| **Recommended** Edge Function | `https://oorujqbivznftsyqilyj.supabase.co/functions/v1/naver-userinfo` |
| Next.js API | `https://www.studio-canvas-ai.com/api/auth/naver/userinfo` |

Deploy the Edge Function (JWT verify **off** — Naver token, not Supabase JWT):

```bash
npx supabase login
npx supabase link --project-ref oorujqbivznftsyqilyj
npx supabase functions deploy naver-userinfo --no-verify-jwt
```

Both proxies call Naver with `Authorization: Bearer <access_token>` and return:

```json
{ "sub": "<id>", "id": "<id>", "email": "<response.email>", "email_verified": true, "name": "..." }
```

### Supabase → Authentication → Providers → Custom (identifier: `naver`)

Use **Manual / OAuth2** (not OIDC auto-discovery):

| Field | Value |
|--------|--------|
| Provider type | **OAuth2** (not OIDC) |
| Authorization URL | `https://nid.naver.com/oauth2.0/authorize` |
| Token URL | `https://nid.naver.com/oauth2.0/token` |
| Userinfo URL | Edge Function URL above (preferred) |
| Scopes | `profile` only — **do not** include `openid` |
| Client ID / Secret | from [Naver Developers](https://developers.naver.com/) |

If `openid` is in scopes, Supabase skips userinfo and never hits the proxy.

### Naver Developers

- Callback URL: `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback`
- API 권한: **이메일**을 필수 동의로 설정
