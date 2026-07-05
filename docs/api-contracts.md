# API 명세

## 목적

이 문서는 현재 FastAPI 백엔드의 공개 API 계약을 한 곳에 모아 둔 기준 문서다.
라우트, 요청/응답 모델, 상태 코드, 공개 동작이 바뀌면 같은 작업에서 이 문서도 함께 갱신한다.

## 현재 범위

현재 백엔드 앱은 아래 엔드포인트를 공개한다.

* `GET /health`
* `GET /account`
* `GET /account/connection`
* `PUT /account/connection`
* `GET /market-data/{symbol}`
* `POST /decisions`
* `POST /orders/submit`
* `POST /orders/submissions`
* `GET /agent-prompts`
* `GET /agent-prompts/{agent_key}`
* `PUT /agent-prompts/{agent_key}`
* `GET /agent-settings`
* `GET /agent-settings/{agent_key}`
* `PUT /agent-settings/{agent_key}`
* `POST /console/interactions`
* `POST /agent/interactions` (`/console/interactions`의 deprecated alias)
* `GET /runs`
* `GET /runs/{run_id}`
* `POST /experiments`
* `POST /experiments/from-run`
* `GET /experiments`
* `GET /experiments/{experiment_id}`

## 관련 코드 경로

* 앱 조립: `agent_pay_for_urself/api/app.py`
* 라우트: `agent_pay_for_urself/api/routes/`
* 공개 모델: `agent_pay_for_urself/api/models/`
* 응답 매퍼: `agent_pay_for_urself/api/mappers/workflow.py`
* 서비스: `agent_pay_for_urself/api/services/`

## 공통 규칙

* 요청과 응답 본문은 JSON 기준이다.
* 별도 prefix가 없는 엔드포인트는 루트 경로에 직접 노출된다.
* 종목 심볼은 내부 워크플로우에서 대문자로 정규화된다.
* `MARKET_DATA_PROVIDER=yahoo`일 때 `005930` 같은 한국 심볼은 provider 조회용으로 `005930.KS`로 변환될 수 있지만, 공개 API 응답과 워크플로우 결과의 `symbol`은 원래 요청값을 유지한다.
* `POST /decisions`와 `POST /experiments`는 분석과 주문 계획을 만든다. 메인 에이전트는 `user_prompt`, `chat_messages`를 해석할 수 있지만, 실제 브로커 주문 제출은 `POST /orders/submit` 또는 `POST /orders/submissions`에서만 발생한다.
* `POST /decisions`로 생성된 run은 로컬 JSON history 저장소에도 기록되며, `GET /runs`, `GET /runs/{run_id}`에서 같은 public payload를 기반으로 조회된다.
* `POST /console/interactions`에서 `apply_to_workflow=true`로 생성된 재실행 run은 parent/root lineage와 trigger message를 함께 기록한다.
* `runtime.llm_mode`는 `model` 또는 `fallback`이다.
* `runtime.agent_models`는 설정된 경우 에이전트 이름 -> 모델명 매핑을 담는다.
* `runtime.data_mode`는 현재 구성된 마켓 데이터 provider 이름을 노출하며, 기본 구현에서는 `yahoo` 또는 `stub`이 될 수 있다.
* `runtime.live_order_enabled`는 현재 런타임이 실제 브로커 주문 제출을 지원하는지 나타낸다.

## 공통 스키마

### RuntimeSummaryItem

현재 런타임 구성을 안전하게 노출하는 공통 응답 조각이다.

* `data_mode: str`
* `llm_mode: "model" | "fallback"`
* `model_name: str | null`
* `agent_models: dict[str, str] | null`
* `live_order_enabled: bool`

### MandateRequest / MandateItem

워크플로우 실행 시 사용자 제약을 표현한다.

* `objective: str`
* `allowed_symbols: list[str]`
* `excluded_symbols: list[str]`
* `max_order_notional: float | null`
* `min_cash_weight: float | null`
* `risk_tolerance: "low" | "medium" | "high"`
* `requires_approval_for_live_orders: bool`
* `user_notes: str`

응답의 `MandateItem`에는 아래 필드가 추가된다.

* `max_position_weight: float`

## 엔드포인트 상세

### GET /health

