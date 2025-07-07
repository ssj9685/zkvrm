# ZKVRM Memo App

ZKVRM은 Bun, React, TypeScript를 기반으로 구축된 미니멀하고 빠른 웹 기반 메모 애플리케이션입니다. 서버사이드 렌더링과 클라이언트 사이드 인터랙션을 결합하여 사용자에게 쾌적한 경험을 제공하며, 모든 메모 데이터는 SQLite 데이터베이스에 안전하게 저장됩니다.

## ✨ 주요 기능

- **빠른 반응성**: Bun 런타임을 사용하여 서버를 구축하고, React를 통해 동적인 UI를 구현하여 빠른 속도를 자랑합니다.
- **간결한 UI**: 흑백의 무채색 테마와 직접 제작한 선 기반 SVG 아이콘을 사용하여 사용자가 콘텐츠에 집중할 수 있는 미니멀한 디자인을 제공합니다.
- **메모 관리 (CRUD)**: 새로운 메모를 생성하고, 내용을 수정하며, 필요 없는 메모는 삭제할 수 있는 기본적인 CRUD 기능을 모두 지원합니다.
- **전체 메모 다운로드**: 모든 메모를 하나의 `gzip` 압축 파일(`memos.txt.gz`)로 다운로드할 수 있습니다.
- **상태 관리**: `@ga-ut/store`를 활용하여 클라이언트의 상태를 효율적으로 관리하고, 서버와의 데이터 동기화를 처리합니다.

## 🛠️ 기술 스택

- **런타임**: [Bun](https://bun.sh/)
- **프레임워크**: [React](https://react.dev/)
- **언어**: [TypeScript](https://www.typescriptlang.org/)
- **데이터베이스**: [Bun SQLite](https://bun.sh/docs/api/sqlite)
- **스타일링**: [Tailwind CSS](https://tailwindcss.com/)
- **상태 관리**: `@ga-ut/store`

## 🚀 시작하기

### 1. 사전 요구사항

- [Bun](https://bun.sh/) (v1.2.17 이상)이 설치되어 있어야 합니다.

### 2. 설치

프로젝트를 클론하고 필요한 의존성을 설치합니다.

```bash
git clone <repository-url>
cd zkvrm
bun install
```

### 3. 개발 서버 실행

개발 모드에서 프로젝트를 실행하려면 다음 명령어를 사용하세요. Hot-reloading이 활성화되어 코드 변경 시 자동으로 브라우저가 새로고침됩니다.

```bash
bun run dev
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

### 4. 프로덕션 빌드 및 실행

프로덕션을 위해 프로젝트를 빌드하고 최적화하려면 다음 명령어를 사용하세요.

```bash
# 클라이언트 에셋 빌드
bun run build

# 프로덕션 모드로 서버 시작
bun run start
```

## 📁 프로젝트 구조

```
src
├── assets/         # HTML, CSS, SVG 등 정적 에셋
├── domains/        # 비즈니스 로직 및 상태 관리 (memoStore)
├── pages/          # React 페이지 컴포넌트
│   └── memo/       # 메모 페이지 관련 컴포넌트
├── server.tsx      # Bun 서버 및 API 라우팅 로직
└── shared/         # 공유 컴포넌트 및 유틸리티
    ├── components/ # 재사용 가능한 UI 컴포넌트 (Button, Icons)
    └── utils/      # 유틸리티 함수 (fetcher)
```

## 🌐 API 엔드포인트

- `GET /api/memo`: 모든 메모 목록을 조회합니다.
- `POST /api/memo`: 새로운 메모를 생성합니다. (body: `{ "content": "..." }`)
- `PUT /api/memo/:id`: 특정 ID의 메모를 수정합니다. (body: `{ "content": "..." }`)
- `DELETE /api/memo/:id`: 특정 ID의 메모를 삭제합니다.
- `GET /api/memo/download`: 모든 메모를 `gzip` 압축 파일로 다운로드합니다.
