# Studio Canvas AI — 전체 소스코드 종합 정밀 진단 평가서

- **평가일:** 2026-07-30
- **대상 경로:** `C:\Users\Father\studio-canvas-ai`
- **범위:** `app`, `components`, `lib`, `scripts`, `types`, 설정 파일 전수
- **방법:** 정적 코드 분석 (라우트·결제·인증·AI·i18n·보안 교차 검증)
- **비고:** 실 PG 샌드박스 E2E·런타임 부하 테스트는 본 평가에 포함되지 않음

---

## 종합 판정

| 항목 | 결과 |
|------|------|
| **현재 완성도 점수** | **52 / 100** |
| **정식 Vercel 유료 오픈** | **부적합 (즉시 배포 불가)** |
| **로컬/데모 · Stripe 단건 검증** | 가능 |
| **소프트론치(해외 Stripe only) 최소선** | P0 보안·DB·크레딧 고정 후 검토 가능 |

**한 줄 요약:** UI·위자드·Stripe 최초 결제는 프로토타입~소프트론치 후보 수준이지만, 국내 PG·실 AI 추론·공유 DB·인증/웹훅 보안이 미완이라 정식 유료 서비스로 즉시 오픈하기에는 부적합합니다.

---

## 영역별 점수

| 영역 | 점수 | 요약 |
|------|-----:|------|
| 프로젝트 구조 / App Router | 82 | 라우팅·모듈 분리는 명확 |
| UI/UX · 위자드 · 스타일 갤러리 | 74 | 최근 개편 반영, 대비 잔여 이슈 |
| 스타일 메타 · i18n 정합 | 78 | 8팩 정합, 일부 로케일 부분 번역 |
| Stripe 결제 (글로벌) | 68 | 최초 결제 OK, 갱신 크레딧 미지급 |
| 국내 PG (Toss/PortOne) | 28 | 클라이언트 미연동 · PortOne 스텁 |
| AI 이미지 생성 (프로덕션) | 32 | mock 폴백 · blob 셀카 한계 |
| 보안 · 인증 · 웹훅 | 34 | 비밀번호 없는 credentials 등 |
| 데이터 영속성 (DB/갤러리) | 30 | JSON 파일 + localStorage |

---

## 1. 전체 프로젝트 구조 및 파일 역할

### 스택 개요
- **프레임워크:** Next.js 15 App Router only (Pages Router 없음)
- **UI:** React 19, Tailwind, lucide-react
- **인증:** Auth.js v5 (Kakao / Google / Naver + Credentials)
- **결제:** Stripe(실연동) + Toss/PortOne(서버 스텁·라우팅만)
- **DB:** 로컬 JSON 파일 (`lib/db/store.ts`, `.data` / `DATA_DIR`)
- **스토리지:** Cloudflare R2 (S3 호환)
- **AI:** Replicate / RunPod / ComfyUI / mock 폴백

### 규모
| 구분 | 수량 |
|------|-----:|
| 페이지 (`page.tsx`) | 12 |
| API 라우트 (`route.ts`) | 21 |
| 레이아웃 | 2 |
| 컴포넌트 | 27 |
| lib 모듈 | 46 |
| i18n 로케일 | 10 |
| Vercel cron | 3 |

### 주요 경로 역할

| 경로 | 역할 |
|------|------|
| `app/` | 12 pages · 21 API · 2 layouts · `globals.css` |
| `components/` | 27 UI (PersonaCreator, PaymentModal, PricingSection 등) |
| `lib/` | auth, payments, ai, db, i18n, r2 등 46 모듈 |
| `middleware.ts` | 로케일 쿠키 (국가 + Accept-Language) |
| `vercel.json` | cron: retention / promo-expiry / subscription-expiry |
| `scripts/` | 상표 로고 생성 스크립트 1개 |
| `types/` | next-auth · heic2any 타입 선언 |

