# 프로젝트 개요

## 목표

이 프로젝트는 AI 에이전트를 활용하여 주식 데이터를 수집, 분석, 평가하고 투자 의사결정을 지원하는 멀티 에이전트 투자 플랫폼이다.

시스템은 단순한 LLM 챗봇이 아니라 실제 투자 의사결정 과정을 구조화하여 수행하는 것을 목표로 한다.

## 현재 확정 범위

현재 문서와 코드 기준으로 확정된 범위는 아래와 같다.

* 구조화된 멀티 에이전트 워크플로우 골격 제공
* 데이터 수집 -> 분석 -> 리스크 검증 -> 매수/매도 판단 -> 주문 계획 -> 평가 요약 흐름 제공
* 설명 가능한 투자 판단 결과와 주문 계획 스키마 제공
* 한국투자증권 Open API를 첫 브로커 어댑터 대상으로 두는 방향 확정

## 향후 확장 템플릿

아래 항목은 아직 상세 계획이나 구현이 확정되지 않았다.

* 외부 데이터 연동: `TBD`
* 실주문 전송: `TBD`
* 저장소 연동: `TBD`
* 백테스트 고도화: `TBD`
* 운영 모니터링 고도화: `TBD`

## 현재 구현 컴포넌트

* Frontend (Next.js)
* Backend API (FastAPI)
* Main Agent / Agent Orchestrator (LangGraph)
* Data Collection Agent
* Data Analysis Agent
* Risk Management Agent
* Buy/Sell Decision Agent
* Order Execution Agent
* Log/Evaluation Agent

## 확장 컴포넌트 템플릿

아래 컴포넌트는 저장소 목표에는 언급될 수 있지만 현재 구현 컴포넌트로 간주하지 않는다.

* Broker Adapter: `TBD`
* Persistent Storage: `TBD`
* Cache Layer: `TBD`
* Search / Vector Store: `TBD`

## 현재 최소 구현 구조

```text
agent_pay_for_urself/
  api/                 # FastAPI 진입점
  agents/              # 단일 책임 에이전트
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

현재 최소 구현에서는 실제 외부 데이터 API, 증권사 API, 데이터베이스 저장을 호출하지 않는다.

실제 연동은 명시적인 adapter 또는 repository 계층을 통해 추가한다.

실거래 브로커 기본 방향은 한국투자증권 Open API이며, 미국 주식 매매는 해외주식 주문 API를 통해 연결한다.

## 구현되지 않은 영역 템플릿

### 외부 데이터 공급자

* 상태: `TBD`
* 확정된 입력/출력 계약: 없음
* 비고: 현재 `DataCollectionAgent`는 deterministic stub

### 브로커 주문 전송

* 상태: `Planned`
* 첫 대상: `한국투자증권 Open API`
* 확정된 상세 계약: `TBD`

### 영속 저장

* 상태: `TBD`
* 확정된 저장 모델: 없음
