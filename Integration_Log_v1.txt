# 유튜브 공유 기능 연동 완벽 가이드

> Studio Canvas AI (Next.js) — **「유튜브로 공유하기」** 구현·트러블슈팅 기록  
> 기준 코드: `components/ThumbnailEditor.tsx` 및 관련 i18n / OAuth 설정  
> 최종 정리일: 2026-08-08

---

## 0. 한 줄 요약 (현재 아키텍처)

| 항목 | 실제 구현 |
|------|-----------|
| 공유 방식 | **클라이언트 전용**: 썸네일 JPG 다운로드 + YouTube Studio 새 탭 오픈 |
| 백엔드 API | **없음** — `app/api/youtube/**` 라우트 미존재 |
| YouTube Data API v3 | **미연동** — 업로드 API 호출 없음 |
| Google OAuth (로그인) | `openid email profile` 만 사용 (YouTube 스코프 **의도적 제외**) |
| 무한 로딩 원인 | 과거 `navigator.share()` Promise가 settle 되지 않아 `youtubeBusy` 고착 |

즉, “유튜브로 공유하기”는 **플랫폼 업로드 API가 아니라**, 사용자가 Studio에서 수동 업로드하기 쉽게 만드는 **어시스트 UX**입니다.

---

## 1. 핵심 파일 및 경로

### 1.1 프론트엔드 (UI · 공유 로직)

| 경로 | 역할 |
|------|------|
| `components/ThumbnailEditor.tsx` | **본체**. YouTube UI 미리보기 칩, 「유튜브로 공유하기」 버튼, `handleYoutubeShare`, `exportBlob`, `youtubeBusy` |
| `components/ResultWorkspace.tsx` | 생성 결과/편집 화면에서 `ThumbnailEditor` 마운트 |
| `lib/webShare.ts` | 일반 Web Share / 클립보드 폴백 (`isShareAbortError`, `shareWithFallback`) — **카카오/일반 공유**용. YouTube 경로에서는 **사용하지 않음**(무한 로딩 회피) |
| `lib/printExport.ts` | (연관) 인쇄 내보내기 — YouTube 공유와는 별개 |
| `lib/kakaoShare.ts` | 카카오 공유 전용. YouTube와 상태/SDK를 분리하기 위해 `kakaoBusy` vs `youtubeBusy`로 분리 |

### 1.2 i18n

| 경로 | 키 |
|------|-----|
| `lib/i18n/types.ts` | `thumbnail.youtubePreview`, `youtubeShare`, `youtubeShareReady` |
| `lib/i18n/locales/kr.ts` | 한국어 카피 |
| `lib/i18n/locales/en.ts` | 영어 카피 |
| `lib/i18n/locales/ja.ts` / `zh.ts` | 일본어 / 중국어 |

대표 카피 (KR):

- `youtubeShare`: 「유튜브로 공유하기」
- `youtubeShareReady`: 「썸네일을 저장했습니다. YouTube 스튜디오에서 업로드해 주세요.」

### 1.3 백엔드 API 라우트

| 경로 | 상태 |
|------|------|
| `app/api/youtube/**` | **존재하지 않음** |
| YouTube Data API 프록시 / 토큰 교환 API | **없음** |

코드 주석 (`ThumbnailEditor.tsx`):

```text
There is no /api/youtube route and no YouTube Data API OAuth in this app.
```

### 1.4 로그인 OAuth와의 관계 (혼동 주의)

Google 로그인은 **앱 회원 인증**용이며, YouTube 업로드 권한과는 분리되어 있습니다.

| 경로 | 내용 |
|------|------|
| `lib/supabase/oauth.ts` | Supabase `signInWithOAuth({ provider: "google" })`, scopes: `openid email profile`, `prompt: select_account` |
| `lib/auth.ts` | NextAuth Google 폴백 — 동일하게 `openid email profile` + `prompt: select_account` |

