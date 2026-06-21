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
* `POST /experiments`
* `GET /experiments`
* `GET /experiments/{experiment_id}`

## 관련 코드 경로

* 앱 조립: `agent_pay_for_urself/api/app.py`
* 라우트: `agent_pay_for_urself/api/routes/`
* 공개 모델: `agent_pay_for_urself/api/models/`
* API 서비스: `agent_pay_for_urself/api/services/`
* 내부 결과 매핑: `agent_pay_for_urself/api/mappers/workflow.py`

## 갱신 트리거

아래 변경이 생기면 이 문서를 갱신한다.

* 새 공개 엔드포인트 추가
* 기존 엔드포인트 path, method, 상태 코드, 필드 의미 변경
* 요청/응답 Pydantic 모델의 필드 추가, 삭제, 타입 변경
* deprecated alias 추가 또는 제거
* 런타임 메타데이터(`runtime`, `mandate_violations` 등) 계약 변경

## 공통 규칙

* 요청과 응답 본문은 JSON 기준이다.
* 종목 심볼은 내부 워크플로우에서 대문자로 정규화된다.
* `POST /decisions`는 주문 계획만 반환한다. 실제 브로커 주문 제출은 `POST /orders/submit` 또는 `POST /orders/submissions`에서만 발생한다.
* `runtime.llm_mode`는 `model` 또는 `fallback`이다.
* `runtime.agent_models`는 설정된 경우 에이전트 이름 -> 모델명 매핑을 담는다.
* `runtime.data_mode`는 현재 `stub` 또는 `yahoo`가 될 수 있다.
* `runtime.live_order_enabled`는 현재 조립된 브로커 어댑터가 제출 가능한 계좌 설정까지 갖췄는지 나타낸다.

## GET /health

목적:
프로세스가 응답 가능한 상태인지 확인한다.

응답 `200`:
```json
{
  "status": "ok"
}
```

## GET /market-data/{symbol}

목적:
전체 의사결정 워크플로우를 실행하지 않고, 하나의 심볼에 대한 정규화된 시장데이터만 직접 조회한다.

경로 파라미터:

* `symbol: str`

응답 `200` 모델:

* `symbol: str`
* `latest_price: float`
* `broker_exchange_code: str | null`
* `news_headlines: list[str]`
* `financial_metrics: dict[str, float]`

응답 예시:
```json
{
  "symbol": "AAPL",
  "latest_price": 301.54,
  "broker_exchange_code": "NASD",
  "news_headlines": ["..."],
  "financial_metrics": {"pe_ratio": 36.5}
}
```

오류 상태 코드:

* `422`: 입력 심볼이 provider 규칙을 만족하지 않음
* `500`: provider 구성 자체가 잘못됨
* `502`: 외부 시장데이터 조회 실패

## POST /decisions

목적:
요청 심볼에 대해 데이터 수집 → 분석 → 리스크 검증 → 매수/매도 판단 → 주문 계획 → 평가 요약까지 현재 멀티 에이전트 워크플로우를 실행한다.

요청 모델 `DecisionRequest`:

* `symbols: list[str]`
  최소 1개 필요
* `max_position_weight: float`
  기본값 `0.2`, 허용 범위 `0 < x <= 1`
* `mandate: MandateRequest | null`
  선택값

`MandateRequest` 필드:

* `objective: str`
* `allowed_symbols: list[str]`
* `excluded_symbols: list[str]`
* `max_order_notional: float | null`
* `min_cash_weight: float | null`
* `risk_tolerance: "low" | "medium" | "high"`
* `requires_approval_for_live_orders: bool`
* `user_notes: str`

최소 요청 예시:
```json
{
  "symbols": ["AAPL", "MSFT"],
  "max_position_weight": 0.2
}
```

응답 모델 `DecisionResponse` 상위 필드:

* `run_id: str`
* `symbols: list[str]`
* `runtime: RuntimeSummaryItem | null`
* `mandate: MandateItem`
* `market_data: list[MarketDataItem]`
* `analysis_signals: list[AnalysisSignalItem]`
* `risk_assessments: list[RiskAssessmentItem]`
* `decisions: list[DecisionItem]`
* `orders: list[OrderItem]`
* `evaluation_log: EvaluationLogItem`
* `mandate_violations: list[MandateViolationItem]`

`runtime` 필드:

* `data_mode: str`
* `llm_mode: str`
* `model_name: str | null`
* `agent_models: dict[str, str] | null`
* `live_order_enabled: bool`

`market_data` 항목 필드:

* `symbol: str`
* `latest_price: float`
* `news_headlines: list[str]`
* `financial_metrics: dict[str, float]`

