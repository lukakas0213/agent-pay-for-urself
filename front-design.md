# Frontend Redesign Guide for v0

이 문서는 이 저장소의 프론트엔드를 `v0`로 전면 재설계할 때 사용하는 단일 기준 문서다.
디자인 방향, 레퍼런스 이미지 해석, 화면 구조, 백엔드 연결 계약, `v0` 프롬프트를 한 곳에 모아 둔다.

## 1. Project Context

현재 상황은 아래와 같다.

* 백엔드는 이미 존재한다. FastAPI 기반이다.
* 프론트엔드는 새로 만들 수 있지만, 백엔드 계약은 임의로 바꾸면 안 된다.
* `v0`는 프론트엔드 재설계와 컴포넌트 생성, 레이아웃 실험에 사용한다.
* 최종 구현은 이 저장소의 `frontend/` 아래에서 동작해야 한다.

### Hard Rules

* 새 백엔드를 만들지 않는다.
* 새 API 엔드포인트를 상상해서 만들지 않는다.
* 응답 필드 이름을 임의로 바꾸지 않는다.
* `frontend/` 바깥은 명시적 요청 없이는 수정하지 않는다.
* 레이아웃은 새로 만들되, 실제 데이터는 현재 FastAPI 응답에 바인딩해야 한다.

---

## 2. Core Visual Direction

기본 기준은 아래 두 가지를 함께 따른다.

* 첨부된 레퍼런스 이미지
* 이 문서의 대시보드 설계 규칙

### Reference Image Interpretation

레퍼런스 이미지는 마케팅 사이트가 아니라 관리 도구에 가깝다.
따라서 새 프론트도 아래 특징을 가져야 한다.

* 고정된 좌측 탐색 사이드바
* 높이가 낮은 상단 헤더
* 연한 회색 작업 캔버스
* 큰 여백보다 촘촘한 정보 밀도
* 흰색 카드 중심의 탐색형 UI
* 섹션 제목 + 개수 배지 + 우측 보조 액션 구조
* 엔터프라이즈 어드민 / 운영 콘솔 느낌

### Avoid

* 랜딩페이지형 hero 중심 레이아웃
* 과도한 그라디언트, 과한 모션
* 마케팅 카피 중심 구조
* 불필요하게 큰 카드와 큰 타이포
* 실제 API 연결 전에 mock 응답을 최종 구조처럼 굳히는 것

---

## 3. Overall Layout

전체 앱은 3개 영역으로 구성한다.

### A. Left Sidebar

고정형 좌측 사이드바.

#### Default Sidebar Structure
기본 노출은 `Primary Navigation`만 둔다.

* 메인화면
* 계좌 상태
* 보고서
* 에이전트
* 프롬프트 설정

#### Detail Expansion Rule
세부 설정과 하위 화면은 처음부터 사이드바에 모두 노출하지 않는다.
사용자가 `Primary Navigation` 항목을 클릭했을 때만 해당 영역의 세부 설정, 하위 메뉴, 상세 패널을 볼 수 있게 한다.

예시:
* `에이전트` 클릭 시: 데이터 수집, 데이터 분석, 보고서 작성, 매수/매도 판단, 주문 실행, 로그/평가
* `프롬프트 설정` 클릭 시: 메인 에이전트 프롬프트, 에이전트별 프롬프트, 세부 워크스페이스 설정
* `계좌 상태` 클릭 시: 한국투자증권 연결 정보, 보유 종목, 자산 요약

#### Sidebar Rules
* 기본 상태는 단순해야 한다.
* 세부 설정은 클릭 후 확장되거나 별도 패널에서 보여준다.
* 그룹 사이에 구분선을 둔다.
* hover는 가볍게만 준다.
* active 상태는 soft blue 배경으로 표시한다.
* 아이콘과 라벨을 같이 둔다.
* 레퍼런스 이미지처럼 리소스 카운트/보조 라벨이 붙어도 된다.

### B. Top Header

얇고 고정되는 상단 헤더.

