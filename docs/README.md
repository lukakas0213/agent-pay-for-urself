# Docs README

이 디렉터리는 저장소의 구조, 설계, 운영 규칙을 설명하는 문서의 시작점이다.

## 문서 목록

* [project-overview.md](project-overview.md)
  프로젝트 목표, 현재 범위, 기본 브로커 방향을 설명한다.
  프로젝트 방향이 바뀌거나 기본 대상 시장/브로커가 바뀌면 갱신한다.
* [architecture.md](architecture.md)
  에이전트 흐름과 브로커 연동 경계를 설명한다.
  파이프라인 단계, 오케스트레이션 방식, 어댑터 경계가 바뀌면 갱신한다.
* [agent-structure.md](agent-structure.md)
  각 에이전트의 책임과 데이터 흐름을 설명한다.
  에이전트 역할 추가, 삭제, 책임 이동 시 갱신한다.
* [domain-rules.md](domain-rules.md)
  투자 시스템 원칙과 금지 사항, 도메인 제약을 설명한다.
  투자 원칙이나 실거래 제약이 바뀌면 갱신한다.
* [DOCS_GUIDE.md](DOCS_GUIDE.md)
  문서를 어떻게 나누고 유지할지에 대한 규칙을 설명한다.
* [TESTS_GUIDE.md](TESTS_GUIDE.md)
  테스트를 어떤 기준으로 작성하고 검토할지 설명한다.

## 관련 코드 경로

* 백엔드 진입점: `agent_pay_for_urself/api/`
* 에이전트 구현: `agent_pay_for_urself/agents/`
* 오케스트레이터: `agent_pay_for_urself/orchestrator.py`
* 스키마: `agent_pay_for_urself/schemas.py`
* 프론트엔드: `frontend/app/`
* 테스트: `tests/`

## 문서 갱신 원칙

* 설계 계약이 바뀌면 관련 문서와 이 index를 함께 갱신한다.
* 상세 구현 설명보다 계약, 책임, 경계, 운영 기준을 우선 문서화한다.
* 공개 계약이 아닌 임시 판단은 `docs/` 대신 로컬 scratchpad에 남긴다.
* 현재 구현되었거나 현재 작업 범위에서 명시적으로 계획된 내용만 서술하고, 그 외 미래 항목은 템플릿 또는 `TBD` 상태로 남긴다.
