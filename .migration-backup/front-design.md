# AI Website Builder Prompt

## Goal
Build a modern enterprise-style web dashboard UI inspired by an investment workflow console for a multi-agent trading support system.

Focus on:
- Layout structure
- Visual hierarchy
- Component design
- Real functionality connected to the current backend APIs
- Real data rendering based on actual API responses


---

## 1. Overall Layout

Create a full-page dashboard layout with 3 main regions:

### A. Left Sidebar (Fixed)
- Fixed vertical navigation on the left
- Clean, minimal design with icons + labels
- Sections:

#### Primary Navigation
- 메인화면 (active state highlight)
- 계좌 상태
- 보고서
- 에이전트
- 프롬프트 설정

#### Workflow Stage Section
- 데이터 수집
- 데이터 분석
- 보고서 작성
- 매수/매도 판단
- 주문 실행
- 로그/평가

#### System Section (bottom)
- 런타임 모드
- 정책 가드레일
- 브로커 연결
- 시장 데이터 소스
- 워크플로우 기록
- 실험 저장소
- 워크스페이스 설정 (settings gear style)

Design rules:
- Subtle dividers between groups
- Light hover effect
- Active item highlighted with soft blue background

---

### B. Top Header (Sticky)
- Full width top bar
- Left: Search input
  - Placeholder: “심볼, run_id, 에이전트, 리포트 이름으로 검색…”
- Right:
  - Workspace selector dropdown (“Main Console”)
  - “새 실행” button (primary action)
- Keep minimal, clean, slightly blurred background effect

---

### C. Main Content Area
Scrollable content area with structured sections.

---

## 2. Content Sections

### Section 1: Recently Viewed Workflow Runs
- Title at top
- Grid layout (3 columns)
- Each item is a **card**

Card design:
- Run title or objective (bold)
- Runtime status or execution mode (small muted text)
- Short summary of the main agent directive (2–3 lines max)
- Small tags such as symbols, risk tolerance, runtime mode
- Subtle border + shadow
- Hover: lift + highlight border

Example content themes:
- 최근 실행한 메인 에이전트 워크플로우
- 후속 지시가 반영된 재실행 기록
- 저장 전 임시 실행 결과

---

### Section 2: Favorite Agent Views
- Same grid layout but slightly more compact cards
- Add star icon on top-right of each card
- Keep consistent spacing with previous section

Card content examples:
- 데이터 수집: 시세, 뉴스, 재무지표 요약
- 데이터 분석: 점수, 시그널, 해석 근거
- 보고서 작성: 상승 포인트, 하락 포인트, 리스크 플래그
- 매수/매도 판단: 액션, 신뢰도, 판단 근거
- 주문 실행: 제출 가능 여부, 수량, 차단 사유
- 로그/평가: 의사결정 수, 주문 수, 후속 확인 메모

---

### Section 3: Favourite Workflow Groups
- Horizontal scroll or 3-column grid
- Each card contains:
  - Mini node/flow visualization showing the workflow sequence
  - Light background canvas style
- Looks like a multi-agent execution map preview

Example group themes:
- 데이터 수집 -> 데이터 분석 -> 보고서 작성
- 보고서 작성 -> 매수/매도 판단 -> 주문 실행
- 메인 에이전트 -> 정책 가드레일 -> 주문 계획

---

## 3. Visual Style Guide

### Design Style
- Enterprise SaaS dashboard
- Inspired by:
  - multi-agent workflow consoles
  - internal trading operations dashboards
  - execution review and report systems