* 왼쪽: 화면 제목 또는 workspace 맥락
* 중앙 또는 좌측 확장 영역: 검색 입력
  * placeholder: `심볼, run_id, 에이전트, 리포트 이름으로 검색…`
* 오른쪽:
  * workspace selector (`Main Console`)
  * `새 실행` 버튼

#### Header Rules
* 과한 장식 없이 얇고 정돈된 형태
* 약한 blur 또는 반투명 배경 허용
* 레퍼런스 이미지처럼 도구모음 역할을 해야 한다

### C. Main Content Area

스크롤 가능한 메인 작업 영역.

* 섹션 단위로 나눈다.
* 각 섹션은 제목, 개수, 보조 액션을 둘 수 있다.
* 공통 레이아웃을 기계적으로 반복하지 말고, 각 화면의 목표와 데이터 성격에 맞는 구조를 선택한다.
* 카드, 리스트, 테이블, 스플릿 패널, 타임라인, 캔버스형 뷰 등 필요한 패턴을 화면별로 다르게 사용할 수 있다.
* 구조 선택은 정보 밀도, 주요 액션, 비교 필요성, 상태 변화 표현 방식이 가장 잘 드러나는지를 기준으로 판단한다.

---

## 4. Page Layout and Functional Detail

페이지 구현 우선순위는 아래 기준을 따른다.

### 4.1 메인화면

메인화면은 메인 에이전트와 직접 소통하는 허브다.

필수 구성:
* 메인 에이전트와 소통 기능
  * 채팅창
  * 기존 실행 결과에 대한 follow-up 질문
  * 필요 시 워크플로우 재실행
* 메인 에이전트 프롬프트 표시
  * 현재 어떤 목표와 지시로 실행되는지 노출
  * 별도 설정 화면으로 이동 가능하게 연결
* 자동매매 승인 스위치
  * 사용자가 현재 실행에서 라이브 승인 요구 여부를 쉽게 확인/변경 가능해야 함

### 4.2 에이전트 히스토리 타임라인

에이전트가 자율적으로 수행한 작업을 타임라인 형태로 볼 수 있어야 한다.

필수 구성:
* 에이전트별 상태 표시
  * 러닝중
  * 연결됨
  * 연결안됨
* 작업 타임라인 나열
  * 어떤 단계가 어떤 순서로 실행됐는지 기록
  * 후속 지시 반영 재실행도 구분되어야 함
* 기록 저장
  * 최근 워크플로우 기록이 프론트에서 다시 열릴 수 있어야 함

### 4.3 보고서

보고서 영역은 주문 전에 확인해야 하는 정보를 프론트에 보여주는 화면이다.

필수 구성:
* 데이터 수집 결과 표시
* 데이터 분석 결과 표시
* 보고서 작성 결과 표시
* 주문 전 판단과 주문 계획 표시
* 데이터 분석 요약은 매번 함께 보여주되 중요도는 낮게 둔다

### 4.4 에이전트 프롬프트 수정 및 세부 설정 페이지

필수 구성:
* 에이전트 프롬프트 수정 페이지
* 선택한 에이전트 프롬프트 상세 편집
* 세부 설정 가능 페이지
  * 메인화면 기본 심볼
  * 최대 비중
  * 리스크 성향
  * 후속 지시 자동 반영 여부
  * 자동매매 승인 기본값
  * 기타 워크스페이스 기본값

### 4.5 계좌 상태

계좌 상태 화면은 한국투자증권 계좌 연결과 현재 자산 상태 확인이 목적이다.

필수 구성:
* 연결할 한국투자증권 계좌 정보 작성 및 적용
* `.env` 파일의 API key 기반 연결 맥락을 사용자에게 반영할 수 있어야 함
  * 프론트가 직접 `.env`를 읽는 방식이 아니라
  * 백엔드가 사용하는 연결 상태 또는 입력값과 연동되는 구조를 우선 고려
* 토스 UI처럼 현재 보유 종목, 수익률, 평가금액, 손익을 직관적으로 볼 수 있어야 함

---