### 주요 페이지
`/` · `/generate` · `/styles` · `/gallery` · `/gallery/my` · `/pricing` · `/profile` · `/support` · `/terms` · `/privacy` · `/admin` · `/admin/promotions`

### 프로바이더 계층 (`app/layout.tsx`)
`I18nProvider` → `AuthSessionProvider` → `CreditsProvider` → 페이지 + 전역 모달(Auth/Payment/Credit/Promotion)

---

## 2. 주요 핵심 기능 구현 상태

### 기능별 진단

| 기능 | 상태 | 진단 |
|------|------|------|
| AI 생성 워크플로우 | 부분 구현 | 요청 스키마·크레딧 API·face payload는 있음. 실추론은 mock 폴백, blob 업로드 한계, 실패 환불 없음 |
| Stripe (글로벌) | 초기 결제 OK | Checkout·webhook·portal·cancel/resume 동작. 갱신(`invoice.paid`) 크레딧 미부여 |
| Toss / PortOne | 미완성 | Toss confirm 스텁만. PortOne은 env 선택만. UI에 PG 위젯 없음 |
| 스타일 메타 / 태그 | 양호 | 8팩 정합, traditional 그룹, emerald 태그. 구 `cultural-elegance` 키 잔존 없음 |
| 갤러리 / 저장 | 로컬 중심 | 히스토리·서포트 티켓·얼굴 프로필이 localStorage. 기기 간 동기화 없음 |

### 결제 흐름 요약
1. UI → `POST /api/payments/create`
2. `locale === "kr"` → 국내(Toss 키 있으면 Toss, 없으면 PortOne, 없으면 demo)
3. 그 외 → Stripe(키 있으면) / demo
4. `createCheckoutForOrder`는 **Stripe만** `checkoutUrl` 생성
5. UI는 URL이 있으면 리다이렉트, 없으면 localhost에서만 demo confirm
6. **결과:** 국내 실결제 키를 넣어도 위젯이 없어 `checkout unavailable` 실패 가능

### AI 생성 흐름 요약
1. `PersonaCreator` → faceConsistency payload
2. `POST /api/generate` → **크레딧 선차감**
3. `runFaceConsistentInference` (Replicate/RunPod/ComfyUI/mock)
4. 클라이언트 갤러리 업로드 · 다운로드 시 워터마크(무료)
5. **문제:** 셀카가 `blob:` URL이라 GPU 제공자가 fetch 불가 → mock/히어로 이미지로 “성공처럼” 보일 수 있음. 실패 시 환불 없음

### 스타일 팩 정합 (8개)
`luxury-lifestyle`, `cinematic-poster`, `business-executive`, `cultural-elegance-east`, `cultural-elegance-west`, `classic-western`, `neon-urban`, `soft-studio`  
→ `lib/data.ts` · `lib/i18n/types.ts` · `en.ts` · `kr.ts` 정합 확인. ja/zh는 일부 오버라이드, 기타 로케일은 en 상속.

---

## 3. UI/UX 및 디자인 일관성

### 개선된 점
- 컨셉 카드 태그: emerald / violet 고대비 (`PersonaCreator`, `StyleCollection`)
- 요금제 월/연 토글: `border-white/40` (`PricingSection`)
- Stepper 비활성 명도: `zinc-200` (`PersonaCreator`)

### 잔여 약점
| 구분 | 내용 | 위치 |
|------|------|------|
| 저대비 | Footer / placeholder `text-white/30~40` | Footer, PersonaCreator |
| 저대비 | `.btn-secondary` `border-white/10` | globals.css |
| i18n | Navbar 프로모 문구 한국어 하드코딩 | Navbar |
| 반응형 | 대체로 양호. 모바일 stepper는 아이콘만. Navbar 밀도 주의 | PersonaCreator, Navbar |

**UI 총평:** 다크 테마 위자드/갤러리의 최근 가독성 보정은 유효. Footer·placeholder·secondary는 여전히 약함. 반응형은 대체로 무난.

