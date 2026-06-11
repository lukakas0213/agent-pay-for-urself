# agent-pay-for-urself

AI 에이전트를 활용해 미국 주식 데이터를 수집, 분석, 평가하고 투자 의사결정을 지원하는 멀티 에이전트 투자 플랫폼입니다.

최종 목적은 사람이 상시 관여하지 않아도 에이전트가 24/7로 시장을 감시하고, 포지션을 관리하고, 사전에 정한 정책과 리스크 한도 안에서 매매까지 수행하는 자동 운용 시스템을 만드는 것입니다. 사용자는 모든 단계를 직접 조작하는 운영자가 아니라 정책 설정자, 피드백 제공자, 예외 승인자, 감사자로 참여합니다.

기본 실거래 브로커 방향은 한국투자증권 Open API를 사용해 해외주식 주문까지 연결하는 것으로 정합니다.

## 현재 범위

현재 구현은 기본적으로 deterministic stub 흐름을 유지하면서, 선택적으로 Yahoo Finance 실데이터를 붙일 수 있는 최소 프로젝트 골격입니다.

* FastAPI 진입점
* 메인 에이전트 오케스트레이터
* 데이터 수집, 분석, 리스크 관리, 매수/매도, 주문 실행, 로그/평가 에이전트
* 에이전트 입출력 dataclass 스키마
* `yfinance` 기반 Yahoo Finance 시장데이터 provider
* OpenAI Responses API를 붙일 수 있는 공통 LLM 템플릿 계층
* 사용자 요구사항을 담는 `InvestmentMandate`와 기본 정책 가드레일
* 기본 워크플로우 테스트

## 현재 프로젝트 구조

* `agent_pay_for_urself/api/`: FastAPI 앱 조립, 라우트, 요청/응답 모델, API 서비스
* `agent_pay_for_urself/agents/`: 데이터 수집, 분석, 리스크, 판단, 주문 계획, 평가 에이전트
* `agent_pay_for_urself/llm/`: OpenAI client, 공통 JSON 템플릿, LLM 출력 검증 헬퍼
* `agent_pay_for_urself/policies/`: 사용자 mandate 기반 정책 가드레일
* `agent_pay_for_urself/adapters/`: 시장데이터 provider와 브로커 adapter 같은 외부 연동 경계
* `agent_pay_for_urself/repositories/`: 워크플로우 결과 저장소 경계와 현재 in-memory 구현
* `agent_pay_for_urself/orchestrator.py`: `MainAgent`가 전체 에이전트 흐름을 조합하는 진입점
* `agent_pay_for_urself/schemas.py`: 에이전트 간에 전달하는 dataclass 기반 구조화 스키마
* `tests/`: API, 오케스트레이터, 서비스 계약 테스트
* `docs/`: 현재 구조, 에이전트 책임, 도메인 규칙, 테스트/문서 유지 기준
* `frontend/`: Next.js 기반 UI 프로토타입

## 현재 구현 메모

* 현재 오케스트레이터 런타임은 순차 Python 호출 구조입니다.
* `langgraph` 의존성은 설치돼 있지만, 아직 compiled graph runtime으로 마이그레이션되지는 않았습니다.
* `MARKET_DATA_PROVIDER=stub`이면 deterministic stub 데이터로 동작하고, `MARKET_DATA_PROVIDER=yahoo`이면 Yahoo Finance 실데이터를 수집합니다.
* `OPENAI_API_KEY`가 없으면 에이전트는 deterministic fallback 로직으로 동작합니다.
* `OPENAI_API_KEY`가 있으면 각 에이전트가 공통 LLM 템플릿 경로를 통해 OpenAI Responses API를 사용할 수 있습니다.
* `/decisions`는 선택적으로 `mandate`를 받을 수 있고, 응답에는 적용된 `mandate`와 `mandate_violations`가 포함됩니다.
* Web UI의 분석 조건 패널에서 목표, 허용 종목, 제외 종목, 위험 성향, 승인 필요 여부, 추가 조건을 입력할 수 있습니다.
* Web UI의 실험실 모드에서 실험 이름, 설명, 에이전트별 프롬프트 오버라이드를 입력하고 결과를 로컬 JSON 파일에 저장/조회할 수 있습니다.

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

프론트엔드 의존성은 별도로 설치합니다.

```bash
cd frontend
npm install
```

## 실행

백엔드 API 서버를 먼저 실행합니다.

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run poe dev
```

기본 주소는 `http://127.0.0.1:8000`입니다.

다른 터미널에서 프론트엔드 개발 서버를 실행합니다.

```bash
cd frontend
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. 프론트엔드는 `/api/*` 요청을 백엔드
`http://127.0.0.1:8000/*`로 프록시합니다.

외부 OS의 브라우저에서 우분투 개발 환경에 접속해야 하면 프론트엔드를 모든 인터페이스에
바인딩해서 실행합니다.

```bash
cd frontend
npm run dev -- -H 0.0.0.0
```

그 뒤 외부 브라우저에서 우분투 환경의 호스트 주소와 포트 `3000`으로 접속합니다.

## 시장데이터 환경변수

기본값은 `stub`이며, Yahoo Finance 실데이터를 쓰려면 아래처럼 설정합니다.

```bash
MARKET_DATA_PROVIDER=yahoo
```

Yahoo Finance provider는 `yfinance`를 사용하며, 비공식 Yahoo API 기반이므로 빈 응답이나 rate limit 가능성을 전제로 운영해야 합니다.

## LLM 환경변수

기본값은 deterministic fallback이며, OpenAI Responses API를 쓰려면 최소한 아래 값을 설정합니다.

```bash
OPENAI_API_KEY=your_key_here
```

선택적으로 모델명과 타임아웃도 조정할 수 있습니다.

```bash
OPENAI_MODEL=gpt-5.1
OPENAI_TIMEOUT_SECONDS=30
```

설정되면 각 에이전트는 공통 LLM 템플릿 계층을 통해 구조화된 JSON 출력을 시도하고, 실패하면 fallback 로직으로 되돌아갑니다. `POST /decisions`와 `POST /experiments` 응답의 `runtime` 필드에서 현재 `llm_mode`와 `model_name`을 확인할 수 있습니다.

## 실험실 환경변수

실험 기록은 기본적으로 `data/experiments.json`에 저장됩니다. 경로를 바꾸려면 아래 값을 설정합니다.

```bash
EXPERIMENT_STORE_PATH=data/experiments.json
```

실험실은 기본적으로 주문 제출 가능 상태를 차단합니다. 실험실 결과에서도 주문 제출 가능 상태를 허용하려면 명시적으로 설정합니다. 실제 broker submit은 별도 adapter 구현 없이는 발생하지 않습니다.

```bash
EXPERIMENT_LIVE_ORDER_ENABLED=true
```

## API 확인

백엔드가 실행 중일 때 상태 확인:

```bash
curl http://127.0.0.1:8000/health
```

시장데이터 직접 조회:

```bash
curl http://127.0.0.1:8000/market-data/AAPL
```

결정 워크플로우 직접 호출:

```bash
curl -X POST http://127.0.0.1:8000/decisions \
  -H "Content-Type: application/json" \
  -d '{"symbols":["AAPL","MSFT"],"max_position_weight":0.2}'
```

## 테스트

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run pytest
```

## 린트

```bash
UV_CACHE_DIR=/tmp/uv-cache uv run ruff check .
```