`prompt: "select_account"` 주석 취지: 이전에 묶여 있던 **삭제/비활성 YouTube 채널 세션**에 자동 로그인되지 않도록 계정 선택창을 강제.

---

## 2. 사용자 플로우 (현재)

```
[결과 화면 ResultWorkspace]
        │
        ▼
[ThumbnailEditor — 텍스트/이모지/CTR 편집]
        │
        ├─ 「유튜브 UI 미리보기」 칩 → 캔버스에 YT 스타일 프레임 오버레이
        │
        └─ 「유튜브로 공유하기」 클릭
                 │
                 ▼
           setYoutubeBusy(true)
                 │
                 ▼
           exportBlob()  ← canvas.toBlob JPEG, 8초 타임아웃
                 │
                 ├─ 실패 → toast(shareFailed) → finally busy=false
                 │
                 ▼
           downloadBlobFile(blob, studio-canvas-youtube-*.jpg)
                 │
                 ▼
           window.open("https://studio.youtube.com")
                 │
                 ├─ 팝업 차단 → toast(shareFailed)
                 └─ 성공 → toast(youtubeShareReady)
                 │
                 ▼
           finally → setYoutubeBusy(false)
```

사용자가 해야 할 일: Studio에서 영상/썸네일 업로드 UI에 **방금 받은 JPG를 직접 업로드**.

---

## 3. 무한 로딩(먹통) 트러블슈팅

### 3.1 증상

- 「유튜브로 공유하기」 클릭 후 버튼이 `disabled` 상태로 남음
- 스피너/비활성 UI가 끝나지 않음 (`youtubeBusy === true` 고착)
- 네트워크 탭에 YouTube API 호출은 없음 (애초에 서버 업로드가 없음)

### 3.2 원인 분석

**근본 원인:** 초기 구현이 (또는 중간 버전에서) `navigator.share()` / Web Share API에 의존했던 경로.

| 요인 | 설명 |
|------|------|
| Promise 미해결 | 데스크톱 Chrome/Edge 등에서 OS 공유 시트가 **닫히지 않거나** `share()` Promise가 **영원히 pending**인 경우가 있음 |
| 상태 고착 | `setYoutubeBusy(true)` 이후 `await navigator.share(...)`에서 멈추면 `finally`에 도달하지 못하거나, 공유 경로와 busy 플래그가 한 덩어리로 묶여 **해제 불가** |
| 카카오와 혼선 | 공유 busy를 하나로 쓰면 카카오 SDK 대기와 YouTube 대기가 서로 영향을 줄 수 있어, **`kakaoBusy` / `youtubeBusy`로 분리** |

부가 리스크:

- `canvas.toBlob`도 콜백이 오지 않으면 busy가 남을 수 있음 → **`exportBlob`에 8초 타임아웃** 적용

### 3.3 적용된 수정 내역

#### (A) YouTube 전용 핸들러 — Web Share 제거

```102:1035:components/ThumbnailEditor.tsx
  /**
   * YouTube share = download thumbnail + open YouTube Studio.
   * Do NOT use navigator.share here: on desktop Chrome/Edge the OS share sheet
   * can stay pending forever, so youtubeBusy never clears (infinite loading).
   * There is no /api/youtube route and no YouTube Data API OAuth in this app.
   */
  const handleYoutubeShare = async () => {
    setYoutubeBusy(true);
    try {
      const blob = await exportBlob();
      if (!blob) {
        showToast(t.thumbnail.shareFailed, "error");
        return;
      }

      downloadBlobFile(blob, `studio-canvas-youtube-${Date.now()}.jpg`);

      const studio = window.open(
        "https://studio.youtube.com",
        "_blank",
        "noopener,noreferrer"
      );
      if (!studio) {
        showToast(t.thumbnail.shareFailed, "error");
        return;
      }
      showToast(t.thumbnail.youtubeShareReady, "success");
    } catch (err) {
      console.warn("[ThumbnailEditor] YouTube share failed", err);
      showToast(t.thumbnail.shareFailed, "error");
    } finally {
      setYoutubeBusy(false);
    }
  };
```