목적:
프로세스 생존 여부를 확인한다.

응답 `200 OK`:

* `status: "ok"`

### GET /account

목적:
현재 구성된 브로커 어댑터 기준 계좌 스냅샷을 조회한다.
계좌 조회가 불가능한 런타임이어도 HTTP 200을 유지하고, 본문 `available`과 `message`로 상태를 설명한다.

응답 모델 `AccountResponse`:

* `available: bool`
* `broker: str`
* `account_masked: str | null`
* `connection: AccountConnectionItem`
* `credential_status: AccountCredentialStatusItem`
* `summary: AccountSummaryItem | null`
* `holdings: list[AccountHoldingItem]`
* `message: str`

`AccountConnectionItem`:

* `alias: str`
* `broker: "kis_mock" | "toss" | "noop"`
* `account_number: str`
* `account_product_code: str`
* `toss_account_id: str`

`AccountCredentialStatusItem`:

* `broker_adapter: str`
* `uses_env_credentials: bool`
* `has_app_key: bool`
* `has_app_secret: bool`
* `ready_for_account_lookup: bool`
* `app_key_hint: str | null`

`AccountSummaryItem`:

* `cash_balance: float`
* `total_purchase_amount: float`
* `total_evaluation_amount: float`
* `total_profit_loss: float`
* `total_profit_loss_rate: float`

`AccountHoldingItem`:

* `symbol: str`
* `name: str`
* `quantity: int`
* `average_price: float`
* `current_price: float`
* `market_value: float`
* `profit_loss: float`
* `profit_loss_rate: float`

### GET /market-data/{symbol}

목적:
전체 워크플로우를 돌리지 않고 단일 종목 시세/뉴스/재무 데이터를 조회한다.

경로 파라미터:

* `symbol: str`

응답 모델 `MarketDataItem`:

* `symbol: str`
* `latest_price: float`
* `broker_exchange_code: str | null`
* `news_headlines: list[str]`
* `financial_metrics: dict[str, float]`

상태 코드:

* `200 OK`: 조회 성공
* `422 Unprocessable Entity`: 공백 심볼 등 잘못된 입력
* `500 Internal Server Error`: provider 실행 중 런타임 오류
* `502 Bad Gateway`: 외부 조회 실패 등 일반 예외

### POST /decisions

목적:
메인 에이전트 중심 투자 판단 워크플로우를 실행하고 저장된 결과를 반환한다.
데이터 수집, 분석, 보고서 작성, 매수/매도 판단, 피드백 생성까지 포함한다.

요청 모델 `DecisionRequest`:

* `symbols: list[str]`
  최소 1개 이상이어야 하며 공백 심볼은 허용하지 않는다.
* `max_position_weight: float`
  `0 < 값 <= 1` 이어야 한다.
* `user_prompt: str`
* `chat_messages: list[str]`
  각 항목은 공백 문자열일 수 없다.
* `mandate: MandateRequest | null`

응답 모델 `DecisionResponse`:

* `run_id: str`
* `created_at: str`
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
* `feedback: WorkflowFeedbackItem`
* `mandate_violations: list[MandateViolationItem]`

`SupervisorDirectiveItem`:

* `objective: str`
* `focus_symbols: list[str]`
* `watch_symbols: list[str]`
* `guidance: list[str]`
* `summary: str`

`AnalysisSignalItem`:

* `symbol: str`
* `price_score: float`
* `news_score: float`
* `financial_score: float`
* `total_score: float`
* `rationale: str`

`InvestmentReportItem`:

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

`DecisionItem`:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD"`
* `confidence: float`
* `rationale: str`
* `risk_approved: bool`

`OrderItem`:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD"`
* `quantity: int`
* `broker_exchange_code: str | null`
* `limit_price: float | null`
* `should_submit: bool`
* `reason: str`

`EvaluationLogItem`:

* `decision_count: int`
* `order_count: int`
* `blocked_order_count: int`
* `notes: list[str]`

`MandateViolationItem`:

* `symbol: str`
* `rule: str`
* `message: str`

상태 코드:

