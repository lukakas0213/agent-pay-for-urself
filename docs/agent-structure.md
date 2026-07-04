# 에이전트 구조

## 현재 목표 구조

이 저장소가 앞으로 맞출 기본 그래프는 아래와 같다.

사용자

→ Web UI

→ API 서버

→ 메인 에이전트

→ 데이터 수집 에이전트

→ 데이터 분석 에이전트

→ 보고서 에이전트

→ 매수/매도 에이전트

→ 피드백 에이전트

메인 에이전트는 전체 허브다. 각 서브 에이전트의 결과를 받고 다음 단계를 호출한다. 피드백 에이전트는 시스템 전반을 감시하면서 다음 실행에서 재수집 또는 재분석이 필요한 지점을 정리한다.

## 단계별 책임

### 메인 에이전트

* `user_prompt`, `chat_messages`, `symbols`, `mandate`를 해석한다.
* 이번 실행의 `focus_symbols`, `watch_symbols`, `guidance`를 `SupervisorDirective`로 정리한다.
* 데이터 수집, 분석, 보고서, 매수/매도, 피드백 단계의 순서를 조정한다.
* 현재 구현에서는 mandate 위반을 검사하고 결과에 반영한다.

### 데이터 수집 에이전트

* 종목별 시세, 뉴스, 재무 지표를 가져온다.
* 현재 구현은 `StubMarketDataProvider`를 사용한다.
* 향후 랭그래프에서는 데이터 부족 시 피드백을 받아 재수집 루프에 들어간다.

### 데이터 분석 에이전트

* 수집된 시장 데이터를 `AnalysisSignal`로 압축한다.
* 현재 fallback 로직은 가격, 뉴스 유무, `pe_ratio`를 기반으로 단순 점수를 계산한다.
* 향후 랭그래프에서는 피드백에 따라 재분석 루프를 수행한다.

### 보고서 에이전트

* 분석 결과를 투자 보고서 형태로 구조화한다.
* `bull_points`, `bear_points`, `risk_flags`, `recommended_action_bias`, `signal_strength`를 만든다.
* 현재 구현에서는 리스크 플래그가 있으면 `risk_approved=false`로 처리한다.

### 매수/매도 에이전트

* 보고서를 읽고 `BUY`, `SELL`, `HOLD`를 결정한다.
* 현재 구현에서는 보고서가 리스크 미승인이면 무조건 `HOLD`로 고정한다.

### 피드백 에이전트

* 데이터 수집, 데이터 분석, 보고서, 매수/매도 단계를 감시한다.
* 현재 구현은 `WorkflowFeedback`을 만들고, 재수집/재분석/재정리 필요 지점을 `follow_up_actions`로 남긴다.
* 아직 이전 단계로 실제로 되돌아가 다시 실행하지는 않는다.

## 현재 구현 상태

현재 저장소는 외부 LangGraph 패키지 대신 내부 `StateGraph` 런타임으로 그래프를 실행한다.

* 백엔드 진입점: `artifacts/api-server/src/routes/decisions.ts`
* 오케스트레이터: `artifacts/api-server/src/engine/orchestrator.ts`
* 에이전트 로직: `artifacts/api-server/src/engine/agents.ts`
* 프롬프트 저장소: `artifacts/api-server/src/lib/agent-prompts-store.ts`
* 프론트 에이전트 화면 계약: `artifacts/agent-pay-for-urself/src/lib/workspace.ts`

현재 그래프는 아래 순서와 루프 조건으로 실행된다.

1. 메인 에이전트가 지시와 심볼을 확정한다.
2. 데이터 수집을 한 번 수행한다.
3. 데이터 분석을 한 번 수행한다.
4. 보고서를 한 번 작성한다.
5. 매수/매도 결정을 한 번 생성한다.
6. 피드백 에이전트가 시스템 피드백을 생성한다.

## 랭그래프 이전에 반영된 변경점

기존 구조의 `주문 실행`, `로그/평가` 단계를 기본 워크플로우에서 제거했다.
이제 기본 구조는 아래 다섯 서브 에이전트에 맞춘다.

* `data_collection`
* `data_analysis`
* `report`
* `buy_sell`
* `feedback`

프론트와 API도 이 키를 기준으로 화면과 프롬프트 편집 대상을 노출한다.

## 다음 단계에서 구현할 것

랭그래프로 옮길 때 구현할 핵심은 아래다.

* 현재 구현은 이미 `main -> data_collection/data_analysis/report/buy_sell/feedback` 노드와 피드백 기반 루프를 사용한다.
* 다음 단계에서는 외부 `@langchain/langgraph` 패키지로 교체하거나 checkpoint, persistence, streaming을 추가한다.
