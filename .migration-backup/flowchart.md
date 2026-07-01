```mermaid
flowchart LR
    U["사용자"]
    UI["웹 UI"]
    API["FastAPI 앱"]
    ROUTES["공개 API 엔드포인트\n/health\n/market-data\n/decisions\n/console/interactions\n/experiments"]
    DEP["API 서비스 / 의존성 조립"]
    MA["메인 에이전트"]

    DC["데이터 수집"]
    DA["데이터 분석"]
    RM["리스크 관리"]
    BS["매수/매도 판단"]
    OE["주문 계획"]
    PG["정책 가드레일"]
    LE["로그/평가"]

    MDP["시장 데이터 제공자\nStub 또는 Yahoo Finance"]
    LLM["선택적 LLM 계층"]
    BROKER["증권사 어댑터 경계\n현재는 Noop"]

    WR["현재 워크플로우 저장소\nIn-memory"]
    ER["현재 실험 저장소\nJSON 파일"]
    DB["향후 공통 영속 DB\nSQLite 또는 PostgreSQL"]

    U <--> UI
    UI <--> API
    API --> ROUTES
    ROUTES --> DEP
    DEP --> MA

    MA --> DC
    MA --> DA
    MA --> RM
    MA --> BS
    MA --> OE
    MA --> PG
    MA --> LE

    DC --> MDP
    DC -. 선택적 .-> LLM
    DA -. 선택적 .-> LLM
    RM -. 선택적 .-> LLM
    BS -. 선택적 .-> LLM
    OE -. 선택적 .-> LLM
    LE -. 선택적 .-> LLM

    DEP --> WR
    DEP --> ER
    WR -. 나중에 DB로 교체 .-> DB
    ER -. 나중에 DB로 이전 또는 통합 .-> DB

    OE -. 실주문 경계 .-> BROKER
```