* `200 OK`: 실행 성공
* `422 Unprocessable Entity`: 요청 모델 검증 실패 또는 워크플로우 입력 검증 실패
* `502 Bad Gateway`: 외부 데이터 또는 의존 런타임 문제
* `500 Internal Server Error`: 처리 중 예기치 않은 오류

운영상 의미:

* 이 엔드포인트는 주문 계획만 반환한다.
* 반환된 `run_id`는 `/console/interactions`, `/orders/submissions`, `/experiments/from-run`에서 재사용된다.

### POST /orders/submit

목적:
워크플로우 결과와 무관하게 단일 브로커 주문을 직접 제출한다.

요청 모델 `DirectOrderSubmitRequest`:

* `symbol: str`
* `action: "BUY" | "SELL"`
  모델 타입상 `HOLD`가 들어와도 검증 단계에서 거부한다.
* `quantity: int`
  0보다 커야 한다.
* `broker_exchange_code: str | null`
* `limit_price: float | null`
  값이 있으면 0보다 커야 한다.
* `confirm_live_order: bool`
  반드시 `true`여야 한다.

응답 모델 `DirectOrderSubmitResponse`:

* `live_order_enabled: bool`
* `submission: LiveOrderSubmissionItem`

`LiveOrderSubmissionItem`:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD"`
* `quantity: int`
* `broker_exchange_code: str | null`
* `limit_price: float | null`
* `accepted: bool`
* `broker_order_id: str | null`
* `message: str`

상태 코드:

* `200 OK`: 제출 처리 완료
* `400 Bad Request`: `confirm_live_order=false`, 잘못된 액션, 수량/가격 오류 등 요청 오류
* `503 Service Unavailable`: 현재 런타임에서 live submission 비활성화

운영상 의미:

* `action`은 `"BUY"` 또는 `"SELL"`만 허용한다.
* `action: "HOLD"` 요청은 유효하지 않은 직접 주문으로 거부된다.
* `confirm_live_order`는 반드시 `true`여야 한다.

### POST /orders/submissions

목적:
이전에 저장된 워크플로우 실행 결과에서 제출 가능한 주문 계획만 골라 실제 브로커로 보낸다.

요청 모델 `LiveOrderSubmitRequest`:

* `run_id: str`
* `symbols: list[str]`
  비어 있으면 저장된 주문 계획 전체를 대상으로 한다.
* `confirm_live_order: bool`
  반드시 `true`여야 한다.

응답 모델 `LiveOrderSubmitResponse`:

* `run_id: str`
* `requested_symbols: list[str]`
* `live_order_enabled: bool`
* `mandate_requires_approval: bool`
* `accepted_order_count: int`
* `rejected_order_count: int`
* `skipped_order_count: int`
* `submissions: list[LiveOrderSubmissionItem]`
* `skipped_orders: list[LiveOrderSkippedItem]`

`LiveOrderSkippedItem`:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD" | null`
* `quantity: int | null`
* `reason: str`

상태 코드:

* `200 OK`: 제출 처리 완료
* `404 Not Found`: `run_id`가 저장소에 없음
* `400 Bad Request`: `confirm_live_order=false` 등 요청 오류
* `503 Service Unavailable`: 현재 런타임에서 live submission 비활성화

운영상 의미:

* `symbols`에 없는 주문 계획은 건너뛴다.
* `should_submit=false` 이거나 `action`이 `BUY`/`SELL`이 아닌 저장 주문은 `skipped_orders`로 빠진다.
* 존재하지 않는 심볼을 요청하면 해당 심볼도 `skipped_orders`에 기록된다.

### GET /runs

목적:
저장된 workflow run을 최신순으로 나열해 히스토리 타임라인 화면과 보고서 목록 화면이 공통으로 사용할 수 있게 한다.

응답 모델 `WorkflowRunListItem`:

* `run_id: str`
* `created_at: str`
* `symbols: list[str]`
* `objective: str`
* `summary: str`
* `branch: WorkflowBranchItem`
* `report_approved_count: int`
* `report_count: int`
* `decision_actions: dict[str, "BUY" | "SELL" | "HOLD"]`

### GET /runs/{run_id}

목적:
저장된 workflow run 1건의 상세 정보와 파생 timeline payload를 반환한다.

응답 모델 `WorkflowRunDetailResponse`:

