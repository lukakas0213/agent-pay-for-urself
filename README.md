# agent-pay-for-urself

현재 이 저장소의 메인 실행환경은 `pnpm workspace + Vite frontend + Node.js API` 구조입니다.

로컬과 Replit에서 동일하게 기준이 되는 앱은 아래 두 개입니다.

- `artifacts/agent-pay-for-urself/` — 메인 프론트엔드
- `artifacts/api-server/` — 메인 백엔드 API

예전에 사용하던 Python 백엔드와 Next.js 프론트 구조는 메인 런타임이 아니며, `.migration-backup/` 아래에 레거시 참조본으로 보관합니다.

## Current Structure

- `artifacts/agent-pay-for-urself/` — Vite + React 프론트엔드
- `artifacts/api-server/` — Express 기반 Node.js API 서버
- `artifacts/mockup-sandbox/` — 디자인/목업 실험 공간
- `lib/` — API spec, generated client, Zod schema, DB 라이브러리
- `scripts/` — 저장소 보조 스크립트
- `docs/` — 현재 메인 구조 기준 문서
- `.migration-backup/` — 이전 Python/Next.js 구조 백업

## Local Development

기준 툴체인:

- Node.js `24`
- pnpm `9.15.9`

로컬 Node가 `18.x`면 프론트엔드가 실행되지 않습니다. 프론트는 `Vite 7`을 사용하므로 최소 Node `20.19+` 또는 `22.12+`가 필요하고, 이 저장소의 기준은 Node `24`입니다.

Node 24 준비 예시:

```bash
nvm use 24
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

`nvm`, `corepack`, `pnpm`이 없는 Ubuntu 기본 환경이면 아래 스크립트로 저장소 로컬에만 Node 24와 pnpm 9.15.9를 준비할 수 있습니다.

```bash
bash scripts/bootstrap-node24.sh
export PATH="$PWD/.local-tools/bin:$PWD/.local-tools/node-v24.18.0-linux-$(uname -m | sed 's/aarch64/arm64/; s/x86_64/x64/')/bin:$PATH"
```

의존성 설치:

```bash
pnpm install
```

`nvm` 대신 로컬 부트스트랩을 사용한 경우에는 같은 셸에서 아래처럼 실행합니다.

```bash
PATH="$PWD/.local-tools/bin:$PWD/.local-tools/node-v24.18.0-linux-$(uname -m | sed 's/aarch64/arm64/; s/x86_64/x64/')/bin:$PATH" pnpm install
```

실행 전 `.env`를 로드합니다. 이 저장소는 `.env`를 자동으로 읽지 않습니다.
기본 템플릿은 루트의 `.example.env`입니다. 이를 복사해 `.env`를 만들면 됩니다.

```bash
cd /home/ubuntu/Desktop/lucas/agent-pay-for-urself
set -a
source .env
set +a
```

실행 순서:

```bash
# 1) 백엔드 (코드 수정 시 자동 재빌드/재시작)
PORT=5000 pnpm --filter @workspace/api-server run dev

# 2) 프론트엔드 (Vite HMR)
PORT=23827 BASE_PATH=/ API_PORT=5000 pnpm --filter @workspace/agent-pay-for-urself run dev
```

접속 주소:

- Frontend: `http://localhost:23827`
- Backend health: `http://127.0.0.1:5000/api/health` 또는 프론트 경유 `/api/health`

## Environment Notes

- `DATABASE_URL` — 현재 DB 라이브러리 초기화에 필요
- `PORT` — 백엔드 필수
- `API_PORT` — 프론트 프록시 대상 포트
- `BASE_PATH` — 프론트 base path, 로컬은 `/`

## Legacy Layout

아래 경로들은 현재 메인 실행 대상이 아닙니다.

- `.migration-backup/agent_pay_for_urself/`
- `.migration-backup/tests/`
- `.migration-backup/frontend/`
- `.migration-backup/docs/`

레거시 구조를 다시 사용하거나 비교해야 할 때만 참조합니다. 현재 기능 추가와 배포 기준은 루트 워크스페이스와 `artifacts/*`입니다.
