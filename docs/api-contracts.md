# API Contracts

## 목적

이 문서는 현재 FastAPI 공개 엔드포인트의 요청/응답 계약을 한 곳에 모아 둔 기준 문서다.
라우트, 공개 Pydantic 모델, 상태 코드, 운영상 의미가 바뀌면 이 문서를 같은 작업에서 함께 갱신한다.

## 현재 범위

현재 애플리케이션은 아래 공개 엔드포인트를 제공한다.

* `GET /health`
* `GET /market-data/{symbol}`
* `POST /decisions`
* `POST /orders/submit`
* `POST /orders/submissions`
* `POST /console/interactions`
* `POST /agent/interactions` (`/console/interactions`의 deprecated alias)
* `GET /runs`
* `GET /runs/{run_id}`
* `POST /experiments`
* `GET /experiments`
* `GET /experiments/{experiment_id}`

## 공통 규칙

* 요청과 응답 본문은 JSON 기준이다.
* 종목 심볼은 내부 워크플로우에서 대문자로 정규화된다.
* `MARKET_DATA_PROVIDER=yahoo`일 때 삼성전자 `005930`은 Yahoo 조회용으로 `005930.KS`를 사용하지만, 공개 API 응답과 워크플로우 결과의 `symbol`은 원래 요청값을 유지한다.
* `POST /decisions`는 주문 계획만 반환한다. 메인 에이전트는 `user_prompt`, `chat_messages`를 해석할 수 있지만, 실제 브로커 주문 제출은 `POST /orders/submit` 또는 `POST /orders/submissions`에서만 발생한다.
* `POST /decisions`로 생성된 run은 로컬 JSON history 저장소에도 기록되며, `GET /runs`, `GET /runs/{run_id}`에서 같은 public payload를 기반으로 조회된다.
* `runtime.llm_mode`는 `model` 또는 `fallback`이다.
* `runtime.agent_models`는 설정된 경우 에이전트 이름 -> 모델명 매핑을 담는다.
* `runtime.data_mode`는 현재 `stub` 또는 `yahoo`가 될 수 있다.
* `runtime.live_order_enabled`는 현재 조립된 브로커 어댑터가 제출 가능한 계좌 설정까지 갖췄는지 나타낸다.

## POST /decisions

목적:
요청 심볼에 대해 데이터 수집 → 분석 → 보고서 작성 → 매수/매도 판단 → 주문 계획 → 평가 요약까지 현재 멀티 에이전트 워크플로우를 실행한다. 메인 에이전트는 실행 전에 `user_prompt`, `chat_messages`를 해석해 이번 사이클의 focus/watch 심볼과 추가 가이던스를 구조화한다.

요청 모델 `DecisionRequest`:

* `symbols: list[str]`
* `max_position_weight: float`
* `user_prompt: str`
* `chat_messages: list[str]`
* `mandate: MandateRequest | null`

응답 모델 `DecisionResponse` 상위 필드:

* `run_id: str`
* `symbols: list[str]`
* `user_prompt: str`
* `chat_messages: list[str]`
* `runtime: RuntimeSummaryItem | null`
* `mandate: MandateItem`
* `supervisor_directive: SupervisorDirectiveItem`
* `market_data: list[MarketDataItem]`
* `analysis_signals: list[AnalysisSignalItem]`
* `investment_reports: list[InvestmentReportItem]`
* `decisions: list[DecisionItem]`
* `orders: list[OrderItem]`
* `evaluation_log: EvaluationLogItem`
* `mandate_violations: list[MandateViolationItem]`

`investment_reports` 항목 필드:

* `symbol: str`
* `summary: str`
* `bull_points: list[str]`
* `bear_points: list[str]`
* `risk_flags: list[str]`
* `risk_approved: bool`
* `max_position_weight: float`
* `recommended_action_bias: "BUY" | "SELL" | "HOLD"`
* `signal_strength: float`
* `rationale: str`

`runtime.agent_models`에서 보고서 단계는 `report` 키를 사용하고, 환경 변수는 `OPENAI_REPORT_MODEL`이다.

## POST /experiments

목적:
실험용 프롬프트 override와 함께 같은 워크플로우를 실행하고 저장한다.
실험 결과와 `/experiments/from-run`으로 저장한 기존 workflow run은 `runtime.live_order_enabled=false`
환경에서는 제출 가능한 주문 계획을 그대로 노출하지 않으며, 저장 전에 `should_submit=false`로
차단된다.

`prompt_overrides` 필드:

* `data_collection: str`
* `data_analysis: str`
* `report: str`
* `buy_sell: str`
* `order_execution: str`
* `log_evaluation: str`

## POST /orders/submit

목적:
직접 브로커 주문 1건을 제출한다.

요청 규칙:

* `action`은 `"BUY"` 또는 `"SELL"`만 허용한다.
* `action: "HOLD"` 요청은 유효하지 않은 직접 주문으로 거부된다.
* `confirm_live_order`는 반드시 `true`여야 한다.


## GET /runs

목적:
저장된 workflow run을 최신순으로 나열해 히스토리 타임라인 화면과 보고서 목록 화면이 공통으로 사용할 수 있게 한다.

응답 모델 `WorkflowRunListItem` 필드:

* `run_id: str`
* `created_at: str`
* `symbols: list[str]`
* `objective: str`
* `summary: str`
* `report_approved_count: int`
* `report_count: int`
* `decision_actions: dict[str, "BUY" | "SELL" | "HOLD"]`

## GET /runs/{run_id}

목적:
저장된 workflow run 1건의 상세 정보와 파생 timeline payload를 반환한다.

응답 모델 `WorkflowRunDetailResponse` 상위 필드:

* `run_id: str`
* `created_at: str`
* `agent_statuses: list[AgentStatusItem]`
* `timeline: list[TimelineEventItem]`
* `analysis_summaries: list[AnalysisSummaryItem]`
* `result: DecisionResponse`

상태 코드:

* `200`: 저장된 workflow run 반환
* `404`: `workflow run not found: {run_id}`