* `run_id: str`
* `created_at: str`
* `branch: WorkflowBranchItem`
* `agent_statuses: list[AgentStatusItem]`
* `timeline: list[TimelineEventItem]`
* `analysis_summaries: list[AnalysisSummaryItem]`
* `result: DecisionResponse`

`WorkflowBranchItem`:

* `branch_type: "initial" | "followup_rerun"`
* `parent_run_id: str | null`
* `root_run_id: str`
* `branch_depth: int`
* `trigger_message: str | null`
* `child_run_ids: list[str]`

상태 코드:

* `200 OK`: 저장된 workflow run 반환
* `404 Not Found`: `workflow run not found: {run_id}`

### GET /agent-prompts

목적:
현재 저장된 에이전트별 기본 프롬프트 목록을 조회한다.

응답 모델:

* `list[AgentPromptItem]`

`AgentPromptItem`:

* `agent_key: str`
* `label: str`
* `prompt: str`
* `updated_at: str`
* `source: str`

### GET /agent-prompts/{agent_key}

목적:
특정 에이전트 프롬프트 1건을 조회한다.

경로 파라미터:

* `agent_key: str`
  현재 저장소 기준 지원 키는 `data_collection`, `data_analysis`, `report`, `buy_sell`, `feedback` 이다.

응답:

* `200 OK`: `AgentPromptItem`
* `404 Not Found`: 대상 프롬프트 없음

### PUT /agent-prompts/{agent_key}

목적:
특정 에이전트 프롬프트를 저장한다.

요청 모델 `AgentPromptUpdateRequest`:

* `prompt: str`
  저장 전 `strip()`이 적용된다.

응답 모델 `AgentPromptSaveResponse`:

* `item: AgentPromptItem`

상태 코드:

* `200 OK`: 저장 성공
* `404 Not Found`: 지원하지 않는 `agent_key`

### GET /agent-settings

목적:
메인 에이전트와 각 서브 에이전트의 저장된 설정 목록을 반환한다.

응답 모델:

* `list[AgentSettingsItem]`

`AgentSettingsItem`:

* `agent_key: "main_agent" | "data_collection" | "data_analysis" | "report" | "buy_sell" | "feedback"`
* `label: str`
* `updated_at: str`
* `source: str`
* `common: AgentSettingsCommonItem`
* `specialized: typed settings payload`

`AgentSettingsCommonItem`:

* `enabled: bool`
* `use_llm: bool`
* `llm_model: str | null`

### GET /agent-settings/{agent_key}

목적:
특정 에이전트 설정 1건을 조회한다.

응답:

* `200 OK`: `AgentSettingsItem`
* `404 Not Found`: 대상 설정 없음

### PUT /agent-settings/{agent_key}

목적:
메인 에이전트 또는 서브 에이전트 1개의 저장 설정을 갱신한다.

요청 모델 `AgentSettingsUpdateRequest`:

* `common: AgentSettingsCommonItem`
* `specialized: typed settings payload`

허용 `agent_key`:

* `main_agent`
* `data_collection`
* `data_analysis`
* `report`
* `buy_sell`
* `feedback`

응답 모델 `AgentSettingsSaveResponse`:

* `item: AgentSettingsItem`

상태 코드:

* `200 OK`: 저장 성공
* `404 Not Found`: 지원하지 않는 `agent_key`

### POST /console/interactions

목적:
기존 워크플로우 결과를 설명하는 결정론적 콘솔 응답을 생성한다.
`apply_to_workflow=true`이면 메시지를 후속 지시로 추가하고 워크플로우를 다시 실행한 뒤 응답한다.

요청 모델 `AgentInteractionRequest`:

* `message: str`
* `run_id: str | null`
* `apply_to_workflow: bool`
* `current_result: DecisionResponse | null`
  하위 호환용 deprecated 필드다.

응답 모델 `AgentInteractionResponse`:

* `focus: str`
* `reply: str`
* `suggested_actions: list[str]`
* `applied_to_workflow: bool`
* `updated_run_id: str | null`
* `updated_result: DecisionResponse | null`

상태 코드:

* `200 OK`: 응답 생성 성공
* `404 Not Found`: `run_id`가 없거나 재실행 대상 run이 없음
* `422 Unprocessable Entity`: `apply_to_workflow=true`인데 `run_id`가 없음

