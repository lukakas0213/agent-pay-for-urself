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
기본 노출에서 `Primary Navigation`과 각 항목의 `Sub Navigation`을 함께 둔다.

* 대시보드
  * 메인 에이전트 소통
  * 현재 실행 요약
  * 재실행 진입점
* 에이전트
  * 메인 에이전트
  * 데이터 수집
  * 데이터 분석
  * 보고서 작성
  * 매수/매도 판단
  * 주문 실행
  * 로그/평가
* 히스토리
* 보고서
  * 보고서 확인
* 계좌
  * 계좌 연결
  * 계좌 상태 확인

#### Detail Expansion Rule
사이드바는 첫 진입부터 상위 메뉴와 하위 메뉴를 모두 노출한다.
화면 폭이 좁거나 정보 밀도가 과해지는 경우에만 그룹 접기, 스크롤, 별도 패널 보조 구성을 사용한다.

예시:
* `대시보드` 그룹은 기본 상태에서 메인 에이전트 소통, 현재 실행 요약, 재실행 진입점을 함께 보여준다.
* `에이전트` 그룹은 기본 상태에서 메인 에이전트와 각 실행 에이전트 목록을 모두 보여준다.
* `히스토리` 그룹은 기본 상태에서 단일 진입 메뉴로만 노출한다.
* `보고서` 그룹은 기본 상태에서 보고서 확인 진입점을 보여준다.
* `계좌` 그룹은 기본 상태에서 계좌 연결과 계좌 상태 확인 진입점을 함께 보여준다.

#### Sidebar Rules
* 기본 상태에서 상위 메뉴와 하위 메뉴를 모두 확인할 수 있어야 한다.
* 세부 설정은 필요한 경우에만 추가 확장되거나 별도 패널에서 보여준다.
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

### 4.1 대시보드

대시보드는 메인 에이전트와 직접 소통하는 허브다.

필수 구성:
* 메인 에이전트와 소통 기능
  * 채팅창
  * 기존 실행 결과에 대한 follow-up 질문
  * 필요 시 워크플로우 재실행
* 메인 에이전트 프롬프트 표시
  * 현재 어떤 목표와 지시로 실행되는지 노출
  * 관련 편집 화면으로 이동 가능하게 연결
* 자동매매 승인 스위치
  * 사용자가 현재 실행에서 라이브 승인 요구 여부를 쉽게 확인/변경 가능해야 함

### 4.2 에이전트

에이전트 화면은 메인 에이전트와 개별 실행 에이전트를 분리해 탐색하는 허브다.

필수 구성:
* 메인 에이전트 전용 진입점
  * 메인 목표, 현재 프롬프트, 최근 응답 흐름 확인
* 개별 에이전트 목록
  * 데이터 수집
  * 데이터 분석
  * 보고서 작성
  * 매수/매도 판단
  * 주문 실행
  * 로그/평가
* 각 에이전트 상세 화면
  * 현재 저장된 프롬프트
  * 최근 실행 출력
  * 이전 결과와 현재 결과 비교에 필요한 요약

### 4.3 히스토리 타임라인

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

### 4.4 보고서

보고서 영역은 주문 전에 확인해야 하는 정보를 프론트에 보여주는 화면이다.

필수 구성:
* 보고서 확인 진입점
* 데이터 수집 결과 표시
* 데이터 분석 결과 표시
* 보고서 작성 결과 표시
* 주문 전 판단과 주문 계획 표시
* 데이터 분석 요약은 매번 함께 보여주되 중요도는 낮게 둔다

### 4.5 계좌

계좌 화면은 한국투자증권 계좌 연결과 현재 자산 상태 확인이 목적이다.

필수 구성:
* 계좌 연결 진입점
  * 연결할 한국투자증권 계좌 정보 작성 및 적용
* 계좌 상태 확인 진입점
  * 현재 자산 상태, 보유 종목, 수익률 확인
* `.env` 파일의 API key 기반 연결 맥락을 사용자에게 반영할 수 있어야 함
  * 프론트가 직접 `.env`를 읽는 방식이 아니라
  * 백엔드가 사용하는 연결 상태 또는 입력값과 연동되는 구조를 우선 고려
* 토스 UI처럼 현재 보유 종목, 수익률, 평가금액, 손익을 직관적으로 볼 수 있어야 함

---

## 5. Main Dashboard Structure

대시보드는 `Discover`형 메인 콘솔로 설계한다.

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
* 계좌 연결 폼과 상태 요약을 한 화면 또는 인접 패널로 제공
* 상단 summary cards
* holdings card grid
* holdings table
* dense admin layout
* 한국투자증권 연결 정보 입력/적용 UI
* 토스 스타일의 자산 요약 감각 반영

### Reports Page

* 좌측: saved report list
* 우측: selected detail panel
* 보고서 확인이 가장 빠르게 이뤄져야 함
* review / replay 콘솔 느낌
* compact metadata rows + structured cards
* 주문 전 데이터 수집, 분석, 보고서, 판단 결과를 순서대로 복기 가능해야 함

### Agents Page

* agents index는 stage catalog 역할
* 메인 에이전트 entry와 개별 에이전트 entry를 구분해 보여준다
* agent detail은 prompt editor + latest output cards
* 에이전트별 실행 출력과 상태를 확인 가능해야 함

### History Timeline Page

* 실행 단위 목록과 상세 타임라인을 나란히 배치할 수 있다
* 단계별 상태 변화와 재실행 분기를 구분해야 한다
* 메인 에이전트 지시와 각 에이전트 출력을 시간 순서로 연결해 보여준다

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

### A. 대시보드

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

### C. 히스토리 타임라인 / 상태 표시

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

### D. 계좌

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

메인 에이전트와 개별 에이전트 모두 같은 프롬프트 API 계층을 공유하되,
화면 구조는 메인 에이전트를 상단 또는 별도 그룹으로 분리해 보여준다.

### H. 상태 배지 / 시스템 패널

* `GET /health`
* optional: `GET /market-data/{symbol}`

용도:
* backend connectivity badge
* market data source health panel
* simple symbol lookup widget

### I. Direct Order Submission

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
  - compact top toolbar
  - gray app canvas
  - white cards
  - dense but clean enterprise dashboard layout
- Build the sidebar around these primary sections:
  - Dashboard
  - Agents
  - History Timeline
  - Reports
  - Accounts
- The Agents section should expand into:
  - Main Agent
  - individual agents such as market data collection, analysis, report writing, decision, order execution, evaluation
- The Reports section should include report review.
- The Accounts section should include account connection and account status.
- The Dashboard must be the main hub for chatting with the main agent, follow-up questions, and rerunning workflows.
- Keep the UI practical, operational, and admin-console-like.
- Avoid marketing-site patterns.

Data and behavior constraints:
- Bind UI state to the existing FastAPI endpoints described in front-design.md.
- Prefer reusable layout primitives, but do not make every page look identical.
- Do not add fake data dependencies as if they were real APIs.
- If a timeline endpoint does not exist, compose the timeline from existing run data and local UI state.

Implementation goals:
- Produce a polished frontend for the repository's trading-agent workflow.
- Maintain a strong sidebar-shell layout and dashboard usability.
- Prioritize report readability, agent traceability, and account visibility.
```