핵심 포인트:

1. **`try / catch / finally`** — 성공·실패·조기 return 모두 `finally`에서 `youtubeBusy = false`
2. **`navigator.share` 미사용** — 무한 pending 경로 자체 제거
3. **결정적 UX**: 파일 다운로드 + Studio URL (사용자가 완료 가능한 플로우)

#### (B) `exportBlob` 타임아웃 (8초)

```822:846:components/ThumbnailEditor.tsx
  const exportBlob = async (timeoutMs = 8_000): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => {
      let settled = false;
      const done = (b: Blob | null) => {
        if (settled) return;
        settled = true;
        resolve(b);
      };
      const timer = window.setTimeout(() => done(null), timeoutMs);
      try {
        canvas.toBlob(
          (b) => {
            window.clearTimeout(timer);
            done(b);
          },
          "image/jpeg",
          0.95
        );
      } catch {
        window.clearTimeout(timer);
        done(null);
      }
    });
  };
```

#### (C) busy 상태 분리

- `kakaoBusy` — 카카오 공유 버튼만 disable  
- `youtubeBusy` — 유튜브 공유 버튼만 disable  

한 쪽 공유가 실패/지연해도 다른 쪽 UI가 같이 먹통이 되지 않음.

---

## 4. YouTube API · OAuth — “연동 방식”에 대한 정확한 기록

### 4.1 현재: YouTube Data API v3 **미사용**

| 항목 | 상태 |
|------|------|
| Google Cloud — YouTube Data API v3 활성화 | 앱 코드에서 **사용하지 않음** (콘솔에 켜져 있어도 호출처 없음) |
| OAuth scope (`youtube.upload` 등) | **요청하지 않음** |
| Access / Refresh token 저장 | YouTube 업로드용 토큰 **없음** |
| `videos.insert` / `thumbnails.set` | **미구현** |

### 4.2 Google 로그인 OAuth (앱 인증만)

Supabase Google 예시 (`lib/supabase/oauth.ts`):

```ts
scopes: "openid email profile",
queryParams: {
  access_type: "offline",
  prompt: "select_account",
},
```

| 파라미터 | 의미 |
|----------|------|
| `openid email profile` | 로그인·프로필용. YouTube 채널 권한 없음 |
| `prompt: select_account` | 계정 선택 UI 강제 (잘못된/삭제된 채널 세션 고착 완화) |
| `access_type: offline` | Supabase 세션 갱신용 (앱 로그인). YouTube API refresh와는 무관 |

**의도:** 로그인에 YouTube Data API 스코프를 붙이면 Google 동의 화면이 무거워지고, “공유”와 “로그인”이 한 토큰으로 얽혀 디버깅이 어려워짐. 현재 제품은 둘을 **분리**한다.

### 4.3 (참고) 향후 진짜 “API 업로드”를 넣을 때의 설계 스케치

문서화용 — **아직 코드에 없음**.

1. Google Cloud 프로젝트에서 **YouTube Data API v3** 활성화  
2. OAuth 클라이언트 — Redirect URI: 앱 전용 콜백 (예: `/api/youtube/callback`)  
3. 스코프 예: `https://www.googleapis.com/auth/youtube.upload` (최소 권한)  
4. `prompt=consent` + offline access로 refresh token 확보 (채널 업로드용, **로그인 세션과 별도 저장**)  
5. API 라우트 예:
   - `POST /api/youtube/auth/start` — 동의 URL
   - `GET /api/youtube/callback` — 코드 교환
   - `POST /api/youtube/upload` — multipart 업로드 + 선택적 썸네일 설정  
6. 프론트는 busy + `AbortController` + **반드시 finally로 busy 해제**, 업로드 progress는 별도 상태

