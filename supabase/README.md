# Supabase (Studio Canvas AI2)

## Role in this app

| Concern | Where it lives |
|--------|----------------|
| Google / social OAuth | **Supabase Auth** (`auth.users`) |
| Optional profile mirror | **`public.profiles`** (+ RLS) |
| App session (credits, plan, payments) | **NextAuth JWT** + local `lib/db` JSON store |

Flow: `signInWithOAuth` → Supabase → Google → site origin → `/auth/callback` → `/auth/bridge` → NextAuth `supabase` credentials → `findOrCreateOAuthUser` + `profiles` upsert.

## Apply schema (required once on new project)

1. Open Supabase Dashboard → **SQL Editor**
2. Paste and run: [`migrations/20260801_profiles_rls.sql`](./migrations/20260801_profiles_rls.sql)
3. Confirm **Table Editor** shows `public.profiles` with RLS enabled

`auth.users` is created automatically by Supabase — do not recreate it.

## Current project

- Name: Studio Canvas AI2
- Region: Northeast Asia (Seoul)
- URL: `https://oorujqbivznftsyqilyj.supabase.co`
- Google callback: `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback`
- Site URL: `https://www.studio-canvas-ai.com`
- Redirect URLs: `https://www.studio-canvas-ai.com/**`

## Vercel env (Production)

```
NEXT_PUBLIC_SUPABASE_URL=https://oorujqbivznftsyqilyj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key>
NEXT_PUBLIC_SITE_URL=https://www.studio-canvas-ai.com
```

Redeploy after changing any `NEXT_PUBLIC_*` variable.

## Google Cloud

- Client type: Web application
- Client ID: `353413561216-du0ildtg6ehu9qj5hov9h7vpcl57ar10.apps.googleusercontent.com`
- Authorized JavaScript origins: `https://www.studio-canvas-ai.com`, `http://localhost:3000`
- Authorized redirect URIs: `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback`
- Client ID + Secret → Supabase → Authentication → Providers → Google

## Microsoft Custom OAuth (`custom:microsoft`)

App code: `signInWithMicrosoft()` → `provider: 'custom:microsoft'`,
`redirectTo: window.location.origin` (production: `https://www.studio-canvas-ai.com`).

> Do **not** set app `redirectTo` to `/auth/v1/callback` on the site host.
> That path is Supabase’s provider callback on `*.supabase.co`.

### Azure / Entra app registration

| Field | Value |
|--------|--------|
| Redirect URI (Web) | `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback` |
| Supported account types | Multitenant + personal Microsoft accounts (or as needed) |
| Client ID / Secret | → Supabase Custom provider |

### Supabase → Authentication → Providers → Custom (identifier: `microsoft`)

| Field | Value |
|--------|--------|
| Provider type | OAuth2 / OIDC |
| Authorization URL | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` |
| Token URL | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| Userinfo URL | `https://graph.microsoft.com/oidc/userinfo` |
| Scopes | `openid profile email offline_access` |
| Client ID / Secret | from Azure app registration |

Auth Redirect URLs must include `https://www.studio-canvas-ai.com/**`.

## Kakao OAuth (`kakao`)

Built-in Supabase provider. App code: `signInWithKakao()` → `provider: 'kakao'`,
`redirectTo: window.location.origin` (production: `https://www.studio-canvas-ai.com`).

### Kakao Developers

| Field | Value |
|--------|--------|
| Redirect URI | `https://oorujqbivznftsyqilyj.supabase.co/auth/v1/callback` |
| Kakao Login | **ON** |
| Consent items | `profile_nickname`, `profile_image` (required); `account_email` optional |
| REST API key | → Supabase Kakao **Client ID** |
| Client Secret | → Supabase Kakao **Client Secret** (enable Client Secret in Kakao console) |

### Supabase → Authentication → Providers → Kakao

1. Enable Kakao
2. Paste REST API key + Client Secret
3. If email consent is unavailable, enable **Allow users without an email**
4. Confirm Auth Redirect URLs include `https://www.studio-canvas-ai.com/**`

Site URL remains `https://www.studio-canvas-ai.com`. Middleware forwards `?code=` on the
site origin to `/auth/callback` → `/auth/bridge` (same as Google/Naver).

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
