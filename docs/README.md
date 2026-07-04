# Docs README

이 디렉터리는 현재 메인 실행환경인 `pnpm workspace + artifacts/*` 구조를 기준으로 문서를 관리합니다.

## Canonical Runtime

현재 기준 런타임:

- Frontend: `artifacts/agent-pay-for-urself/`
- Backend: `artifacts/api-server/`
- Shared libraries: `lib/`

레거시 Python/Next.js 구조는 `.migration-backup/`로 이동한 참조본이며, 이 `docs/`의 기본 문서화 대상이 아닙니다.

## Documentation Scope

이 폴더 문서는 아래 항목을 우선 설명합니다.

- 현재 프론트/백엔드 실행 방식
- 현재 API 계약과 타입 공유 구조
- 현재 저장소 디렉터리 책임
- 현재 제품 화면과 사용자 흐름
- 현재 마이그레이션 상태와 운영상 주의점

## Update Rule

다음이 바뀌면 문서를 함께 갱신합니다.

- `artifacts/agent-pay-for-urself/`의 라우팅, 화면 구조, API 호출 방식
- `artifacts/api-server/`의 엔드포인트, 실행 방식, 포트 규칙
- `lib/`의 코드젠, DB, API 계약 구조
- `.migration-backup/`의 역할 정의

## Legacy Note

예전 Python 백엔드와 Next.js 프론트 관련 문서는 `.migration-backup/docs/`를 참조합니다. 현재 루트 `docs/`는 메인 런타임 기준 문서만 유지합니다.