---

## 4. 코드 품질 · 예외 처리 · 보안

| 심각도 | 이슈 | 위치 |
|--------|------|------|
| Critical | Email credentials 비밀번호 미검증 상시 ON | `lib/auth.ts` |
| Critical | `PAYMENT_WEBHOOK_SECRET` 없으면 웹훅 공개 | `app/api/payments/webhook` |
| Critical | `creditCost` 클라이언트 신뢰 | `app/api/generate` |
| High | AUTH_SECRET / PROMO 기본값 하드코딩 폴백 | auth.ts, promotions.ts |
| High | 생성 실패 시 empty catch → 히어로 이미지 위장 성공 | PersonaCreator |
| High | 스토리지 업로드 인증 없음 | `api/storage/upload` |
| Medium | API body `as` 캐스트, Zod 미사용 | payments/*, generate |
| Medium | 인메모리 rate limit (서버리스에서 무력화) | `lib/rateLimit.ts` |
| Low | TypeScript `any` 거의 없음 · tsc 통과 가능 수준 | 전역 |

### 환경변수 · 보안
- `.env`는 `.gitignore`에 포함 (커밋 대상 아님 확인)
- `.env.example`에 **실제 사업자 연락처·이메일**이 들어 있음 → 공개 저장소면 플레이스홀더로 교체 권장
- 프로덕션 필수: `AUTH_SECRET`, OAuth 키, `STRIPE_*`, Toss/PortOne, `PAYMENT_WEBHOOK_SECRET`, `CRON_SECRET`, `PROMO_CODE_SECRET`, R2, AI 토큰, `ADMIN_EMAILS`
- `ALLOW_CREDENTIALS_ADMIN=false` 유지 필수

### 고객센터/갤러리 한계
- 지원 티켓·갤러리 히스토리가 **브라우저 localStorage** → 관리자 페이지가 실제 유저 문의를 보지 못함, 기기 간 동기화 없음

---

## 5. 정식 배포 전 필수 해결 과제

### P0 — 배포 차단 (즉시)
| ID | 결함 | 상세 |
|----|------|------|
| P0-1 | 국내 PG 클라이언트 미구현 | Toss/PortOne SDK·위젯 없음. KR은 주문만 만들고 checkoutUrl 비어 실패 |
| P0-2 | PortOne은 env·라벨만 | API/confirm/공식 웹훅 없음 |
| P0-3 | 국내 웹훅 시크릿 선택적 | 시크릿 없으면 누구나 주문을 paid로 마킹 가능 |
| P0-4 | 로컬 JSON DB | Vercel 멀티 인스턴스에서 정합 불가 |
| P0-5 | Stripe 갱신 크레딧 미지급 | `invoice.paid`는 lifecycle만 ACTIVE |
| P0-6 | AI mock + blob 셀카 | GPU fetch 불가, 선차감·환불 없음 |
| P0-7 | creditCost 클라이언트 조작 | 0으로 과금 우회 가능 |
| P0-8 | 비밀번호 없는 Credentials | 이메일만으로 로그인/계정 생성 |

### 체크리스트 (우선순위)

**P0**
1. Toss/PortOne 결제위젯 + 서버 confirm + 공식 웹훅 스키마 구현
2. `PAYMENT_WEBHOOK_SECRET` / `STRIPE_WEBHOOK_SECRET` 필수화 + 서명 검증 강화
3. Postgres 등 공유 DB로 users·orders·ledger 이전
4. Stripe `invoice.paid`에서 플랜 기간 크레딧 부여
5. 셀카를 R2 공개/서명 URL로 업로드 후 AI 제공자에 전달
6. 서버 고정 `creditCost` · 비로그인 생성 차단 또는 엄격 한도
7. Credentials 프로바이더 프로덕션 비활성 또는 실비밀번호/OTP
8. `AUTH_SECRET`·`PROMO_CODE_SECRET` 강제 (기본값 금지)

**P1**
9. 추론 실패 시 크레딧 환불 트랜잭션
10. `/api/storage/upload` 인증 + 소유권 검증
11. 갤러리/티켓 서버 저장 (admin이 실제 유저 문의 조회)
12. Redis 등 분산 rate limit
13. 라이브/테스트 키 환경 분리 및 demo 체크아웃 프로덕션 차단 강화

**P2**
14. 워터마크 서버사이드 강제 · 주문 failed/cancelled 상태 기록
15. 잔여 저대비 텍스트·Navbar/플랜명 i18n 정리
16. `.env.example`의 실제 사업자 PII를 플레이스홀더로 교체

---

## 우수한 점

1. Next.js 15 App Router 전용 구조(12 페이지 · 21 API)가 명확하고 Pages Router 혼재 없음
2. 위자드 3단계(컨셉→대상→업로드) + 스마트 스킵(`?style=`) + 결과 액션 플로우가 UX상 잘 정리됨
3. 스타일 팩 8개 ID가 types/en/kr와 정합; 전통(동양/서양) 분리 및 뱃지 오버라이드 동작
4. Stripe Checkout + 서명 검증 웹훅 + 포털/해지/재개 골격이 실동작 수준
5. 구독 상태머신(ACTIVE / CANCELED_PENDING / EXPIRED)과 결제 실패 시 즉시 Free 전환 정책 반영
6. R2 듀얼 해상도·보관 정책·cron retention 설계가 있음
7. 10개 로케일 골격 + KR 사업자 고지·약관/개인정보·VAT 안내 등 커머스 표면 구비

---

## 권장 다음 단계

1. **P0 보안·DB·크레딧 고정** 먼저  
2. **셀카 R2 업로드 + 실 AI 프로바이더** 연결  
3. **Toss 위젯 연동**(국내)  
4. **Stripe 갱신 크레딧** 부여  
5. **소프트론치(Stripe-only 해외)** 후 국내 PG 승인  

소프트론치만 목표라면: **Stripe 경로 + Credentials 차단 + 공유 DB + 웹훅 시크릿 강제**까지가 최소선입니다.

---

## 부록 A — API 라우트 목록

| 영역 | 경로 |
|------|------|
| Auth | `/api/auth/[...nextauth]` |
| Account | `/api/account/me` |
| Generate | `/api/generate` |
| Business | `/api/business` |
| Storage | `/api/storage/upload`, `/api/storage/original/[id]` |
| Promotions | `/api/promotions/activate`, `/me`, `/clear` |
| Admin | `/api/admin/promotions` |
| Payments | `create`, `confirm`, `webhook`, `stripe/webhook`, `portal`, `receipts`, `subscription/cancel`, `subscription/resume` |
| Cron | `/api/cron/retention`, `promotion-expiry`, `subscription-expiry` |

## 부록 B — 핵심 컴포넌트

Navbar, Footer, HeroSection, PersonaCreator, StyleCollection, LivePreviewCanvas, PricingSection, ThumbnailEditor, MyGalleryTabs, FaceProfileSlots, AuthModal, PaymentModal, CreditTopUpModal, CreditDepletionModal, PromotionCodeModal, PromotionAdminDashboard, PaymentReturnBanner, ReturnUserModal, SupportTicketForm, LegalDocumentView, LanguageSelector, HashScroll, BrandWatermark, GoogleFontsLoader, I18nProvider, AuthSessionProvider, CreditsProvider

## 부록 C — 평가 한계

- 본 문서는 **소스 정적 분석** 기반입니다.
- 실제 Toss/PortOne/Stripe 라이브 키·PG 심사·도메인 SSL·운영 모니터링 설정 상태는 환경에 따라 달라질 수 있습니다.
- Cursor Canvas 버전: `full-codebase-audit.canvas.tsx` (IDE 내 인터랙티브 요약)

---

*문서 끝 — Studio Canvas AI 전체 소스 정밀 평가서*
