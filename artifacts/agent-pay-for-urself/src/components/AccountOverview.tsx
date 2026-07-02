import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AccountResponse,
  FrontendWorkspaceSettings,
  fetchJson,
  formatAmount,
  formatPercentValue,
  formatPrice,
  formatSignedAmount,
  loadFrontendWorkspaceSettings,
  saveFrontendWorkspaceSettings,
} from "../lib/workspace";

export function AccountOverview() {
  const [settings, setSettings] = useState<FrontendWorkspaceSettings | null>(null);
  const [accountAlias, setAccountAlias] = useState("모의투자 계좌");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountProductCode, setAccountProductCode] = useState("");
  const [brokerLabel, setBrokerLabel] = useState("한국투자증권");
  const [snapshot, setSnapshot] = useState<AccountResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = loadFrontendWorkspaceSettings();
    setSettings(stored);
    setAccountAlias(stored.account_alias);
    setAccountNumber(stored.account_number);
    setAccountProductCode(stored.account_product_code);
    setBrokerLabel(stored.broker_label);
    void loadAccount();
  }, []);

  async function loadAccount() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchJson<AccountResponse>("/api/account");
      setSnapshot(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "계좌를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleApplyConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) {
      return;
    }
    const nextSettings: FrontendWorkspaceSettings = {
      ...settings,
      account_alias: accountAlias.trim() || "모의투자 계좌",
      account_number: accountNumber.trim(),
      account_product_code: accountProductCode.trim(),
      broker_label: brokerLabel.trim() || "한국투자증권",
    };
    setSettings(nextSettings);
    saveFrontendWorkspaceSettings(nextSettings);
    setMessage("계좌 입력값을 현재 브라우저 워크스페이스에 저장했습니다.");
  }

  const summary = snapshot?.summary;
  const holdings = snapshot?.holdings ?? [];
  const isAvailable = snapshot?.available ?? false;
  const totalEvaluation = summary?.total_evaluation_amount ?? 0;
  const holdingsWithWeight = useMemo(
    () =>
      holdings.map((holding) => ({
        ...holding,
        weight: totalEvaluation > 0 ? holding.market_value / totalEvaluation : 0,
      })),
    [holdings, totalEvaluation],
  );

  return (
    <main className="dashboard-page">
      <section className="page-hero">
        <div>
          <span className="eyebrow">Account</span>
          <h1>계좌 연결 입력과 실계좌 스냅샷을 운영 패널 형태로 본다</h1>
          <p>{"`GET /account`"} 응답을 예수금, 총평가금액, 보유 종목 카드와 표에 그대로 바인딩한다.</p>
        </div>
        <div className="hero-sidecard">
          <span>조회 상태</span>
          <strong>{isLoading ? "불러오는 중" : isAvailable ? "조회 가능" : "조회 불가"}</strong>
          <small>{snapshot?.broker || brokerLabel}</small>
          <small>{snapshot?.account_masked || accountNumber || "계좌 번호 미입력"}</small>
        </div>
      </section>

      {error ? <div className="banner banner-error">{error}</div> : null}
      {message ? <div className="banner banner-success">{message}</div> : null}

      <section className="dashboard-grid">
        <article className="panel">
          <div className="section-head">
            <div>
              <span className="section-kicker">Connection</span>
              <h2>브로커 연결 정보</h2>
            </div>
          </div>
          <form className="form-stack" onSubmit={handleApplyConnection}>
            <label className="field">
              <span>계좌 별칭</span>
              <input value={accountAlias} onChange={(event) => setAccountAlias(event.target.value)} />
            </label>
            <label className="field">
              <span>브로커</span>
              <input value={brokerLabel} onChange={(event) => setBrokerLabel(event.target.value)} />
            </label>
            <div className="field-grid field-grid-2">
              <label className="field">
                <span>계좌 번호</span>
                <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
              </label>
              <label className="field">
                <span>상품 코드</span>
                <input value={accountProductCode} onChange={(event) => setAccountProductCode(event.target.value)} />
              </label>
            </div>
            <button className="primary-button" type="submit">
              연결 정보 저장
            </button>
          </form>
        </article>

        <article className="panel panel-span-2">
          <div className="section-head">
            <div>
              <span className="section-kicker">Summary</span>
              <h2>{accountAlias}</h2>
            </div>
            <button className="secondary-button" onClick={() => void loadAccount()} type="button">
              새로고침
            </button>
          </div>
          <div className="stat-grid stat-grid-4">
            <div className="stat-card">
              <span>예수금</span>
              <strong>{summary ? formatAmount(summary.cash_balance) : "-"}</strong>
            </div>
            <div className="stat-card">
              <span>총매입금액</span>
              <strong>{summary ? formatAmount(summary.total_purchase_amount) : "-"}</strong>
            </div>
            <div className="stat-card">
              <span>총평가금액</span>
              <strong>{summary ? formatAmount(summary.total_evaluation_amount) : "-"}</strong>
            </div>
            <div className="stat-card">
              <span>총수익률</span>
              <strong>{summary ? formatPercentValue(summary.total_profit_loss_rate) : "-"}</strong>
            </div>
          </div>
          <p className="support-text">
            {snapshot?.message || "계좌 상태를 불러오면 실제 보유 비중과 손익이 여기에 나타난다."}
          </p>
        </article>
      </section>

      <section className="content-section">
        <div className="section-head section-head-spaced">
          <div>
            <span className="section-kicker">Holdings cards</span>
            <h2>보유 종목 카드</h2>
          </div>
          <small>{holdings.length ? `${holdings.length}개 종목` : "보유 종목 없음"}</small>
        </div>
        {holdings.length ? (
          <div className="card-grid card-grid-3">
            {holdingsWithWeight.map((holding) => (
              <article className="info-card" key={holding.symbol}>
                <div className="card-headline">
                  <strong>{holding.name}</strong>
                  <span>{holding.symbol}</span>
                </div>
                <div className="stat-grid stat-grid-2 compact-stat-grid">
                  <div className="stat-card">
                    <span>평가금액</span>
                    <strong>{formatAmount(holding.market_value)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>보유 비중</span>
                    <strong>{formatPercentValue(holding.weight)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>손익</span>
                    <strong className={holding.profit_loss >= 0 ? "positive" : "negative"}>
                      {formatSignedAmount(holding.profit_loss)}
                    </strong>
                  </div>
                  <div className="stat-card">
                    <span>수익률</span>
                    <strong className={holding.profit_loss_rate >= 0 ? "positive" : "negative"}>
                      {formatPercentValue(holding.profit_loss_rate)}
                    </strong>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <h3>{isAvailable ? "보유 종목이 없습니다" : "계좌 상태를 불러오지 못했습니다"}</h3>
            <p>{snapshot?.message || "브로커 연결과 환경 변수를 점검하세요."}</p>
          </div>
        )}
      </section>

      <section className="content-section">
        <div className="section-head section-head-spaced">
          <div>
            <span className="section-kicker">Holdings table</span>
            <h2>보유 종목 상세 표</h2>
          </div>
        </div>
        {holdings.length ? (
          <div className="table-panel">
            <table className="data-table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th>수량</th>
                  <th>평균단가</th>
                  <th>현재가</th>
                  <th>평가금액</th>
                  <th>손익</th>
                  <th>수익률</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr key={holding.symbol}>
                    <td>
                      <strong>{holding.name}</strong>
                      <small>{holding.symbol}</small>
                    </td>
                    <td>{formatAmount(holding.quantity)}</td>
                    <td>{formatPrice(holding.average_price)}</td>
                    <td>{formatPrice(holding.current_price)}</td>
                    <td>{formatAmount(holding.market_value)}</td>
                    <td className={holding.profit_loss >= 0 ? "positive" : "negative"}>
                      {formatSignedAmount(holding.profit_loss)}
                    </td>
                    <td className={holding.profit_loss_rate >= 0 ? "positive" : "negative"}>
                      {formatPercentValue(holding.profit_loss_rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
