# ZKVRM Hand-Drawn Redesign Coding Prompt

이 문서는 현재 `zkvrm` 저장소를 직접 수정할 수 있는 코딩 에이전트에게 전달하는 프로젝트 전용 구조화 프롬프트입니다.

```text
<role>
당신은 Bun + React 19 + Tailwind 기반 ZKVRM 저장소를 직접 수정하고 검증하는 시니어 프런트엔드 코딩 에이전트다. 인증 화면과 메모 브레인 UI를 hand-drawn scrapbook 방향으로 전면 리디자인하되, 기능 구조와 핵심 사용자 흐름은 유지한다.

<context>
프로젝트는 Bun 서버 + React 19 클라이언트 + Tailwind CSS를 사용한다.

주요 구현 진입점:
- /Users/shin/Documents/GitHub/zkvrm/src/client/index.css
- /Users/shin/Documents/GitHub/zkvrm/src/client/components/auth/auth-shell.tsx
- /Users/shin/Documents/GitHub/zkvrm/src/client/pages/memo/index.tsx

공통 UI와 브랜딩 관련 후보:
- /Users/shin/Documents/GitHub/zkvrm/src/client/components/button.tsx
- /Users/shin/Documents/GitHub/zkvrm/src/client/components/input.tsx
- /Users/shin/Documents/GitHub/zkvrm/src/client/components/form-button.tsx
- /Users/shin/Documents/GitHub/zkvrm/src/client/components/popover-menu.tsx
- /Users/shin/Documents/GitHub/zkvrm/src/client/components/toast/toast-overlay.tsx
- /Users/shin/Documents/GitHub/zkvrm/src/client/components/icons/icon.tsx
- /Users/shin/Documents/GitHub/zkvrm/src/client/assets/zkvrm.svg
- /Users/shin/Documents/GitHub/zkvrm/src/client/assets/icons.svg
- /Users/shin/Documents/GitHub/zkvrm/src/client/assets/icons/icon-180.png
- /Users/shin/Documents/GitHub/zkvrm/src/client/assets/icons/icon-192.png
- /Users/shin/Documents/GitHub/zkvrm/src/client/assets/icons/icon-512.png

인증 엔트리:
- /Users/shin/Documents/GitHub/zkvrm/src/client/pages/auth/login-page.tsx
- /Users/shin/Documents/GitHub/zkvrm/src/client/pages/auth/register-page.tsx

기존 검증 경로:
- /Users/shin/Documents/GitHub/zkvrm/tests/e2e/desktop-brain.spec.ts
- /Users/shin/Documents/GitHub/zkvrm/tests/e2e/mobile-layout.spec.ts
- /Users/shin/Documents/GitHub/zkvrm/tests/e2e/visual/memo-brain-atlas-noir.spec.ts
- /Users/shin/Documents/GitHub/zkvrm/tests/e2e/visual/memo-brain-atlas-noir.spec.ts-snapshots

현재 UI는 이미 warm paper/post-it atlas에 가깝지만, 여전히 너무 정돈되어 있고 polished SaaS 느낌이 남아 있다. 이번 작업은 단계적 조정이 아니라 auth + memo 앱의 강한 시각 교체다.

레퍼런스 우선순위:
1. Tally: 넉넉한 여백, 단순한 정보 계층, 차분한 흐름
2. Mailchimp: 캐릭터성, 손맛, 낙서/스티커/테이프, 장난스러운 존재감
3. Buffer: 정보 정리감과 읽기 쉬운 카드 구조
4. Pitch: 자신감 있는 타이포와 프레젠테이션 감도

본문 언어는 한국어 중심으로 유지하고, 영어는 짧은 배지와 보조 라벨에만 제한한다.

<task>
1. 현재 구현을 읽고 auth, memo, shared UI, brand assets의 현 상태를 짧은 Design Spec으로 요약한다.
2. 전역 디자인 토큰을 hand-drawn scrapbook 시스템으로 재정의한다. warm paper palette, ink navy text, coral/mint/sunflower/moss accents, irregular borders, paper shadows, tape/pin/sticker motifs, Gaegu display type, Space Grotesk accent type, Pretendard body type를 반영한다.
3. 공통 UI 컴포넌트를 새 시각 시스템으로 통일한다. 버튼, 입력, 폼 버튼, 토스트, 팝오버, 칩, 카드, 포커스 상태를 같은 세계관으로 맞춘다.
4. 브랜딩을 리프레시한다. 메인 로고, 축약 아이콘, favicon 계열 아이콘을 같은 손잉크/스크랩북 조형 언어로 정리한다.
5. AuthShell과 로그인/회원가입 경험을 메모 화면과 같은 세계관으로 전면 재구성한다. 비대칭 레이아웃, 종이 카드, 테이프, 낙서형 라벨, 포스트잇 프리뷰를 사용하되 폼 컬럼은 안정적으로 정렬한다.
6. memo fullscreen atlas UI를 더 강한 hand-drawn board로 밀어붙인다. 상단 rail, 리스트 패널, 선택 에디터, 모바일 시트, 노드, 연결선, 빈 상태, organize/filter chrome을 모두 같은 시각 언어로 재설계한다.
7. 한국어 카피 원칙을 유지하면서 영문은 짧은 badge와 accent label에만 사용한다.
8. 기존 기능 구조, stores, API, DB schema, test IDs, 주요 사용자 흐름은 유지한다.
9. 구현 후 디자인 변화에 맞춰 Playwright 및 visual snapshot coverage를 업데이트한다. memo brain 핵심 플로우는 유지하고, auth visual regression은 /Users/shin/Documents/GitHub/zkvrm/tests/e2e/visual/auth-shell.spec.ts 로 새로 추가한다.
10. 마지막에 bun 기반 build와 핵심 E2E/visual tests를 실행하고 결과를 보고한다.

<rules>
- 첫 응답의 첫 섹션은 짧은 Design Spec이어야 한다. 이 섹션은 6-12개 정도의 고신호 항목으로 끝내고, 그다음 곧바로 구현을 진행한다. 명세만 내고 멈추지 말라.
- 새 런타임 UI 프레임워크, animation library, design system library는 추가하지 말라. CSS, SVG, 기존 React/Tailwind 구조만 사용하라.
- 텍스처용 래스터 이미지를 배경에 깔지 말라. 종이, 그림자, 테이프, 스크리블, 핀, 스티커 느낌은 CSS와 SVG로 만들어라.
- 입력 필드, 검색, 핵심 CTA는 안정 정렬과 높은 가독성을 유지하고, 카드, 배지, 보조 패널, 장식에서만 의도적 비대칭과 회전을 강하게 사용하라.
- direct observation과 inferred decision을 구분하라. 레퍼런스에서 바로 읽히는 패턴과, 구현을 위해 정규화한 토큰과 룰을 섞지 말라.
- 기능 회귀를 만들지 말라. memo 브레인 생성, 선택, 연결, 색상 변경, 글로벌 검색, 브레인 검색, 리스트 패널, 모바일 시트, auth 진입과 전환 흐름은 유지되어야 한다.
- 기존 테스트 ID는 유지하고, 꼭 필요한 경우에만 최소한으로 추가하라.
- 디자인 명세, 구현, 검증 보고 모두 한국어로 쓰되, 파일 경로, 명령, 토큰 이름은 그대로 유지하라.
- visual baseline이 의도적으로 달라지면 snapshot 파일을 업데이트하고, 그 사실을 Verification 섹션에 명시하라.
- 불필요한 대규모 구조 변경이나 서버 계약 변경은 하지 말라.

<constraints>
- 구현 범위는 인증 화면과 메모 앱 UI에 한정한다.
- 서버 API, SQLite schema, store 계약은 바꾸지 않는다.
- 본문용 폰트는 Pretendard를 유지하고, display용으로 Gaegu를 추가한다. accent용 짧은 영문 라벨만 Space Grotesk를 쓴다.
- 색 방향은 warm paper base + ink navy text + coral/mint/sunflower/moss accent로 고정한다.
- motion set은 draw-in, paper-float, wobble, stagger-rise, stamp-pop으로 제한하고, prefers-reduced-motion에서 약화 또는 정지해야 한다.
- 결과는 평범한 예쁜 SaaS 대시보드처럼 보이면 실패다. 다만 난잡하거나 읽기 어려워져도 실패다.
- 계획 문서, 옵션 나열, 시안 비교로 끝내지 말라. 실제 코드 수정과 검증까지 완료하라.

<output-format>
Design Spec
- 현재 UI 문제 진단과 새 시각 시스템 핵심 원칙을 짧게 정리한다.

Implementation
- 실제로 바꾼 내용을 사용자 관점과 시스템 관점에서 압축해서 설명한다.
- 중요한 파일 경로를 포함한다.

Verification
- 실행한 명령을 적는다.
- 통과/실패 결과를 적는다.
- visual snapshot 갱신 여부를 적는다.

Open Risks
- 남은 리스크나 테스트 공백이 있으면 짧게 적는다. 없으면 없다고 명시한다.

<design-analysis>
Observed
- Tally는 넓은 여백, 절제된 레이아웃, 단순한 정보 계층, 과장되지 않은 인터랙션을 통해 기본 구조를 차분하게 만든다.
- Mailchimp는 불균일한 형태, 캐릭터성 있는 장식, 강한 브랜드 개성, 장난스러운 모션 감각을 사용해 화면 자체에 성격을 부여한다.
- Buffer는 제품 정보가 산만해지지 않도록 카드 구조와 텍스트 계층을 안정적으로 정리한다.
- Pitch는 타이포 대비와 프레젠테이션 감도의 hero composition으로 제품 화면을 더 자신감 있게 보이게 한다.

Inferred
- 이 프로젝트는 Tally의 spacing discipline 위에 Mailchimp식 hand-drawn character를 얹고, Buffer와 Pitch를 사용해 정보 밀도와 typographic confidence를 보정해야 한다.
- memo atlas와 auth는 서로 다른 테마가 아니라 같은 scrapbook 세계관으로 보이도록 통일해야 한다.
- 현재 warm paper 기반은 유지하되, brown-only 계열에서 벗어나 ink navy와 playful accent를 넣어 더 현대적이고 선명한 대비를 만들어야 한다.
- 불규칙성은 장식과 카드 레이어에서 크게, 입력과 핵심 조작에서는 작게 써야 제품성이 유지된다.

<design-tokens>
colors:
  primary:
    ink_navy: "#22324A"
  secondary:
    kraft: "#CBAE84"
  accent:
    coral: "#E57A61"
    mint: "#8FC8B5"
    sunflower: "#E3BF58"
    moss: "#839A5A"
  background:
    canvas: "#F7EFDF"
    parchment: "#EEDFC7"
  surface:
    paper: "#FFF9EF"
    elevated: "#FFFDF7"
    muted: "#F3E9D8"
  text:
    primary: "#22324A"
    secondary: "#59657A"
    tertiary: "#7C857F"
  border:
    soft_ink: "#B9A183"
    sketch: "#31405C"

typography:
  heading:
    family: "Gaegu"
    usage: "페이지 제목, 큰 badge, 손글씨 라벨, 스크리블 콜아웃"
  body:
    family: "Pretendard"
    usage: "본문, 입력, 리스트, 버튼, 오류, 설명문"
  accent:
    family: "Space Grotesk"
    usage: "짧은 영문 badge, 작은 section label, 제품성 보조 타이포"
  scale:
    hero: "40-56px"
    section: "24-32px"
    body: "14-16px"
    label: "11-13px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "48-72px"

radius:
  chip: "12px"
  control: "16px"
  card: "28px"
  sheet: "32px"
  note_corner_variation: "각 카드마다 2-4px 정도의 시각적 불균일 허용"

shadow:
  paper_lift: "0 12px 30px -18px rgba(34,50,74,0.18)"
  paper_stack: "0 22px 48px -26px rgba(34,50,74,0.22)"
  board_depth: "0 36px 84px -44px rgba(34,50,74,0.28)"

layout:
  grid:
    desktop: "12-column feel with intentional asymmetric offsets"
    mobile: "single column with 16-20px gutters"
  container:
    auth: "centered board up to ~1280px with split scrapbook composition"
    memo: "100dvh fullscreen atlas shell with top rails and floating side surfaces"
  motion:
    draw_in: "120-180ms line or scribble reveal"
    paper_float: "subtle 6-10px lift on appear or select"
    wobble: "2-4deg playful hover or emphasis"
    stagger_rise: "40-80ms stagger across grouped cards"
    stamp_pop: "0.96 -> 1.03 -> 1 scale accent"
</design-tokens>
```

## Verification Commands

구현 에이전트가 완료 후 최소한 아래 명령을 실행하도록 설계되어 있습니다.

```bash
bun run build
bunx playwright test \
  tests/e2e/desktop-brain.spec.ts \
  tests/e2e/mobile-layout.spec.ts \
  tests/e2e/visual/memo-brain-atlas-noir.spec.ts \
  tests/e2e/visual/auth-shell.spec.ts \
  --reporter=line
```
