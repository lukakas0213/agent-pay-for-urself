"use client";

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
    setMessage("연결 정보 입력값을 이 브라우저에 저장했습니다.");
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
    <main className="shell">
      <section className="hero-panel compact-hero account-hero">
        <div>
          <span className="eyebrow">계좌 상태</span>
          <h1>연결 정보와 현재 보유 종목을 한 화면에서 확인한다</h1>
          <p>계좌 연결 입력값을 먼저 정리하고, 실제 조회된 잔고와 보유 종목 수익률을 토스 스타일 카드로 확인합니다.</p>
        </div>
        <div className="status-card">
          <span>조회 상태</span>
          <strong>{isLoading ? "불러오는 중" : isAvailable ? "조회 가능" : "조회 불가"}</strong>
          <small>{snapshot?.broker || brokerLabel}</small>
          <small>{snapshot?.account_masked || accountNumber || "계좌 번호 없음"}</small>
        </div>
      </section>

      {error ? <p className="inline-error">{error}</p> : null}
      {message ? <p className="inline-note">{message}</p> : null}

      <section className="account-layout">
        <article className="panel account-connection-panel">
          <div className="section-heading compact">
            <span className="eyebrow">계좌 연결</span>
            <h2>연결할 계좌 정보 작성 및 적용</h2>
            <p>현재 저장소 계약에는 계좌 저장 API가 없으므로, 이 입력값은 프론트 로컬 설정으로 저장됩니다.</p>
          </div>
          <form className="stack-form" onSubmit={handleApplyConnection}>
            <label className="field">
              <span>계좌 별칭</span>
              <input value={accountAlias} onChange={(event) => setAccountAlias(event.target.value)} />
            </label>
            <label className="field">
              <span>브로커</span>
              <input value={brokerLabel} onChange={(event) => setBrokerLabel(event.target.value)} />
            </label>
            <div className="form-grid two-cols">
              <label className="field">
                <span>계좌 번호</span>
                <input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
              </label>
              <label className="field">
                <span>상품 코드</span>
                <input value={accountProductCode} onChange={(event) => setAccountProductCode(event.target.value)} />
              </label>
            </div>
            <button type="submit">입력값 적용</button>
          </form>
        </article>

        <article className="panel account-summary-panel">
          <div className="section-heading compact">
            <span className="eyebrow">계좌 요약</span>
            <h2>{accountAlias}</h2>
            <p>{snapshot?.message || "계좌 상태를 확인할 수 있습니다."}</p>
          </div>
          <div className="result-summary-grid account-summary-grid">
            <div className="summary-card">
              <span>예수금</span>
              <strong>{summary ? formatAmount(summary.cash_balance) : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>총매입금액</span>
              <strong>{summary ? formatAmount(summary.total_purchase_amount) : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>총평가금액</span>
              <strong>{summary ? formatAmount(summary.total_evaluation_amount) : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>총수익률</span>
              <strong>{summary ? formatPercentValue(summary.total_profit_loss_rate) : "-"}</strong>
            </div>
          </div>
        </article>

        <article className="panel panel-span-2 account-holdings-panel">
          <div className="section-heading compact">
            <span className="eyebrow">보유 종목</span>
            <h2>현재 계좌 구성</h2>
            <p>{holdings.length ? `${holdings.length}개 종목이 보입니다.` : "보유 종목이 없습니다."}</p>
          </div>

          {holdings.length ? (
            <>
              <div className="portfolio-card-rail">
                {holdingsWithWeight.map((holding) => (
                  <article className="holding-card" key={holding.symbol}>
                    <div className="holding-card-header">
                      <div>
                        <span>{holding.symbol}</span>
                        <strong>{holding.name}</strong>
                      </div>
                      <small className={holding.profit_loss_rate >= 0 ? "positive" : "negative"}>
                        {formatPercentValue(holding.profit_loss_rate)}
                      </small>
                    </div>
                    <div className="holding-card-metrics">
                      <div>
                        <span>평가금액</span>
                        <strong>{formatAmount(holding.market_value)}</strong>
                      </div>
                      <div>
                        <span>보유 비중</span>
                        <strong>{formatPercentValue(holding.weight)}</strong>
                      </div>
                      <div>
                        <span>손익</span>
                        <strong className={holding.profit_loss >= 0 ? "positive" : "negative"}>
                          {formatSignedAmount(holding.profit_loss)}
                        </strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="table-shell">
                <table className="account-table">
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
            </>
          ) : (
            <div className="empty-state compact-empty">
              <h3>{isAvailable ? "보유 종목이 없습니다" : "계좌 정보를 불러올 수 없습니다"}</h3>
              <p>{snapshot?.message || "조회 가능한 계좌가 설정되면 보유 종목이 여기에 표시됩니다."}</p>
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
