# 프로젝트 개요

## 목표

이 프로젝트는 AI 에이전트를 활용하여 주식 데이터를 수집, 분석, 평가하고 투자 의사결정을 지원하는 멀티 에이전트 투자 플랫폼이다.

최종 목적은 사람이 상시 개입하지 않아도 에이전트가 24/7로 주식 시장을 감시하고, 투자 기회를 분석하고, 포지션을 관리하며, 사전에 정한 정책과 리스크 한도 안에서 매매까지 수행하는 자동 운용 시스템을 만드는 것이다.

시스템은 단순한 LLM 챗봇이나 수동 분석 도구가 아니라 실제 투자 의사결정 과정을 구조화하여 수행하는 것을 목표로 한다. 사용자는 모든 단계를 직접 조작하는 운영자가 아니라 정책 설정자, 피드백 제공자, 예외 승인자, 감사자로 참여한다.

## 현재 확정 범위

현재 문서와 코드 기준으로 확정된 범위는 아래와 같다.

* 구조화된 멀티 에이전트 워크플로우 골격 제공
* 데이터 수집 -> 분석 -> 리스크 검증 -> 매수/매도 판단 -> 주문 계획 -> 평가 요약 흐름 제공
* 설명 가능한 투자 판단 결과와 주문 계획 스키마 제공
* Yahoo Finance(`yfinance`)를 첫 실데이터 provider 옵션으로 제공
* 한국투자증권 Open API를 첫 브로커 어댑터 대상으로 두고, 모의투자 REST 어댑터를 현재 구현에 포함
* OpenAI Responses API를 각 에이전트에 연결할 수 있는 선택적 공통 LLM 템플릿 계층 제공
* 사용자 요구사항을 `InvestmentMandate`로 구조화하고 메인 에이전트가 정책 가드레일로 집행하는 기본 경계 제공

## 장기 운영 목표

아래 목표는 프로젝트의 최종 방향이며, 현재 최소 구현에서 모두 제공되는 기능은 아니다. 상세 동작 계약은 구현 단계에서 별도 문서와 코드 계약으로 확정한다.

* 에이전트가 정해진 주기 또는 이벤트에 따라 24/7 시장 데이터를 감시한다.
* 데이터 수집, 분석, 리스크 검증, 매수/매도 판단, 주문 계획, 주문 실행, 로그/평가를 자동 워크플로우로 연결한다.
* 사용자는 상시 수동 실행자가 아니라 전략 정책, 리스크 한도, 승인 규칙, 예외 처리 기준을 설정한다.
* 사용자 개입은 피드백, 정책 수정, 비상 정지, 고위험 주문 승인처럼 명시적인 통제 지점에 집중한다.
* 실주문 기능은 브로커 어댑터, 리스크 가드레일, 감사 로그, 모니터링, 비상 정지 장치가 갖춰진 뒤에 활성화한다.

## 향후 확장 템플릿

아래 항목은 아직 상세 계획이나 구현이 확정되지 않았다.

* 외부 데이터 연동: `TBD`
* 실주문 전송: `TBD`
* 저장소 연동: `TBD`
* 백테스트 고도화: `TBD`
* 운영 모니터링 고도화: `TBD`

## 현재 구현 컴포넌트

* Frontend (Next.js, Cloudflare Pages static export compatible)
* Backend API (FastAPI)
* Main Agent / Sequential Orchestrator
* Data Collection Agent
* Data Analysis Agent
* Risk Management Agent
* Buy/Sell Decision Agent
* Order Execution Agent
* Log/Evaluation Agent
* Shared Agent LLM Template Layer
* Investment Mandate Schema
* Policy Guardrail
* Market Data Provider Boundary
* Broker Adapter Boundary
* In-memory Workflow Run Repository

## 확장 컴포넌트 템플릿

아래 컴포넌트는 저장소 목표에는 언급될 수 있지만 현재 구현 컴포넌트로 간주하지 않는다.

* Durable Persistent Storage: `TBD`
* Cache Layer: `TBD`
* Search / Vector Store: `TBD`
* Compiled LangGraph Runtime: `TBD`

## 현재 최소 구현 구조

```text
agent_pay_for_urself/
  api/                 # FastAPI 진입점과 API 조립
  agents/              # 단일 책임 에이전트
  llm/                 # OpenAI 기반 공통 LLM 템플릿 계층
  policies/            # 사용자 mandate 기반 정책 가드레일
  adapters/            # 시장데이터/브로커 외부 연동 경계
  repositories/        # 워크플로우 실행 결과 저장소
  orchestrator.py      # 메인 에이전트 워크플로우
  schemas.py           # 에이전트 간 구조화된 입출력
docs/
  README.md
  DOCS_GUIDE.md
  TESTS_GUIDE.md
  architecture.md
  agent-structure.md
  domain-rules.md
  project-overview.md
frontend/
  app/                 # Next.js 기본 운영 화면
tests/                 # 백엔드 워크플로우 테스트
```

## 현재 구현 상태

현재 최소 구현에서는 영속 데이터베이스 저장과 실브로커 주문을 기본 경로로 사용하지 않는다.

시장 데이터는 기본적으로 deterministic stub provider를 사용하고, `MARKET_DATA_PROVIDER=yahoo`를 설정하면 `yfinance` 기반 Yahoo Finance provider를 통해 실데이터를 수집할 수 있다. 실제 연동은 명시적인 adapter 또는 repository 계층을 통해 추가한다.

선택적으로 `OPENAI_API_KEY`를 설정하면 공통 LLM 템플릿 계층이 OpenAI Responses API를 사용해 각 에이전트의 구조화 출력을 생성할 수 있다. 기본 모델은 `gpt-5.5`이고, `OPENAI_DATA_COLLECTION_MODEL` 같은 에이전트별 환경 변수로 개별 모델을 덮어쓸 수 있다. 키가 없거나 응답이 유효하지 않으면 현재 deterministic fallback 로직을 사용한다.

`InvestmentMandate`는 사용자의 요구사항과 제약을 담는 실행 경계이며, `PolicyGuardrail`은 현재 허용/제외 심볼 위반을 차단한다.

실거래 브로커 기본 방향은 한국투자증권 Open API이며, 미국 주식 매매는 해외주식 주문 API를 통해 연결한다.

## 구현되지 않은 영역 템플릿

### 외부 데이터 공급자

* 상태: `Stub + Yahoo Finance option implemented`
* 확정된 입력/출력 계약: `MarketDataProvider.get_market_data`
* 비고: 기본 경로는 deterministic stub provider이며, `MARKET_DATA_PROVIDER=yahoo`일 때 `yfinance` 기반 Yahoo Finance provider를 사용

### 브로커 주문 전송

* 상태: `KIS mock adapter implemented, live HTTP endpoint not exposed`
* 첫 대상: `한국투자증권 Open API`
* 확정된 입력/출력 계약: `BrokerAdapter.submit_order`, `BrokerAdapter.get_order_status`

### 영속 저장

* 상태: `TBD`
* 확정된 저장 모델: 없음

### 에이전트별 프롬프트 상세화

* 상태: `공통 템플릿 + 에이전트별 모델 라우팅 구현`
* 현재 구현: 공통 LLM 템플릿과 에이전트별 모델 선택
* 확정된 프롬프트 계약: 에이전트별 prompt override는 기본 schema-preserving instruction 뒤에 추가되며, 모델 선택은 `OPENAI_*_MODEL` 환경 변수로 조정