## 5. Main Dashboard Structure

메인화면은 `Discover`형 대시보드로 설계한다.

### Section 1. Recently Viewed Workflow Runs

* 3열 카드 그리드
* 최근 실행한 메인 에이전트 워크플로우 카드
* 각 카드에는 아래 내용 포함
  * run title 또는 objective
  * runtime 상태 / execution mode
  * supervisor summary 2~3줄
  * symbols, risk tolerance, runtime mode 같은 작은 태그
* hover 시 살짝 떠오르고 border가 강조된다

### Section 2. Favorite Agent Views

* 같은 3열 카드 구조
* Section 1보다 약간 더 compact
* 카드 우측 상단에 star icon
* 예시 내용
  * 데이터 수집: 시세, 뉴스, 재무지표 요약
  * 데이터 분석: 점수, 시그널, 해석 근거
  * 보고서 작성: 상승 포인트, 하락 포인트, 리스크 플래그
  * 매수/매도 판단: 액션, 신뢰도, 판단 근거
  * 주문 실행: 제출 가능 여부, 수량, 차단 사유
  * 로그/평가: 의사결정 수, 주문 수, 후속 확인 메모

### Section 3. Favourite Workflow Groups

* 3열 카드 또는 horizontal scroll
* 각 카드에는 mini node/flow visualization 포함
* light background canvas 스타일
* multi-agent execution map preview처럼 보여야 한다

예시 그룹:
* 데이터 수집 -> 데이터 분석 -> 보고서 작성
* 보고서 작성 -> 매수/매도 판단 -> 주문 실행
* 메인 에이전트 -> 정책 가드레일 -> 주문 계획

### Section 4. Workflow Run Action Panel

실행 입력을 위한 관리 패널.

필드:
* symbols
* max_position_weight
* user_prompt
* allowed_symbols
* excluded_symbols
* risk_tolerance
* user_notes
* auto_trading_enabled
* apply_chat_to_workflow

### Section 5. Follow-up Assistant Panel

기존 실행 결과에 대해 후속 질문 또는 재실행 지시를 보내는 패널.

### Section 6. Save Report Panel

완료된 실행을 저장하는 패널.

필드:
* name
* description

### Section 7. Agent History Timeline

메인 대시보드 또는 인접 패널에서 아래를 보여줄 수 있어야 한다.

* 실행 단계별 타임라인
* 현재 상태 배지
* 최근 재실행 및 저장 이력

---

## 6. Other Screens

### Account Page

* 같은 global shell 유지
* 상단 summary cards
* holdings card grid
* holdings table
* dense admin layout
* 한국투자증권 연결 정보 입력/적용 UI
* 토스 스타일의 자산 요약 감각 반영

### Reports Page

* 좌측: saved report list
* 우측: selected detail panel
* review / replay 콘솔 느낌
* compact metadata rows + structured cards
* 주문 전 데이터 수집, 분석, 보고서, 판단 결과를 순서대로 복기 가능해야 함

### Agents Page

* agents index는 stage catalog 역할
* agent detail은 prompt editor + latest output cards
* 에이전트별 실행 출력과 상태를 확인 가능해야 함

### Prompt Settings Page

* 좌측: prompt list
* 우측: selected prompt editor
* 별도 영역: frontend-local workspace defaults
* 메인 에이전트 프롬프트와 세부 설정 관리 가능해야 함

---

## 7. Visual Style Guide

### Design Style

* Enterprise SaaS dashboard
* Internal trading operations console
* Workflow review / report system
* Technical, clean, minimal, organized

### Color Palette

* Background: `#f7f8fa`
* Cards: `white`
* Borders: `#e5e7eb`
* Primary accent: soft blue (`#4f7cff` 수준)
* Text primary: dark gray
* Text secondary: muted gray

### Typography

* Modern sans-serif
* Inter / SF Pro 계열 감각
* 계층 분명하게 유지
  * section title: bold
  * card title: semibold
  * metadata: small + muted

### Interaction

