# AGENTS.md

이 문서는 에이전트가 이 저장소에서 작업할 때 가장 먼저 확인해야 하는 저장소 전용 기준이다.
시스템 구조, 파이프라인 계약, 단계별 책임은 `docs/` 아래 문서에서 관리하므로 여기에는 작업 운영 규칙만 둔다.

## Agent Instructions & Guidelines

### 0. 작업 기준
- 현재 구현과 현재 문서에 남아 있는 계약을 기준으로 작업한다.
- 삭제되었거나 대체된 과거 동작은 현재 계약에 남아 있지 않으면 코드, 문서, 테스트, 리뷰 산출물에 보존하지 않는다.
- 사용자가 호환성 유지 범위나 제거 대상을 명시하면 그 결정을 현재 작업의 계약으로 삼는다.
- 요구사항, 계약, 호환성, 검증 방식처럼 작업 결과에 영향을 주는 지점이 모호하거나 결정이 필요하면 임의로 확정하지 말고 먼저 사용자에게 질문해 합의한 뒤 진행한다.
- 작업 성격에 맞는 기준 문서를 먼저 읽고, 세부 계약은 `docs/`의 대응 문서를 따른다.

### 1. 실행 규칙
- Python 실행은 가상 환경을 직접 활성화하지 말고 항상 `UV_CACHE_DIR=/tmp/uv-cache uv run python`을 사용한다.
- `uv run`이 포함된 모든 명령은 항상 앞에 `UV_CACHE_DIR=/tmp/uv-cache`를 붙인다.
- 개발 서버 실행은 `UV_CACHE_DIR=/tmp/uv-cache uv run poe dev`를 사용한다.
- 테스트 실행은 먼저 구현을 마친 뒤 `UV_CACHE_DIR=/tmp/uv-cache uv run pytest` 또는 `UV_CACHE_DIR=/tmp/uv-cache uv run poe test`를 사용한다.
- 구현과 테스트가 성공한 뒤에만 formatting과 linting을 진행한다.
- formatting은 `UV_CACHE_DIR=/tmp/uv-cache uv run ruff format .`을 사용한다.
- 최종 lint 검사는 `UV_CACHE_DIR=/tmp/uv-cache uv run ruff check .` 또는 `UV_CACHE_DIR=/tmp/uv-cache uv run poe lint`를 사용한다.
- 이 저장소에는 현재 별도 type checker 명령이 정의되어 있지 않으므로 타입 검사는 사용자 요청이나 도입 전까지 기본 필수 단계로 가정하지 않는다.
- 테스트나 Ruff를 실행할 수 없는 상황이면 사유와 남은 위험을 작업 결과에 명확히 남긴다.

### 2. 코드 작성 규칙
- 현재 코드 스타일과 기존 설계 의도를 우선 따른다.
- 새로 추가하거나 수정한 함수에는 역할, 기대 입력과 출력, 중요한 부작용이나 제약을 설명하는 주석을 필요할 때 작성한다.
- 알고리즘, 분기 기준, 상태 변화, 예외 처리처럼 흐름을 바로 이해하기 어려운 지점에는 왜 그 방식이 필요한지 설명하는 주석을 둔다.
- 자명한 처리를 반복 설명하지 말고 독자가 의도를 빠르게 파악해야 하는 핵심 지점에만 주석을 둔다.
- Type Hint를 유지하고, 비즈니스 로직과 인프라 로직을 분리한다.
- 에이전트 간 직접 의존을 만들지 말고 Orchestrator 중심 구조를 유지한다.
- 모든 에이전트 입출력은 구조화된 스키마를 사용한다.

### 3. 문서 작성 규칙
- 코드에 추가나 변경 사항이 있으면 문서 또한 실시간으로 수정해 싱크를 맞춘다.
- 백엔드 공개 API 계약에 영향을 주는 변경이 있으면 `docs/api-contracts.md`를 같은 작업에서 반드시 함께 갱신한다.
- 특히 `agent_pay_for_urself/api/routes/`, `agent_pay_for_urself/api/models/`, `agent_pay_for_urself/api/services/`, `agent_pay_for_urself/api/mappers/workflow.py` 변경 시 API 명세 최신화를 필수 단계로 본다.
- 문서를 새로 작성하거나 수정할 때는 먼저 `docs/DOCS_GUIDE.md`를 읽고 그 구조, 문서 단위, 유지 규칙을 따른다.
- `docs/` 디렉터리의 시작점은 `docs/README.md`이며, 새로운 세부 문서를 추가할 때는 index 성격의 문서도 함께 갱신한다.
- 각 문서는 자신이 설명하는 범위, 관련 코드 경로, 언제 갱신해야 하는지를 빠르게 판단할 수 있게 작성한다.
- 계약에 큰 영향을 주지 않는 구현 세부사항은 문서에 과도하게 적지 말고 코드 주석으로 남긴다.

### 4. 테스트 작성 규칙
- 테스트를 새로 작성하거나 수정할 때는 먼저 `docs/TESTS_GUIDE.md`를 읽고 그 작성 기준과 유지 규칙을 따른다.
- 테스트는 public behavior, business contract, repo-relative entrypoint를 중심으로 현재 계약을 검증한다.
- 문서 정리, 로컬 워크플로우, 에이전트 보조 메모처럼 서비스 계약과 직접 관련 없는 변경에는 `tests/` 아래 테스트를 추가하지 않는다.

### 5. 리뷰 규칙
- 리뷰 요청은 버그, 회귀, 계약 불일치, 누락된 검증을 우선해 확인한다.
- 문서는 `docs/DOCS_GUIDE.md`, 테스트는 `docs/TESTS_GUIDE.md` 준수 여부도 함께 본다.
- 리뷰 판단 기준은 현재 코드와 문서에 남아 있는 계약이다.
- 필요 시 `UV_CACHE_DIR=/tmp/uv-cache uv run pytest`, `UV_CACHE_DIR=/tmp/uv-cache uv run poe test`, `UV_CACHE_DIR=/tmp/uv-cache uv run ruff check .`로 검증한다.

### 6. scratchpad 규칙
- `.codex-local/`은 필요할 때만 쓰는 비공개 scratchpad 폴더로 취급하고, 공개 계약 문서의 단일 진실 공급원으로 사용하지 않는다.
- scratchpad 메모는 사용자가 요청했거나 복잡한 작업을 정리할 필요가 있을 때만 만든다.
- scratchpad에 적은 임시 판단은 코드, 테스트, 문서 계약으로 승격되기 전까지 저장소 공식 기준으로 간주하지 않는다.

### 7. 필요 시 참고할 문서
- `docs/README.md`: 현재 문서 트리의 시작점과 탐색 기준.
- `docs/project-overview.md`: 프로젝트 목표, 범위, 기본 브로커 방향.
- `docs/architecture.md`: 에이전트 흐름, 브로커 어댑터 경계, 최소 구현 상태.
- `docs/agent-structure.md`: 에이전트 역할, 데이터 흐름, 책임 분담.
- `docs/domain-rules.md`: 투자 판단 원칙, 금지 사항, 도메인 제약.
- `docs/DOCS_GUIDE.md`: 문서 구조와 갱신 규칙.
- `docs/TESTS_GUIDE.md`: 테스트 작성, 수정, 리뷰 기준.
- `docs/api-contracts.md`: 현재 백엔드 공개 API 명세와 요청/응답 계약.
- `docs/korea-investment-api.md`: 한국투자 Open API 사용 설명서.