이 경로를 넣더라도, 데스크톱 Web Share에 의존하면 **동일 무한 로딩이 재발**할 수 있으므로 Studio 어시스트 UX는 폴백으로 유지하는 것을 권장.

---

## 5. UI·부가 기능

| 기능 | 설명 |
|------|------|
| YouTube UI 미리보기 | `youtubePreview` 토글 — 타임스탬프/크롬 느낌의 오버레이로 CTR 확인 |
| 세이프존 | 썸네일 잘림 영역 가이드 |
| CTR 점수/팁 | 문구 길이·이모지 등 휴리스틱 |

진입점: 생성 마법사 결과 → 상세/편집 → `ResultWorkspace` 하단 썸네일 에디터.

---

## 6. 검증 체크리스트

- [ ] 「유튜브로 공유하기」 클릭 시 JPG가 로컬에 저장되는가  
- [ ] `https://studio.youtube.com` 새 탭이 열리는가 (팝업 차단 시 실패 토스트)  
- [ ] 버튼이 **수 초 내** 다시 활성화되는가 (`youtubeBusy` 해제)  
- [ ] `toBlob`이 느려도 **8초 이내** busy가 풀리는가  
- [ ] 카카오 공유와 busy 상태가 서로 간섭하지 않는가  
- [ ] Network에 `/api/youtube` 호출이 **없는** 것이 정상인가  
- [ ] Google 로그인 동의 화면에 YouTube 권한이 **나오지 않는**가  

---

## 7. 개발 일지용 타임라인 (요약)

1. **초기 의도**: 썸네일 에디터에서 YouTube로보내기 UX  
2. **문제**: `navigator.share` 기반(또는 유사) 경로에서 데스크톱 공유 시트 Promise 미결 → **무한 로딩**  
3. **조치**:  
   - YouTube 경로에서 Web Share 제거  
   - 다운로드 + Studio 오픈으로 재정의  
   - `try/catch/finally` + `youtubeBusy`  
   - `exportBlob` 8초 타임아웃  
   - `kakaoBusy` / `youtubeBusy` 분리  
   - `youtubeShareReady` i18n 추가  
4. **현재 상태**: 프로덕션에서 **스튜디오 어시스트형 공유**로 안정 동작. API 직접 업로드는 미구현.

---

## 8. 빠른 레퍼런스 (복붙용)

```text
엔트리 UI     : components/ThumbnailEditor.tsx → handleYoutubeShare
부모           : components/ResultWorkspace.tsx
상태           : youtubeBusy (kakaoBusy와 분리)
내보내기       : exportBlob() → canvas.toBlob JPEG + 8s timeout
성공 UX        : download JPG + window.open(studio.youtube.com) + toast
백엔드         : 없음 (YouTube Data API /api/youtube 없음)
로그인 OAuth   : openid email profile only + prompt=select_account
```

---

## 9. FAQ

**Q. 왜 Studio만 열고 자동 업로드가 안 되나요?**  
A. YouTube Data API OAuth·업로드 파이프라인을 넣지 않았기 때문입니다. 브라우저에서 타사 채널에 파일을 직접 올리는 것은 동의·스코프·토큰 저장이 필요하고, 로그인용 Google OAuth와 섞으면 위험합니다.

**Q. Google Cloud에 YouTube API를 켜 두면 되나요?**  
A. 켜 둬도 **현재 앱은 호출하지 않습니다**. API 업로드를 구현할 때만 필요합니다.

**Q. 무한 로딩이 다시 생기면?**  
A. (1) YouTube 경로에 `navigator.share`가 다시 들어갔는지 (2) `finally`에서 `setYoutubeBusy(false)`가 빠졌는지 (3) `exportBlob` 타임아웃이 있는지 확인하세요.

---

*이 문서는 저장소의 실제 코드와 배포 반영된 트러블슈팅을 기준으로 작성되었습니다. API 업로드를 추가하면 본 문서의 §4.3을 구현 스펙으로 확장하면 됩니다.*
