# 에이전트 구조

## 현재 데이터 흐름

사용자

→ Web UI

→ FastAPI (`/decisions` 또는 `/experiments`)

→ 메인 에이전트가 `InvestmentMandate` 확정

→ 데이터 수집 에이전트

→ 데이터 분석 에이전트

→ 리스크 관리 에이전트

→ 매수/매도 에이전트

→ 주문 실행 에이전트

→ 메인 에이전트가 `PolicyGuardrail`로 mandate 위반 차단

→ 로그/평가 에이전트

→ `WorkflowResult` 생성

→ In-memory workflow repository에 `run_id`와 함께 저장

→ Web UI 또는 콘솔 보조 API (`/console/interactions`)에서 조회

일반 workflow run은 프로세스 메모리 저장소에 저장된다. 실험실에서 실행한 요청은 같은 run 저장소에 저장된 뒤 로컬 JSON 실험 저장소에도 public payload 형태로 저장된다.

## 메인 에이전트와 정책 경계

현재 `MainAgent`는 하위 에이전트의 실행 순서만 조정하는 것이 아니라, 실행별 사용자 요구사항인 `InvestmentMandate`도 소유한다.

* 관련 코드 경로: `agent_pay_for_urself/schemas.py`, `agent_pay_for_urself/policies/`
* 기본 mandate: 요청의 `max_position_weight`를 포함한 보수적 기본 정책
* 현재 가드레일: 허용 심볼 목록 밖의 종목과 제외 심볼을 `HOLD`로 차단
* 위반 결과: `WorkflowResult.mandate_violations`와 API `mandate_violations`에 기록
* Web UI 입력: 분석 조건 패널의 `Mandate` 영역에서 목표, 허용/제외 종목, 위험 성향, 승인 필요 여부, 추가 조건을 입력

## 공통 LLM 템플릿 계층

현재 각 워크플로우 에이전트는 선택적으로 공통 LLM 템플릿 계층을 사용할 수 있다.

* 관련 코드 경로: `agent_pay_for_urself/llm/`
* 기본 클라이언트: `NoopAgentLLMClient`
* OpenAI 사용 시: `OpenAIResponsesClient` with per-agent model routing
* 동작 방식: 에이전트가 fallback 결과를 먼저 만들고, LLM 응답이 유효한 구조를 반환하면 그 값을 사용하며 실패 시 fallback 결과로 되돌아간다.

즉 현재 저장소에서 LLM은 에이전트 바깥의 공통 호출 인프라이고, 각 에이전트는 여전히 자신의 입력/출력 스키마와 비즈니스 단계 책임을 가진다. 실험실의 에이전트별 prompt override는 기본 system instruction 뒤에 추가 지시로 붙으며, JSON 출력 스키마와 투자 안전 제약보다 우선하지 않는다. 에이전트별 모델은 환경 변수로 분리해서 조정한다.

## 현재 구현 에이전트

### 데이터 수집 에이전트

담당 업무:

* 요청된 심볼 목록을 정규화한다.
* `MarketDataProvider` 인터페이스를 통해 종목별 데이터를 가져온다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 `MarketData` 구조를 보정할 수 있다.
* 현재 기본 provider는 고정 가격, 뉴스, 재무지표를 반환하는 stub 구현이고, `MARKET_DATA_PROVIDER=yahoo`를 설정하면 `yfinance` 기반 Yahoo Finance provider로 실데이터를 가져올 수 있다.

### 데이터 분석 에이전트

담당 업무:

* 수집된 `MarketData`를 `AnalysisSignal`로 변환한다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 분석 결과를 생성할 수 있다.
* 현재 deterministic fallback은 가격, 뉴스 존재 여부, `pe_ratio` 기반의 단순 점수 계산을 수행한다.

### 매수/매도 에이전트

담당 업무:

* 분석 점수와 리스크 승인 여부를 바탕으로 `BUY`, `SELL`, `HOLD`를 결정한다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 `TradeDecision`을 생성할 수 있다.
* deterministic fallback에서는 리스크 미승인 시 무조건 `HOLD`를 반환한다.

### 리스크 관리 에이전트

담당 업무:

* `max_position_weight` 범위를 검증한다.
* 분석 결과에 투자 근거가 있는지 확인한다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 `RiskAssessment`를 생성할 수 있다.
* deterministic fallback에서는 기본 승인/거절 판단과 사유 생성만 수행한다.

### 주문 실행 에이전트

담당 업무:

* 주문 계획 생성
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 `OrderPlan`을 생성할 수 있다.
* 시장데이터에 거래소 정보가 있으면 `broker_exchange_code`와 `limit_price`를 주문 계획에 포함한다.
* 실제 브로커 제출은 `BrokerAdapter` 경계 뒤로 분리한다.
* 현재 기본 adapter는 `NoopBrokerAdapter`이며, `BROKER_ADAPTER=kis_mock`일 때 한국투자증권 모의투자 adapter를 조립할 수 있다.

### 로그/평가 에이전트

담당 업무:

* 의사결정 수와 주문 계획 수를 요약한다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 `EvaluationLog`를 생성할 수 있다.
* 현재 deterministic fallback은 `EvaluationLog`를 만들고, API 서비스 계층이 전체 `WorkflowResult`를 메모리 저장소에 보관한다.

## 정책 보조 계층

### PolicyGuardrail

담당 업무:

* 하위 에이전트가 만든 `TradeDecision`과 `OrderPlan`이 `InvestmentMandate`를 벗어나는지 확인
* 현재는 `allowed_symbols`, `excluded_symbols`를 hard rule로 적용
* 위반된 결정은 `HOLD`로 바꾸고 주문 계획은 제출 불가로 바꿈

## API 보조 계층

### DecisionWorkflowService

담당 업무:

* `MainAgent` 실행
* 실행 결과를 저장소에 저장
* API 응답용 `run_id`를 반환
* 현재 market data / LLM runtime summary를 결정 API 응답에 제공

### ConsoleAssistantService

담당 업무:

* 저장된 `WorkflowResult`를 바탕으로 설명 응답 생성
* `/console/interactions` 요청에 deterministic reply 제공
* 기존 `/agent/interactions`는 deprecated alias로 유지

### ExperimentService

담당 업무:

* Web UI 실험실 요청 실행
* 에이전트별 prompt override를 `InvestmentRequest`에 포함
* `EXPERIMENT_LIVE_ORDER_ENABLED`가 `true`가 아니면 실험 주문 계획을 제출 불가 상태로 후처리
* 실험 입력, runtime summary, workflow result를 로컬 JSON 저장소에 저장

## 미구현 에이전트 템플릿

### 에이전트 이름

* 상태: `TBD`
* 목적: `TBD`
* 입력: `TBD`
* 출력: `TBD`
* 관련 코드 경로: `TBD`

## 역할 분담

### 개발 담당

책임 영역:

* 시스템 설계
* 에이전트 구현
* API 개발
* 데이터 파이프라인 구축
* 데이터베이스 설계
* 백테스트 엔진 구현
* 브로커 API 연동
* 인프라 운영

### 투자 담당

책임 영역:

* 투자 전략 정의
* 재무제표 평가 기준 정의
* 포트폴리오 규칙 정의
* 리스크 관리 규칙 정의
* 투자 성과 평가 기준 정의
* 전략 검증 및 개선