`analysis_signals` 항목 필드:

* `symbol: str`
* `price_score: float`
* `news_score: float`
* `financial_score: float`
* `total_score: float`
* `rationale: str`

`risk_assessments` 항목 필드:

* `symbol: str`
* `approved: bool`
* `reasons: list[str]`
* `max_position_weight: float`

`decisions` 항목 필드:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD"`
* `confidence: float`
* `rationale: str`
* `risk_approved: bool`

`orders` 항목 필드:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD"`
* `quantity: int`
* `broker_exchange_code: str | null`
* `limit_price: float | null`
* `should_submit: bool`
* `reason: str`

`evaluation_log` 필드:

* `decision_count: int`
* `order_count: int`
* `blocked_order_count: int`
* `notes: list[str]`

`mandate_violations` 항목 필드:

* `symbol: str`
* `rule: str`
* `message: str`

응답 예시:
```json
{
  "run_id": "run_123",
  "symbols": ["AAPL"],
  "runtime": {
    "data_mode": "yahoo",
    "llm_mode": "model",
    "model_name": "gpt-5.5",
    "agent_models": {
      "data_collection": "gpt-5.4-mini",
      "data_analysis": "gpt-5.5",
      "risk_management": "gpt-5.5",
      "buy_sell": "gpt-5.5",
      "order_execution": "gpt-5.4-mini",
      "log_evaluation": "gpt-5.4-mini"
    },
    "live_order_enabled": false
  },
  "mandate": {
    "objective": "Evaluate requested US equity symbols conservatively.",
    "allowed_symbols": [],
    "excluded_symbols": [],
    "max_position_weight": 0.2,
    "max_order_notional": null,
    "min_cash_weight": null,
    "risk_tolerance": "medium",
    "requires_approval_for_live_orders": true,
    "user_notes": ""
  },
  "market_data": [
    {
      "symbol": "AAPL",
      "latest_price": 301.54,
      "broker_exchange_code": "NASD",
      "news_headlines": ["..."],
      "financial_metrics": {"pe_ratio": 36.5}
    }
  ],
  "analysis_signals": [
    {
      "symbol": "AAPL",
      "price_score": 0.5,
      "news_score": 0.55,
      "financial_score": 0.5,
      "total_score": 0.5167,
      "rationale": "..."
    }
  ],
  "risk_assessments": [
    {
      "symbol": "AAPL",
      "approved": true,
      "reasons": ["risk rules passed"],
      "max_position_weight": 0.2
    }
  ],
  "decisions": [
    {
      "symbol": "AAPL",
      "action": "HOLD",
      "confidence": 0.5167,
      "rationale": "...",
      "risk_approved": true
    }
  ],
  "orders": [
    {
      "symbol": "AAPL",
      "action": "HOLD",
      "quantity": 0,
      "broker_exchange_code": null,
      "limit_price": null,
      "should_submit": false,
      "reason": "no executable order"
    }
  ],
  "evaluation_log": {
    "decision_count": 1,
    "order_count": 1,
    "blocked_order_count": 1,
    "notes": ["AAPL: HOLD"]
  },
  "mandate_violations": []
}
```

오류 상태 코드:

* `422`: 잘못된 요청 형식. 예: 공백 심볼, 범위를 벗어난 `max_position_weight`

## POST /orders/submit

목적:
저장된 workflow run이 없어도 단일 주문을 직접 브로커 또는 모의 브로커로 제출한다. 이 엔드포인트는 주문 에이전트가 직접 호출할 수 있고, 개발자는 수동 테스트용으로 같은 경로를 사용할 수 있다.

요청 모델 `DirectOrderSubmitRequest`:

* `symbol: str`
* `action: "BUY" | "SELL"`
* `quantity: int`
* `broker_exchange_code: str | null`
* `limit_price: float | null`
* `confirm_live_order: bool`
  반드시 `true`여야 제출 수행

최소 요청 예시:
```json
{
  "symbol": "AAPL",
  "action": "BUY",
  "quantity": 1,
  "confirm_live_order": true
}
```

응답 모델 `DirectOrderSubmitResponse`:

* `live_order_enabled: bool`
* `submission: LiveOrderSubmissionItem`

`submission` 항목 필드:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD"`
* `quantity: int`
* `broker_exchange_code: str | null`
* `limit_price: float | null`
* `accepted: bool`
* `broker_order_id: str | null`
* `message: str`

오류 상태 코드:

* `400`: 제출 확인 플래그가 없거나 요청 본문이 잘못됨
* `503`: 현재 런타임에 제출 가능한 브로커 어댑터가 없음

## POST /orders/submissions