* card hover elevation
* border color slight change
* sidebar active highlight
* 150~200ms 정도의 짧은 transition
* heavy animation 금지

---

## 8. Backend Connection Mapping

이 프론트는 현재 저장소의 FastAPI 백엔드에 직접 연결되어야 한다.

### API Base Rules

* 로컬 개발에서는 `/api/...` 사용 가능
* 배포 환경에서는 설정된 backend base URL 사용
* transport layer와 UI 구조는 분리하되, 실제 응답 shape에 hydrate 가능해야 한다

### A. 메인화면

#### Primary workflow run
* `POST /decisions`

Request fields:
* `symbols`
* `max_position_weight`
* `user_prompt`
* `chat_messages`
* `mandate`

Response fields used by UI:
* `run_id`
* `symbols`
* `user_prompt`
* `chat_messages`
* `runtime`
* `supervisor_directive.summary`
* `supervisor_directive.objective`
* `supervisor_directive.focus_symbols`
* `supervisor_directive.watch_symbols`
* `supervisor_directive.guidance`
* `market_data`
* `analysis_signals`
* `investment_reports`
* `decisions`
* `orders`
* `evaluation_log`
* `mandate_violations`

### B. 메인 에이전트 후속 대화

* `POST /console/interactions`

Request:
* `run_id`
* `message`
* `apply_to_workflow`

Bind response fields:
* `reply`
* `suggested_actions`
* `applied_to_workflow`
* `updated_result`
* `updated_run_id`

### C. 에이전트 히스토리 / 상태 표시

현재 백엔드에 전용 타임라인 endpoint가 없더라도, 아래 정보를 조합해 단계 기록 UI를 구성한다.

* `POST /decisions` 응답
* `POST /console/interactions` 재실행 응답
* 프론트 로컬 저장 기록
* 필요 시 health / account / report 조회 시점 기록

표시 목표:
* 에이전트별 러닝중
* 연결됨
* 연결안됨
* 실행 순서와 후속 실행 이력

### D. 계좌 상태

* `GET /account`

Bind response fields:
* `available`
* `broker`
* `account_masked`
* `summary.cash_balance`
* `summary.total_purchase_amount`
* `summary.total_evaluation_amount`
* `summary.total_profit_loss`
* `summary.total_profit_loss_rate`
* `holdings`
* `message`

계좌 연결 관련 메모:
* 프론트가 직접 `.env` 파일을 읽는 방식은 지양한다.
* 현재 백엔드가 사용하는 한국투자증권 연결 상태를 반영하거나,
* 사용자가 입력한 연결 정보와 백엔드 응답을 함께 보여주는 구조를 우선 고려한다.

### E. 보고서 화면

* `GET /experiments`
* `GET /experiments/{experiment_id}`
* `POST /experiments/from-run`

Bind detail response fields:
* `name`
* `description`
* `created_at`
* `runtime`
* `result.supervisor_directive`
* `result.investment_reports`
* `result.decisions`
* `result.orders`
* `result.market_data`
* `result.analysis_signals`

### F. 실험형 저장 실행

* `POST /experiments`

이 엔드포인트는 run과 save를 동시에 하는 lab-style UI가 필요할 때만 쓴다.
기본 메인 대시보드의 주 동작으로 두지 않는다.

### G. 에이전트 화면

* `GET /agent-prompts`
* `GET /agent-prompts/{agent_key}`
* `PUT /agent-prompts/{agent_key}`

Agent result cards는 별도 전용 endpoint 없이 아래 중 하나를 사용한다.

* 최근 `POST /decisions` 응답의 client state
* `GET /experiments/{experiment_id}`의 `result`

### H. 프롬프트 설정 화면

* `GET /agent-prompts`
* `PUT /agent-prompts/{agent_key}`

Frontend-only workspace defaults는 브라우저 local state로 유지 가능하다.

예시:
* default symbols
* timeline length
* broker label
* auto-trading toggle
* account alias

### I. 상태 배지 / 시스템 패널

* `GET /health`
* optional: `GET /market-data/{symbol}`