운영상 의미:

* `run_id`가 있으면 저장된 실행 결과를 다시 읽는다.
* `run_id`가 없고 `current_result`도 없으면, 분석 실행을 먼저 유도하는 안내 응답을 반환한다.
* 이 엔드포인트는 브로커 주문을 제출하지 않는다.

### POST /agent/interactions

목적:
`POST /console/interactions`의 deprecated alias 이다.
동일한 요청/응답 계약을 사용한다.

### POST /experiments

목적:
프롬프트 override를 포함한 실험용 워크플로우를 실행하고 결과를 저장한다.

요청 모델 `ExperimentCreateRequest`:

* `name: str`
* `description: str`
* `decision: DecisionRequest`
* `prompt_overrides: AgentPromptOverridesRequest`

`AgentPromptOverridesRequest`:

* `main_agent: str`
* `data_collection: str`
* `data_analysis: str`
* `report: str`
* `buy_sell: str`
* `feedback: str`

응답 모델 `ExperimentResponse`:

* `experiment_id: str`
* `run_id: str`
* `name: str`
* `description: str`
* `created_at: str`
* `decision: DecisionRequest`
* `prompt_overrides: AgentPromptOverridesRequest`
* `runtime: RuntimeSummaryItem`
* `result: DecisionResponse`

운영상 의미:

* 현재 런타임은 주문 실행 단계 대신 피드백 단계를 저장한다.
* 차단된 주문은 `quantity=0`, `should_submit=false` 로 내려간다.

### POST /experiments/from-run

목적:
이미 완료된 workflow run을 다시 실행하지 않고 실험 레코드로 저장한다.

요청 모델 `ExperimentSaveRequest`:

* `run_id: str`
* `name: str`
* `description: str`

응답:

* `200 OK`: `ExperimentResponse`
* `404 Not Found`: 저장된 workflow run 없음

### GET /experiments

목적:
저장된 실험 목록을 최신순으로 조회한다.

응답 모델:

* `list[ExperimentListItem]`

`ExperimentListItem`:

* `experiment_id: str`
* `run_id: str`
* `name: str`
* `description: str`
* `created_at: str`
* `symbols: list[str]`
* `decision_actions: dict[str, "BUY" | "SELL" | "HOLD"]`
* `runtime: RuntimeSummaryItem`

### GET /experiments/{experiment_id}

목적:
실험 상세 1건을 조회한다.

응답:

* `200 OK`: `ExperimentResponse`
* `404 Not Found`: 대상 실험 없음

### GET /account/connection

목적:
현재 저장된 브로커 계좌 연결 정보를 반환한다.

응답 모델 `AccountConnectionItem`:

* `alias: str`
* `broker: "kis_mock" | "toss" | "noop"`
* `account_number: str`
* `account_product_code: str`
* `toss_account_id: str`

### PUT /account/connection

목적:
브로커 계좌 연결 정보를 저장하고 저장된 값을 반환한다.

요청 모델 `AccountConnectionRequest`:

* `alias: str`
* `broker: "kis_mock" | "toss"`
* `account_number: str`
* `account_product_code: str`
* `toss_account_id: str`

응답 모델 `AccountConnectionItem`:

* `alias: str`
* `broker: "kis_mock" | "toss" | "noop"`
* `account_number: str`
* `account_product_code: str`
* `toss_account_id: str`

브로커별 규칙:

* `broker="kis_mock"`일 때 `account_number`, `account_product_code`를 사용한다.
* `broker="toss"`일 때 `toss_account_id`를 사용하고, 현재 백엔드는 저장 계약만 제공한다.

## 수정 트리거

아래 변경이 있으면 이 문서를 같은 작업에서 반드시 함께 갱신한다.

* `agent_pay_for_urself/api/routes/`의 엔드포인트 추가, 삭제, 경로 변경
* `agent_pay_for_urself/api/models/`의 요청/응답 필드 변경
* `agent_pay_for_urself/api/services/`의 공개 검증 규칙, 상태 코드 의미, live order 정책 변경
* `agent_pay_for_urself/api/mappers/workflow.py`의 응답 매핑 구조 변경
