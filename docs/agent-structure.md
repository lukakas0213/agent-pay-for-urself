# 에이전트 구조

## 현재 데이터 흐름

사용자

→ Web UI

→ FastAPI (`/decisions` 또는 `/experiments`)

→ 메인 에이전트가 `InvestmentMandate` 확정

→ 메인 에이전트가 `user_prompt`, `chat_messages`를 `SupervisorDirective`로 해석

→ 데이터 수집 에이전트

→ 데이터 분석 에이전트

→ 보고서 에이전트

→ 매수/매도 에이전트

→ 주문 실행 에이전트

→ 메인 에이전트가 `PolicyGuardrail`로 mandate 위반 차단

→ 로그/평가 에이전트

→ `WorkflowResult` 생성

→ In-memory workflow repository에 `run_id`와 함께 저장

→ Web UI 또는 콘솔 보조 API (`/console/interactions`)에서 조회 또는 follow-up 지시 추가

일반 workflow run은 프로세스 메모리 저장소에 저장된다. 실험실에서 실행한 요청은 같은 run 저장소에 저장된 뒤 로컬 JSON 실험 저장소에도 public payload 형태로 저장된다.

## 메인 에이전트와 정책 경계

현재 `MainAgent`는 하위 에이전트의 실행 순서만 조정하는 것이 아니라, 실행별 사용자 요구사항인 `InvestmentMandate`를 소유하고 `user_prompt`, `chat_messages`를 `SupervisorDirective`로 구조화하는 supervisor 역할도 함께 가진다.

* 관련 코드 경로: `agent_pay_for_urself/schemas.py`, `agent_pay_for_urself/orchestrator.py`, `agent_pay_for_urself/policies/`
* 기본 mandate: 요청의 `max_position_weight`를 포함한 보수적 기본 정책
* 현재 가드레일: 허용 심볼 목록 밖의 종목과 제외 심볼을 `HOLD`로 차단
* 위반 결과: `WorkflowResult.mandate_violations`와 API `mandate_violations`에 기록
* 자연어 해석 결과: `WorkflowResult.supervisor_directive`와 API `supervisor_directive`에 기록
* Web UI 입력: 분석 조건 패널의 `Mandate` 영역에서 목표, 허용/제외 종목, 위험 성향, 승인 필요 여부, 추가 조건을 입력

## 공통 LLM 템플릿 계층

현재 각 워크플로우 에이전트는 선택적으로 공통 LLM 템플릿 계층을 사용할 수 있다.

* 관련 코드 경로: `agent_pay_for_urself/llm/`
* 기본 클라이언트: `NoopAgentLLMClient`
* OpenAI 사용 시: `OpenAIResponsesClient` with per-agent model routing
* 동작 방식: 에이전트가 fallback 결과를 먼저 만들고, LLM 응답이 유효한 구조를 반환하면 그 값을 사용하며 실패 시 fallback 결과로 되돌아간다.

즉 현재 저장소에서 LLM은 에이전트 바깥의 공통 호출 인프라이며, `MainAgent`도 같은 계층을 사용해 자연어를 `SupervisorDirective`로 해석한다. 각 에이전트는 여전히 자신의 입력/출력 스키마와 비즈니스 단계 책임을 가진다. 실험실의 에이전트별 prompt override는 기본 system instruction 뒤에 추가 지시로 붙으며, JSON 출력 스키마와 투자 안전 제약보다 우선하지 않는다. 에이전트별 모델은 환경 변수로 분리해서 조정한다.

## 현재 구현 에이전트

### 메인 에이전트

담당 업무:

* 전체 workflow 실행 순서를 조정한다.
* `InvestmentMandate`를 요청 단위로 확정한다.
* `user_prompt`, `chat_messages`를 해석해 `SupervisorDirective`를 만든다.
* 자연어 해석 결과를 바탕으로 이번 사이클의 focus/watch 심볼과 추가 가이던스를 구조화한다.
* 하위 에이전트 사이에 직접 의존을 만들지 않고 구조화된 스키마만 전달한다.
* `PolicyGuardrail`로 mandate 위반을 차단한 뒤 결과를 `WorkflowResult`로 묶는다.

### 서브 에이전트

서브 에이전트는 각자 하나의 단계만 담당한다. 현재 구현에서는 데이터 수집과 데이터 분석이 뉴스, 주가, 재무제표를 함께 다루고, 보고서 단계가 이를 바탕으로 판단 근거와 리스크 승인 여부를 묶어 정리한다.

#### 데이터 수집

* 요청된 심볼 목록을 정규화한다.
* `MarketDataProvider` 인터페이스를 통해 종목별 데이터를 가져온다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 `MarketData` 구조를 보정할 수 있다.
* 현재 기본 provider는 고정 가격, 뉴스, 재무지표를 반환하는 stub 구현이고, `MARKET_DATA_PROVIDER=yahoo`를 설정하면 `yfinance` 기반 Yahoo Finance provider로 실데이터를 가져올 수 있다.

#### 데이터 분석

* 수집된 `MarketData`를 `AnalysisSignal`로 변환한다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 분석 결과를 생성할 수 있다.
* 현재 deterministic fallback은 가격, 뉴스 존재 여부, `pe_ratio` 기반의 단순 점수 계산을 수행한다.

#### 보고서 작성

* `InvestmentRequest`, `MarketData`, `AnalysisSignal`을 함께 읽고 `InvestmentReport`를 생성한다.
* 상승 요인(`bull_points`), 하락 요인(`bear_points`), 리스크 플래그(`risk_flags`), 승인 여부(`risk_approved`)를 한 번에 구조화한다.
* `max_position_weight` 범위와 분석 근거 존재 여부를 점검해 기존 리스크 관리 단계 책임을 흡수한다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 보고서를 생성할 수 있다.
* deterministic fallback에서는 분석 점수 기반 action bias와 보수적 리스크 승인 여부를 함께 계산한다.

### 매수/매도 에이전트

담당 업무:

* `InvestmentReport`를 읽고 `BUY`, `SELL`, `HOLD`를 결정한다.
* 선택적으로 공통 LLM 템플릿 계층을 거쳐 `TradeDecision`을 생성할 수 있다.
* deterministic fallback에서는 보고서의 `risk_approved`가 거짓이면 무조건 `HOLD`를 반환한다.

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