용도:
* backend connectivity badge
* market data source health panel
* simple symbol lookup widget

### J. Direct Order Submission

미래 admin 화면에서만 아래를 사용한다.

* `POST /orders/submit`
* `POST /orders/submissions`

기본 대시보드의 주요 액션으로 취급하지 않는다.
메인 대시보드는 `POST /decisions`가 반환하는 `orders`를 order plan으로 시각화하는 데 집중한다.

---

## 9. v0 Master Prompt

아래 프롬프트는 `v0` 프로젝트의 base prompt 또는 첫 작업 prompt로 바로 사용할 수 있다.

```txt
You are redesigning the frontend of an existing repository.

Project constraints:
- This repository already has a working FastAPI backend.
- Do not create a new backend.
- Do not invent new endpoints or new response shapes.
- Only modify files under frontend/ unless explicitly requested.
- Preserve compatibility with the current backend API.
- Use the existing frontend as implementation context, but do not preserve its current layout.
- The new UI should follow the attached reference image and front-design.md.

Design direction:
- Match the information architecture of the attached reference image:
  - fixed left sidebar
  - thin sticky top header
  - light gray canvas
  - white content cards
  - dense enterprise admin/workflow console feel
- The sidebar should default to primary navigation only.
- Detailed settings or submenus should appear only after clicking the relevant primary navigation item.
- Avoid marketing-style hero layouts.
- Avoid oversized landing-page sections.
- Prefer operational UI, structured grids, resource lists, and panel-based layouts.
- Keep the interface clean, technical, minimal, and highly organized.
- Support desktop first, but remain responsive on mobile.

Functional requirements:
- Main dashboard must include:
  - main agent communication UI (chat)
  - main agent prompt visibility
  - auto-trading approval switch
- Agent history timeline must include:
  - running / connected / disconnected state display per agent
  - task timeline and saved history
- Reports must display:
  - pre-order data collection results
  - analysis results
  - report-writing output
  - final decisions and order plans
  - compact analysis summaries when available
- Prompt settings must allow:
  - agent prompt editing
  - detailed workspace configuration
- Account page must allow:
  - Korea Investment account connection-oriented UI
  - account info entry/apply flow
  - portfolio summary with Toss-like clarity for holdings, profit/loss, and returns

Tech requirements:
- Next.js App Router
- TypeScript
- Reuse the repository’s frontend app structure where practical
- Keep API transport compatible with local /api usage and configurable production backend base URL
- Implement loading, empty, error, and success states
- Do not replace real API bindings with fake/mock data once API integration is requested

Backend contract rules:
- Use only the existing endpoints listed below
- If any field shape is unclear, ask instead of assuming
- Do not claim the frontend directly reads .env values; if environment-backed account connectivity is needed, reflect it through the backend contract or connection UI state

Screen responsibilities:
- Main dashboard:
  - POST /decisions
  - POST /console/interactions
  - POST /experiments/from-run
- Account page:
  - GET /account
- Reports page:
  - GET /experiments
  - GET /experiments/{experiment_id}
- Prompt settings / agent prompts:
  - GET /agent-prompts
  - PUT /agent-prompts/{agent_key}
- Health:
  - GET /health

What I want from you:
1. Read the existing frontend structure in frontend/
2. Read front-design.md
3. Read docs/api-contracts.md
4. Propose the new information architecture and component map
5. Implement the redesign incrementally, starting with:
   - global app shell
   - sidebar with primary-navigation-first behavior
   - top header
   - main dashboard layout
   - agent history timeline layout
6. After layout is approved, wire the screens to the real backend endpoints
7. Keep changes modular and production-ready
```

---

## 10. Screen-Specific v0 Prompts

### Main Dashboard Prompt

