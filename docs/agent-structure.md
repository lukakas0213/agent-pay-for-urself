# 에이전트 구조

## 현재 데이터 흐름

사용자

→ Web UI

→ FastAPI (`/decisions`)

→ 메인 에이전트

→ 데이터 수집 에이전트

→ 데이터 분석 에이전트

→ 리스크 관리 에이전트

→ 매수/매도 에이전트

→ 주문 실행 에이전트

→ 로그/평가 에이전트

→ `WorkflowResult` 생성

→ In-memory workflow repository에 `run_id`와 함께 저장

→ Web UI 또는 콘솔 보조 API (`/console/interactions`)에서 조회

현재 코드 기준으로는 마지막 단계가 프로세스 메모리 저장까지만 이어지고, 영속 저장까지는 구현되어 있지 않다.

## 현재 구현 에이전트

### 데이터 수집 에이전트

담당 업무:

* 요청된 심볼 목록을 정규화한다.
* `MarketDataProvider` 인터페이스를 통해 종목별 데이터를 가져온다.
* 현재 기본 provider는 고정 가격, 뉴스, 재무지표를 반환하는 stub 구현이다.

### 데이터 분석 에이전트

담당 업무:

* 수집된 `MarketData`를 `AnalysisSignal`로 변환한다.
* 현재는 가격, 뉴스 존재 여부, `pe_ratio` 기반의 단순 점수 계산만 수행한다.

### 매수/매도 에이전트

담당 업무:

* 분석 점수와 리스크 승인 여부를 바탕으로 `BUY`, `SELL`, `HOLD`를 결정한다.
* 리스크 미승인 시 무조건 `HOLD`를 반환한다.

### 리스크 관리 에이전트

담당 업무:

* `max_position_weight` 범위를 검증한다.
* 분석 결과에 투자 근거가 있는지 확인한다.
* 현재는 기본 승인/거절 판단과 사유 생성만 수행한다.

### 주문 실행 에이전트

담당 업무:

* 주문 계획 생성
* 실제 브로커 제출은 `BrokerAdapter` 경계 뒤로 분리한다.
* 현재 기본 adapter는 `NoopBrokerAdapter`이며 실주문은 전송하지 않는다.

### 로그/평가 에이전트

담당 업무:

* 의사결정 수와 주문 계획 수를 요약한다.
* 현재는 `EvaluationLog`를 만들고, API 서비스 계층이 전체 `WorkflowResult`를 메모리 저장소에 보관한다.

## API 보조 계층

### DecisionWorkflowService

담당 업무:

* `MainAgent` 실행
* 실행 결과를 저장소에 저장
* API 응답용 `run_id`를 반환

### ConsoleAssistantService

담당 업무:

* 저장된 `WorkflowResult`를 바탕으로 설명 응답 생성
* `/console/interactions` 요청에 deterministic reply 제공
* 기존 `/agent/interactions`는 deprecated alias로 유지

## 미구현 에이전트 템플릿

### 에이전트 이름

* 상태: `TBD`
* 목적: `TBD`
* 입력: `TBD`
* 출력: `TBD`
* 관련 코드 경로: `TBD`

## 역할 분담

### 개발 담당

책임 영역:

* 시스템 설계
* 에이전트 구현
* API 개발
* 데이터 파이프라인 구축
* 데이터베이스 설계
* 백테스트 엔진 구현
* 브로커 API 연동
* 인프라 운영

### 투자 담당

책임 영역:

* 투자 전략 정의
* 재무제표 평가 기준 정의
* 포트폴리오 규칙 정의
* 리스크 관리 규칙 정의
* 투자 성과 평가 기준 정의
* 전략 검증 및 개선
