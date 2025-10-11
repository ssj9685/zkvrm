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

## 💾 데이터베이스 스냅샷 업로드

서버는 `zkvrm.sqlite`를 주기적으로 스냅샷으로 생성해 지정한 S3 버킷에 업로드합니다. 기본 주기는 1시간이며, 처음 실행 후 약 10초 뒤에 첫 업로드가 이루어집니다. 다음 환경 변수를 사용해 동작을 제어할 수 있습니다.

| 환경 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `S3_SNAPSHOT_BUCKET` | 스냅샷을 업로드할 S3 버킷 이름 **(필수)** | 없음 |
| `S3_SNAPSHOT_URI` | `s3://bucket/optional/prefix` 형식으로 버킷과 경로를 한 번에 지정 | 없음 |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | S3 클라이언트 리전 | 없음 (필수 중 하나) |
| `S3_SNAPSHOT_PREFIX` | 업로드 시 사용할 경로 prefix (`logs/db/` 등). 끝의 `/`는 자동으로 추가됩니다. | 빈 문자열 |
| `S3_SNAPSHOT_INTERVAL` / `S3_SNAPSHOT_INTERVAL_MS` | 스냅샷 주기. `15m`, `6h`, `86400000`(ms) 형태 지원 | `1h` |
| `S3_SNAPSHOT_INITIAL_DELAY` / `S3_SNAPSHOT_INITIAL_DELAY_MS` | 첫 업로드까지 대기 시간 (`30s`, `5000` 등) | `min(interval, 10s)` |
| `S3_SNAPSHOT_ENDPOINT` | (선택) S3 호환 스토리지 엔드포인트 URL | 설정 안 함 |
| `S3_SNAPSHOT_FORCE_PATH_STYLE` | `true`로 설정 시 path-style URL 사용 | `false` |
| `SQLITE_PATH` | 백업할 SQLite 파일 경로 | `zkvrm.sqlite` |

AWS 자격 증명은 표준 SDK 방식(`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, 프로필 등)을 그대로 따릅니다. 스냅샷 파일은 SQLite의 `VACUUM INTO`를 사용해 임시 디렉터리에 생성한 후 업로드하며, 완료되면 자동으로 정리됩니다.

- `S3_SNAPSHOT_URI`를 사용하면 `S3_SNAPSHOT_BUCKET`과 `S3_SNAPSHOT_PREFIX`를 따로 지정할 필요 없이 `s3://my-bucket/backups/prod`처럼 한 번에 구성할 수 있습니다. 이때 `S3_SNAPSHOT_PREFIX`를 추가로 지정하면 URI 뒤에 하위 경로가 붙습니다.
- 경로 접두사가 비어 있으면 루트에 `zkvrm-<timestamp>-<uuid>.sqlite` 파일이 생성됩니다.

### 수동 업로드 및 검증

- 스케줄러 동작과 별개로 `bun run snapshot:once` 명령으로 즉시 스냅샷을 업로드할 수 있습니다. 이미 업로드가 진행 중이면 `A snapshot upload is already in progress.` 오류가 표시됩니다.
- 명령 실행 후 서버 로그에서 `Uploaded s3://<bucket>/<key>` 메시지를 확인하거나, `aws s3 ls s3://<bucket>/<prefix>` 또는 `aws s3api head-object --bucket <bucket> --key <key>`로 업로드된 파일을 검증하세요.