```txt
Redesign the main dashboard screen only.

Requirements:
- Use the attached reference image and front-design.md as layout direction
- Keep a fixed left sidebar and thin sticky top header
- The sidebar should initially show only primary navigation items, then reveal detailed settings or submenus after the user selects a primary item
- Main content should feel like an ontology/discover/admin console, not a landing page
- Use section-based content with white cards on a light gray canvas

Implement these sections:
1. Recently viewed workflow runs
2. Favorite agent views
3. Favourite workflow groups
4. Workflow run action panel
5. Main agent chat panel
6. Main agent prompt visibility panel
7. Auto-trading approval switch
8. Agent history timeline panel
9. Save report panel

Real backend integration:
- POST /decisions
- POST /console/interactions
- POST /experiments/from-run

Bind these fields:
- run_id
- supervisor_directive.summary
- supervisor_directive.objective
- runtime
- market_data
- analysis_signals
- investment_reports
- decisions
- orders
- evaluation_log

Rules:
- No fake backend
- No new API contracts
- Dense, operational UI
- Keep cards compact and structured
```

### Account Page Prompt

```txt
Redesign the account page only.

Design direction:
- Same global shell as the main dashboard
- Dense operations/admin layout
- Summary cards on top, holdings cards and holdings table below
- White cards on light gray background
- Portfolio display should feel as immediately readable as Toss UI

Real backend integration:
- GET /account

Bind:
- summary.cash_balance
- summary.total_purchase_amount
- summary.total_evaluation_amount
- summary.total_profit_loss_rate
- holdings
- available
- message

Additional requirements:
- Include Korea Investment account connection-oriented UI
- Allow account info entry/apply flow
- Do not claim direct browser access to .env values
- Reflect environment-backed backend connectivity through connection state or explanatory UI

Rules:
- Account connection inputs remain frontend-local only unless a backend API already exists
- Show loading, empty, unavailable, and success states clearly
- Keep typography and spacing aligned with the dashboard shell
```

### Reports Page Prompt

```txt
Redesign the reports page only.

Design direction:
- Same shell as the dashboard
- Left list panel + right detail panel
- Enterprise review console feel
- Compact metadata rows, structured cards, and detailed sections

Real backend integration:
- GET /experiments
- GET /experiments/{experiment_id}

Bind detail fields:
- name
- description
- created_at
- result.supervisor_directive
- result.investment_reports
- result.analysis_signals
- result.decisions
- result.orders
- result.market_data
- runtime

Rules:
- Do not invent report structures outside the current backend contract
- Keep the left list navigable and compact
- Make the right detail panel optimized for review/replay
- Show data collection -> analysis -> report -> decision/order flow clearly
- Analysis summaries can be visually lighter than core report output
```

### Agents Prompt

```txt
Redesign the agent pages and agents index.

Design direction:
- Same admin shell
- Agents index should act like a catalog of workflow stages
- Agent detail page should show:
  - prompt editor
  - latest output cards from the latest workflow result
  - state/status visibility when possible

Real backend integration:
- GET /agent-prompts
- PUT /agent-prompts/{agent_key}
- Latest agent outputs should come from the latest stored POST /decisions result in client state

Rules:
- Do not invent agent-specific backend endpoints
- Keep stage navigation clear
- Show prompt state and latest output in separate structured panels
```

### Prompt Settings Prompt

```txt
Redesign the prompt settings page only.

Design direction:
- Same shell
- Primary navigation first, then reveal prompt-related detail panels after entering the settings area
- Inside the settings area show left prompt list, right prompt editor, and lower or side workspace defaults panel
- Dense settings UI, not marketing UI

Real backend integration:
- GET /agent-prompts
- PUT /agent-prompts/{agent_key}

Frontend-local settings:
- default_symbols
- default_max_position_weight
- default_risk_tolerance
- auto_apply_chat_followups
- timeline_limit
- auto_trading_enabled
- account_alias
- broker_label

Rules:
- Keep backend prompt config and frontend-local workspace defaults visually separated
- Preserve real prompt save/load behavior
- Make main agent prompt and detailed workflow settings easy to edit
```

---

## 11. Frontend API Contract Summary for v0

`docs/api-contracts.md` 전체 대신 먼저 붙여 넣을 수 있는 요약본이다.

