# agent-pay-for-urself

AI 에이전트를 활용해 미국 주식 데이터를 수집, 분석, 평가하고 투자 의사결정을 지원하는 멀티 에이전트 투자 플랫폼입니다.

기본 실거래 브로커 방향은 한국투자증권 Open API를 사용해 해외주식 주문까지 연결하는 것으로 정합니다.

## 현재 범위

현재 구현은 외부 API와 실거래를 호출하지 않는 최소 프로젝트 골격입니다.

* FastAPI 진입점
* 메인 에이전트 오케스트레이터
* 데이터 수집, 분석, 리스크 관리, 매수/매도, 주문 실행, 로그/평가 에이전트
* 에이전트 입출력 dataclass 스키마
* 기본 워크플로우 테스트

## 브로커 방향

현재 프로젝트의 기본 브로커는 `한국투자증권 Open API`입니다.

* 투자 대상: 미국 주식 중심
* 기본 주문 경로: 한국투자증권 계좌를 통한 해외주식 주문
* 연동 방식: REST API, 필요 시 WebSocket 확장
* 구현 원칙: 주문 실행 계층에서 브로커 어댑터로 분리

## 온보딩 메모

한국투자증권 Open API를 사용하려면 아래 선행 조건이 필요합니다.

1. 한국투자증권 계좌 개설
2. ID 등록 및 계좌 연결
3. Open API 서비스 신청
4. `APP Key` / `APP Secret` 발급
5. 모의/실전 토큰 발급 후 API 호출

리눅스 개발 환경에서는 구형 Windows 전용 트레이딩 프로그램 대신 Open API를 사용합니다.
계좌 개설 및 보안 인증이 우분투에서 어려운 경우, 모바일 앱 또는 브라우저 인증 경로로 선행 절차를 마친 뒤 서버 개발은 우분투에서 진행하는 것을 기본 경로로 봅니다.

## 설치

```bash
UV_CACHE_DIR=/tmp/uv-cache uv sync
```

## 실행

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run poe dev
```

## 테스트

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run pytest
```

## 린트

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run ruff check .
```
