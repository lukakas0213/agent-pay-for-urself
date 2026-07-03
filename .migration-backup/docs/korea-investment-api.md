# 한국투자증권 OpenAPI 모의투자 사용설명서

## 1. 기본 정보

| 구분      | 값                                              |
| ------- | ---------------------------------------------- |
| 사용 환경   | 모의투자                                           |
| 기본 도메인  | `https://openapivts.koreainvestment.com:29443` |
| 인증 방식   | Access Token 발급 후 `Bearer` 토큰 사용               |
| 토큰 발급   | `POST /oauth2/tokenP`                          |
| 토큰 유효기간 | 일반 개인 기준 24시간                                  |
| 고객 타입   | 개인: `P`                                        |

---

## 2. 사용 전 준비

1. 한국투자증권 모의투자 계좌 신청
2. KIS Developers에서 모의투자용 `appkey`, `appsecret` 발급
3. 계좌번호 분리

   * `CANO`: 계좌번호 앞 8자리
   * `ACNT_PRDT_CD`: 계좌번호 뒤 2자리
4. `.env`에 민감정보 저장

```env
KIS_APP_KEY=...
KIS_APP_SECRET=...
KIS_ACCOUNT_NO=12345678
KIS_ACCOUNT_PRODUCT_CODE=01
KIS_BASE_URL=https://openapivts.koreainvestment.com:29443
```

---

## 3. 인증 흐름

```http
POST /oauth2/tokenP
```

요청 Body:

```json
{
  "grant_type": "client_credentials",
  "appkey": "발급받은_appkey",
  "appsecret": "발급받은_appsecret"
}
```

API 호출 시 Header:

```http
authorization: Bearer {access_token}
appkey: {appkey}
appsecret: {appsecret}
tr_id: {모의투자 TR_ID}
custtype: P
content-type: application/json; charset=utf-8
```

---

## 4. 국내주식 주요 API

| 기능       | Method | URL                                                  | 모의 TR_ID    |
| -------- | -----: | ---------------------------------------------------- | ----------- |
| 현금 매수    |   POST | `/uapi/domestic-stock/v1/trading/order-cash`         | `VTTC0012U` |
| 현금 매도    |   POST | `/uapi/domestic-stock/v1/trading/order-cash`         | `VTTC0011U` |
| 주문 정정/취소 |   POST | `/uapi/domestic-stock/v1/trading/order-rvsecncl`     | `VTTC0013U` |
| 잔고 조회    |    GET | `/uapi/domestic-stock/v1/trading/inquire-balance`    | `VTTC8434R` |
| 매수 가능 조회 |    GET | `/uapi/domestic-stock/v1/trading/inquire-psbl-order` | `VTTC8908R` |
| 주문/체결 조회 |    GET | `/uapi/domestic-stock/v1/trading/inquire-daily-ccld` | `VTTC0081R` |

국내주식 주문 Body 예시:

```json
{
  "CANO": "12345678",
  "ACNT_PRDT_CD": "01",
  "PDNO": "005930",
  "ORD_DVSN": "00",
  "ORD_QTY": "1",
  "ORD_UNPR": "70000"
}
```

주의:

* POST Body의 Key는 대문자로 작성
* 시장가 주문은 `ORD_UNPR`에 `"0"` 입력
* 모의투자는 국내주식 주문 시 `KRX`만 가능

---

## 5. 해외주식 주요 API

| 기능      | Method | URL                                          | 모의 TR_ID    |
| ------- | -----: | -------------------------------------------- | ----------- |
| 미국 매수   |   POST | `/uapi/overseas-stock/v1/trading/order`      | `VTTT1002U` |
| 미국 매도   |   POST | `/uapi/overseas-stock/v1/trading/order`      | `VTTT1001U` |
| 미국 예약매수 |   POST | `/uapi/overseas-stock/v1/trading/order-resv` | `VTTT3014U` |
| 미국 예약매도 |   POST | `/uapi/overseas-stock/v1/trading/order-resv` | `VTTT3016U` |

해외주식 주문 Body 예시:

```json
{
  "CANO": "12345678",
  "ACNT_PRDT_CD": "01",
  "OVRS_EXCG_CD": "NASD",
  "PDNO": "AAPL",
  "ORD_QTY": "1",
  "OVRS_ORD_UNPR": "145.00",
  "ORD_SVR_DVSN_CD": "0",
  "ORD_DVSN": "00"
}
```

주의:

* 모의투자 해외주식은 일부 종목만 매매 가능
* 미국 모의투자는 기본적으로 지정가 주문 `ORD_DVSN: "00"` 중심으로 사용

---

## 6. 영업일 / 주문 가능 시간

### 국내주식

| 구분      | 시간            |
| ------- | ------------- |
| 정규장     | 09:00 ~ 15:30 |
| 장전 시간외  | 08:30 ~ 08:40 |
| 장후 시간외  | 15:40 ~ 16:00 |
| 시간외 단일가 | 16:00 ~ 18:00 |

국내 휴장일/개장일 확인은 `국내휴장일조회` API를 사용한다.
주문 가능 여부 판단에는 `opnd_yn` 값을 우선 확인한다.

### 해외주식

| 국가             | 운영시간, 한국시간 기준                |
| -------------- | ---------------------------- |
| 미국 정규장         | 23:30 ~ 06:00                |
| 미국 정규장, 서머타임   | 22:30 ~ 05:00                |
| 미국 프리마켓        | 18:00 ~ 23:30                |
| 미국 프리마켓, 서머타임  | 17:00 ~ 22:30                |
| 미국 애프터마켓       | 06:00 ~ 07:00                |
| 미국 애프터마켓, 서머타임 | 05:00 ~ 07:00                |
| 일본             | 09:00 ~ 11:30, 12:30 ~ 15:00 |
| 상해             | 10:30 ~ 16:00                |
| 홍콩             | 10:30 ~ 13:00, 14:00 ~ 17:00 |

미국 예약주문:

* 일반: 10:00 ~ 23:20
* 서머타임: 10:00 ~ 22:20
* 16:30 ~ 16:45 전후는 시스템 정산으로 제한될 수 있음

---

## 7. 자동매매 로직 기본 순서

1. Access Token 발급
2. 오늘이 개장일인지 확인
3. 현재 시간이 주문 가능 시간인지 확인
4. 잔고 / 매수 가능 금액 조회
5. 전략 신호 생성
6. 주문 요청
7. 주문번호 `ODNO` 저장
8. 체결 조회
9. 로그 저장

---

## 8. 개발 시 주의사항

* `appkey`, `appsecret`, 토큰은 GitHub에 커밋 금지
* 실전 도메인과 모의 도메인을 절대 섞지 않기
* 실전 TR_ID와 모의 TR_ID를 구분해서 사용
* 주문 API는 실패 응답도 반드시 로그로 저장
* 주문 전 최소 체크:

  * 개장일 여부
  * 주문 가능 시간
  * 계좌 잔고
  * 매수 가능 금액
  * 주문 수량
  * 주문 가격