```txt
Frontend API contract summary

Base rules:
- Local dev can call /api/...
- Production should use configured backend base URL
- Do not invent endpoints beyond these

Health:
- GET /health
- Use for backend connectivity indicator

Main dashboard:
- POST /decisions
Request:
- symbols: string[]
- max_position_weight: number
- user_prompt: string
- chat_messages: string[]
- mandate:
  - objective: string
  - allowed_symbols: string[]
  - excluded_symbols: string[]
  - max_order_notional: number | null
  - min_cash_weight: number | null
  - risk_tolerance: low | medium | high
  - requires_approval_for_live_orders: boolean
  - user_notes: string

Response fields used by UI:
- run_id
- symbols
- user_prompt
- chat_messages
- runtime
- supervisor_directive.summary
- supervisor_directive.objective
- supervisor_directive.focus_symbols
- supervisor_directive.watch_symbols
- supervisor_directive.guidance
- market_data[]
- analysis_signals[]
- investment_reports[]
- decisions[]
- orders[]
- evaluation_log
- mandate_violations[]

Follow-up assistant:
- POST /console/interactions
Request:
- run_id: string
- message: string
- apply_to_workflow: boolean

Response:
- reply
- suggested_actions
- applied_to_workflow
- updated_run_id
- updated_result

Account:
- GET /account
Response:
- available
- broker
- account_masked
- summary:
  - cash_balance
  - total_purchase_amount
  - total_evaluation_amount
  - total_profit_loss
  - total_profit_loss_rate
- holdings[]
- message

Reports:
- GET /experiments
Response list item:
- experiment_id
- run_id
- name
- description
- created_at
- symbols[]
- decision_actions
- runtime

- GET /experiments/{experiment_id}
Response:
- experiment_id
- run_id
- name
- description
- created_at
- decision
- prompt_overrides
- runtime
- result

Save completed run:
- POST /experiments/from-run
Request:
- run_id
- name
- description

Agent prompts:
- GET /agent-prompts
- PUT /agent-prompts/{agent_key}

Do not:
- create a new backend
- create mock API data for final implementation
- rename existing response fields without adapter logic
- claim direct frontend access to .env secrets
```

---

## 12. Recommended v0 Workflow

추천 작업 순서는 아래와 같다.

1. 이 문서 + 레퍼런스 이미지 + `docs/api-contracts.md`를 `v0`에 넣는다.
2. 먼저 `Master Prompt`로 전체 구조와 component map을 받는다.
3. 메인 대시보드와 에이전트 히스토리 타임라인을 먼저 생성한다.
4. 계좌, 보고서, 에이전트, 설정 화면 순서로 분리 작업한다.
5. 마지막에 공통 스타일 정리와 API wiring 검증을 요청한다.
6. 로컬에서 `npm run build`와 실제 백엔드 연동을 검증한다.

### Recommended First Message to v0

```txt
I want to completely redesign the frontend for this repository.

Context:
- The backend already exists in FastAPI.
- You must not create a new backend or invent new APIs.
- Use only the existing backend endpoints from docs/api-contracts.md.
- Work only inside frontend/ unless absolutely necessary.
- The design direction should follow the attached screenshot and front-design.md.

Tasks for this step:
1. Read and summarize the existing frontend structure.
2. Read front-design.md and docs/api-contracts.md.
3. Propose a screen architecture for:
   - main dashboard
   - account page
   - reports page
   - agent pages
   - prompt settings
4. Map each screen to real backend endpoints and response fields.
5. Then implement only the global shell, the main dashboard layout, and the agent history timeline first.

Design requirements:
- Match the attached reference image’s information architecture:
  fixed left navigation, thin top header, light gray canvas, white cards, enterprise admin feel.
- The sidebar should not expose every submenu by default; it should start from primary navigation and reveal detailed settings after the relevant menu is clicked.
- Avoid hero-heavy marketing layout.
- Prefer dense, operational UI.
- Main screen must include chat, main prompt visibility, and auto-trading approval switch.
- Account screen must support Korea Investment account connection-oriented UI and Toss-like holdings readability.
```