### Color Palette
- Background: #f7f8fa (very light gray)
- Cards: white
- Borders: #e5e7eb
- Primary accent: soft blue (#4f7cff or similar)
- Text:
  - Primary: dark gray
  - Secondary: muted gray

### Typography
- Use modern sans-serif (Inter / SF Pro style)
- Strong hierarchy:
  - Section titles: bold
  - Card titles: semi-bold
  - Metadata: small + muted

---

## 4. Interaction Design

- Hover effects:
  - Card elevation
  - Slight border color change
- Sidebar:
  - active item highlight with soft blue background
- Smooth transitions (150–200ms)
- No heavy animations

---

## 5. UX Feel

The UI should feel:
- Structured
- Technical
- Clean and minimal
- Highly organized like an investment workflow control system

---

## 6. Implementation Constraint

Do implement:
- real backend integration
- real data binding from API responses
- meaningful UI states for loading, empty, error, and success
- practical user actions that map to the existing backend endpoints

Preserve and prioritize:
- layout
- spacing
- UI structure
- visual hierarchy
- clarity of workflow state and execution results

---

## 7. Backend Connection Mapping

This design should be implemented so the frontend can connect directly to the current FastAPI backend of this repository.

### API Base Rules
- In local development, frontend requests can use `/api/...`
- In production/static deployment, requests should use the configured backend base URL
- Keep the UI structure independent from the transport layer, but design components so they can be hydrated from the response shapes below

### A. 메인화면
- Primary workflow run action:
  - `POST /decisions`
- Use this endpoint when the user clicks `새 실행`, `실행`, or equivalent primary workflow actions
- Request should include:
  - `symbols`
  - `max_position_weight`
  - `user_prompt`
  - `chat_messages`
  - `mandate`
- Bind response fields into the dashboard:
  - `run_id` -> active run id state
  - `supervisor_directive.summary` -> main summary card
  - `runtime` -> runtime status / mode badges
  - `market_data` -> data collection cards
  - `analysis_signals` -> analysis cards
  - `investment_reports` -> pre-order report cards
  - `decisions` -> final action cards
  - `orders` -> order planning cards
  - `evaluation_log` -> execution recap / timeline summary

### B. 메인 에이전트 후속 대화
- Follow-up assistant interaction:
  - `POST /console/interactions`
- Use this endpoint for chat questions about an existing workflow result
- If the UI has “follow-up instruction should rerun workflow” behavior:
  - send `run_id`
  - send `message`
  - send `apply_to_workflow=true`
- Bind response fields:
  - `reply` -> assistant message panel
  - `suggested_actions` -> suggestion chips or helper actions
  - `updated_result` -> refresh dashboard cards when rerun is applied
  - `updated_run_id` -> replace current active run context

### C. 계좌 상태
- Account snapshot source:
  - `GET /account`
- Bind response fields:
  - `summary.cash_balance` -> 예수금
  - `summary.total_purchase_amount` -> 총매입금액
  - `summary.total_evaluation_amount` -> 총평가금액
  - `summary.total_profit_loss_rate` -> 총수익률
  - `holdings` -> 보유 종목 카드와 표
  - `available`, `message` -> empty state or connection status

### D. 보고서 화면
- Saved report list:
  - `GET /experiments`
- One saved report detail:
  - `GET /experiments/{experiment_id}`
- Save a completed run as a report:
  - `POST /experiments/from-run`
- Recommended usage:
  - left list panel uses `GET /experiments`
  - selected detail panel uses `GET /experiments/{experiment_id}`
  - save button after a workflow run uses `POST /experiments/from-run` with `run_id`, `name`, `description`
- Bind detail response fields:
  - `name`, `description`, `created_at` -> report header
  - `result.supervisor_directive` -> main report summary
  - `result.investment_reports` -> report insight cards
  - `result.decisions` and `result.orders` -> outcome section
  - `result.market_data` -> collected data section
  - `runtime` -> runtime metadata cards

### E. 실험형 저장 실행이 필요한 경우
- If the UI includes prompt override based execution:
  - `POST /experiments`
- Use this when a screen should both run the workflow and save the result in one action
- This is better suited to experiment or lab-style UI than the default main dashboard

### F. 에이전트 화면
- List all persisted prompts:
  - `GET /agent-prompts`
- Read one prompt:
  - `GET /agent-prompts/{agent_key}`
- Save one prompt:
  - `PUT /agent-prompts/{agent_key}`
- Agent result cards do not need a separate agent-specific backend endpoint in the current implementation
- Each agent detail screen can render its latest output from:
  - the last `POST /decisions` response kept in client state
  - or `result` from `GET /experiments/{experiment_id}` when viewing a saved run

### G. 프롬프트 설정 화면
- Prompt configuration source:
  - `GET /agent-prompts`
- Prompt update action:
  - `PUT /agent-prompts/{agent_key}`
- Recommended UI split:
  - left side: agent prompt list
  - right side: selected prompt editor
- Frontend-only workspace defaults such as default symbols, timeline length, broker label, auto-trading toggle can remain local browser state unless a new backend settings API is added

### H. 상태 배지 / 시스템 패널
- Health indicator:
  - `GET /health`
- Optional market lookup widget:
  - `GET /market-data/{symbol}`
- Use these for:
  - backend connectivity badge
  - market data source health panel
  - simple symbol inspection widget

### I. Direct Order Submission
- If a future admin-style screen exposes direct broker order submission, connect:
  - `POST /orders/submit`
  - `POST /orders/submissions`
- Do not treat this as the default action of the dashboard
- The main workflow dashboard should primarily visualize `orders` returned from `POST /decisions`, which are order plans, not default live submissions