목적:
저장된 workflow run의 실행 가능한 주문 계획만 골라 현재 구성된 브로커 어댑터로 실제 제출한다. 이 엔드포인트는 실제 또는 모의 브로커 주문을 발생시킬 수 있다.

요청 모델 `LiveOrderSubmitRequest`:

* `run_id: str`
* `symbols: list[str]`
  선택값, 비어 있으면 저장된 모든 order plan을 대상으로 삼음
* `confirm_live_order: bool`
  반드시 `true`여야 제출 수행

최소 요청 예시:
```json
{
  "run_id": "run_123",
  "confirm_live_order": true
}
```

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

`submissions` 항목 필드:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD"`
* `quantity: int`
* `broker_exchange_code: str | null`
* `limit_price: float | null`
* `accepted: bool`
* `broker_order_id: str | null`
* `message: str`

`skipped_orders` 항목 필드:

* `symbol: str`
* `action: "BUY" | "SELL" | "HOLD" | null`
* `quantity: int | null`
* `reason: str`

응답 예시:
```json
{
  "run_id": "run_123",
  "requested_symbols": ["AAPL"],
  "live_order_enabled": true,
  "mandate_requires_approval": true,
  "accepted_order_count": 1,
  "rejected_order_count": 0,
  "skipped_order_count": 0,
  "submissions": [
    {
      "symbol": "AAPL",
      "action": "BUY",
      "quantity": 1,
      "broker_exchange_code": "NASD",
      "limit_price": 201.25,
      "accepted": true,
      "broker_order_id": "A0001",
      "message": "submitted"
    }
  ],
  "skipped_orders": []
}
```

오류 상태 코드:

* `400`: 제출 확인 플래그가 없거나 요청 본문이 잘못됨
* `404`: 저장된 `run_id`를 찾지 못함
* `503`: 현재 런타임에 제출 가능한 브로커 어댑터가 없음

## POST /console/interactions

목적:
저장된 의사결정 결과에 대해 콘솔 보조 설명 응답을 생성한다. 현재 구현은 deterministic reply다.

요청 모델 `AgentInteractionRequest`:

* `message: str`
* `run_id: str | null`
* `current_result: DecisionResponse | null`
  deprecated compatibility field

권장 사용법:

* `run_id`를 넘긴다
* `current_result` 전체 payload 재전송은 deprecated 경로로만 유지한다

요청 예시:
```json
{
  "message": "리스크 설명해줘",
  "run_id": "run_123"
}
```

응답 모델 `AgentInteractionResponse`:

* `focus: str`
* `reply: str`
* `suggested_actions: list[str]`

오류 상태 코드:

* `404`: `run_id`에 해당하는 저장 결과가 없음

## POST /agent/interactions

목적:
`/console/interactions`의 deprecated alias다.

계약:

* 요청/응답 형식은 `/console/interactions`와 동일
* 새 호출자는 `/console/interactions`를 사용해야 함

## POST /experiments

목적:
실험 이름, 설명, 에이전트별 prompt override를 포함한 워크플로우 실행 결과를 저장한다.

요청 모델 `ExperimentCreateRequest`:

* `name: str`
* `description: str`
* `decision: DecisionRequest`
* `prompt_overrides: AgentPromptOverridesRequest`

`AgentPromptOverridesRequest` 필드:

* `data_collection: str`
* `data_analysis: str`
* `risk_management: str`
* `buy_sell: str`
* `order_execution: str`
* `log_evaluation: str`

요청 예시:
```json
{
  "name": "Conservative prompt test",
  "description": "Check risk-first behavior.",
  "decision": {
    "symbols": ["AAPL"],
    "max_position_weight": 0.2
  },
  "prompt_overrides": {
    "risk_management": "Prefer explicit downside notes."
  }
}
```

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

오류 상태 코드:

* `422`: 공백 이름, 길이 초과, 중첩된 `decision` 요청 검증 실패

## GET /experiments

목적:
저장된 실험 이력을 newest-first로 반환한다.

응답 모델:
배열 `list[ExperimentListItem]`

`ExperimentListItem` 필드:

* `experiment_id: str`
* `run_id: str`
* `name: str`
* `description: str`
* `created_at: str`
* `symbols: list[str]`
* `decision_actions: dict[str, "BUY" | "SELL" | "HOLD"]`
* `runtime: RuntimeSummaryItem`

## GET /experiments/{experiment_id}

목적:
저장된 실험 상세 하나를 id로 조회한다.

경로 파라미터:

* `experiment_id: str`

응답 모델:

* `ExperimentResponse`

오류 상태 코드:

* `404`: 해당 id의 저장 실험이 없음
