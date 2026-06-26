
"use client";

import { useEffect, useState } from "react";

import {
  AccountResponse,
  fetchJson,
  formatAmount,
  formatPercentValue,
  formatPrice,
  formatSignedAmount,
} from "../lib/workspace";

export function AccountOverview() {
  const [snapshot, setSnapshot] = useState<AccountResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  const summary = snapshot?.summary;
  const holdings = snapshot?.holdings ?? [];
  const isAvailable = snapshot?.available ?? false;

  return (
    <main className="shell">
      <section className="hero-panel compact-hero account-hero">
        <div>
          <span className="eyebrow">계좌 메뉴</span>
          <h1>모의투자 계좌의 보유 종목과 손익을 확인한다</h1>
          <p>한국투자 모의투자 계좌를 읽기 전용으로 연결해 현재 보유 종목, 평가금액, 수익률을 본다.</p>
        </div>
        <div className="status-card">
          <span>조회 상태</span>
          <strong>{isLoading ? "불러오는 중" : isAvailable ? "조회 가능" : "조회 불가"}</strong>
          <small>{snapshot?.broker || "broker 미설정"}</small>
          <small>{snapshot?.account_masked || "계좌 번호 없음"}</small>
        </div>
      </section>

      {error ? <p className="inline-error">{error}</p> : null}

      <section className="account-stack">
        <article className="panel account-summary-panel">
          <div className="section-heading compact">
            <span className="eyebrow">계좌 요약</span>
            <h2>잔고와 손익</h2>
            <p>{snapshot?.message || "계좌 상태를 확인할 수 있습니다."}</p>
          </div>

          <div className="result-summary-grid account-summary-grid">
            <div className="summary-card">
              <span>예수금</span>
              <strong>{summary ? formatAmount(summary.cash_balance) : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>총평가금액</span>
              <strong>{summary ? formatAmount(summary.total_evaluation_amount) : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>총손익</span>
              <strong>{summary ? formatSignedAmount(summary.total_profit_loss) : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>총수익률</span>
              <strong>{summary ? formatPercentValue(summary.total_profit_loss_rate) : "-"}</strong>
            </div>
          </div>
        </article>

        <article className="panel account-holdings-panel">
          <div className="section-heading compact">
            <span className="eyebrow">보유 종목</span>
            <h2>현재 계좌 구성</h2>
            <p>{holdings.length ? `${holdings.length}개 종목이 보입니다.` : "보유 종목이 없습니다."}</p>
          </div>

          {holdings.length ? (
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
