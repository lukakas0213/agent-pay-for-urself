# Architecture

## Current Scope

* The current implementation is a minimum workflow skeleton.
* Real market data, broker submission, and persistent storage are not wired yet.
* Broker-facing code should be introduced behind explicit adapter or repository boundaries.

## Broker Direction

* Default broker target: `Korea Investment & Securities Open API`
* Default execution market: US equities via overseas stock trading
* Broker integration should be isolated behind an adapter interface so the orchestrator and agents stay broker-agnostic.

## Minimum Agent Flow

```mermaid
flowchart LR
    U[사용자]
    UI[Web UI]
    MA[메인 에이전트]

    DC[데이터 수집 에이전트]
    DA[데이터 분석 에이전트]
    RM[리스크 관리 에이전트]
    BS[매수/매도 에이전트]
    OE[주문 실행 에이전트]
    LE[로그/평가 에이전트]

    PRICE[주가 데이터 API]
    NEWS[뉴스 API]
    FIN[재무 데이터 API]

    PRICE_ANALYSIS[주가 분석]
    NEWS_ANALYSIS[뉴스 분석]
    FIN_ANALYSIS[재무제표 분석]

    RISK_RULE[손절/익절 기준 확인]
    POSITION_LIMIT[종목별 비중 제한]
    TRADE_CHECK[거래 가능 여부 확인]

    BUY_SELL_DECISION[매수/매도 판단]

    BROKER[증권사 API]
    ORDER_CHECK[주문/체결 확인]

    DECISION_LOG[판단 근거 저장]
    TRADE_LOG[거래 로그 저장]
    PERFORMANCE[성과 평가]

    U <--> UI
    UI <--> MA

    MA <--> DC
    MA <--> DA
    MA <--> RM
    MA <--> BS
    MA <--> OE
    MA <--> LE

    DC --> PRICE
    DC --> NEWS
    DC --> FIN

    DA --> PRICE_ANALYSIS
    DA --> NEWS_ANALYSIS
    DA --> FIN_ANALYSIS

    RM --> RISK_RULE
    RM --> POSITION_LIMIT
    RM --> TRADE_CHECK

    BS --> BUY_SELL_DECISION

    OE --> BROKER
    OE --> ORDER_CHECK

    LE --> DECISION_LOG
    LE --> TRADE_LOG
    LE --> PERFORMANCE
```

## Implementation Notes

* `MainAgent` is the only component that coordinates other agents.
* The current workflow order is collection -> analysis -> risk assessment -> buy/sell decision -> order planning -> evaluation.
* Agent outputs use structured dataclasses in `agent_pay_for_urself.schemas`.
* `OrderExecutionAgent` currently creates order plans only; it does not call a broker.
* Real data providers and broker adapters should be added behind explicit interfaces.
* The first broker adapter should target `Korea Investment & Securities Open API`.
* The first live execution scope should cover overseas stock order submission, order status checks, and execution result collection.

## Future Integration Template

### Data Provider Adapter

* Status: `TBD`
* Input contract: `TBD`
* Output contract: `TBD`

### Broker Adapter

* Status: `Planned`
* First target: `Korea Investment & Securities Open API`
* Submit order contract: `TBD`
* Order status contract: `TBD`

### Persistence Layer

* Status: `TBD`
* Storage contract: `TBD`
