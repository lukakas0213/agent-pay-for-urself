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
    try {
      const data = await fetchJson<AccountResponse>("/api/account");
      setSnapshot(data);
    } catch (requestError) {
      console.error(requestError);
    } finally {
      setIsLoading(false);
    }
  }

  function handleApplyConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    const nextSettings = {
      ...settings,
      account_alias: accountAlias.trim() || "모의투자 계좌",
      account_number: accountNumber.trim(),
      account_product_code: accountProductCode.trim(),
      broker_label: brokerLabel.trim() || "한국투자증권",
    };
    setSettings(nextSettings);
    saveFrontendWorkspaceSettings(nextSettings);
    alert("저장되었습니다.");
  }

  const summary = snapshot?.summary;
  const holdings = snapshot?.holdings ?? [];
  const isAvailable = snapshot?.available ?? false;
  const totalEvaluation = summary?.total_evaluation_amount ?? 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="section-title">계좌 상태</h1>
        <p className="card-subtitle">실시간 브로커 연결 정보와 보유 종목 현황을 확인합니다.</p>
      </div>

      <div className="two-panel mb-8">
        <div className="card">
          <h2 className="card-title mb-6">브로커 연결 정보</h2>
          <form onSubmit={handleApplyConnection}>
            <div className="form-group">
              <label className="form-label">계좌 별칭</label>
              <input className="input-field" value={accountAlias} onChange={(e) => setAccountAlias(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">브로커</label>
              <input className="input-field" value={brokerLabel} onChange={(e) => setBrokerLabel(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">계좌 번호</label>
              <input className="input-field" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </div>
            <button className="btn btn-primary mt-4" style={{ width: '100%' }}>연결 정보 저장</button>
          </form>
        </div>

        <div className="card">
          <div className="flex-row justify-between mb-6">
            <h2 className="card-title" style={{ marginBottom: 0 }}>{accountAlias}</h2>
            <button className="btn btn-secondary" onClick={() => void loadAccount()}>새로고침</button>
          </div>
          <div className="grid-4">
            <div>
              <div className="form-label">예수금</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{summary ? formatAmount(summary.cash_balance) : "-"}</div>
            </div>
            <div>
              <div className="form-label">총매입금액</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{summary ? formatAmount(summary.total_purchase_amount) : "-"}</div>
            </div>
            <div>
              <div className="form-label">총평가금액</div>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{summary ? formatAmount(summary.total_evaluation_amount) : "-"}</div>
            </div>
            <div>
              <div className="form-label">총수익률</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: summary && summary.total_profit_loss_rate >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {summary ? formatPercentValue(summary.total_profit_loss_rate) : "-"}
              </div>
            </div>
          </div>
          {snapshot?.message && <p className="card-subtitle mt-4">{snapshot.message}</p>}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title mb-6">보유 종목 테이블</h2>
        {holdings.length ? (
          <div className="table-wrapper">
            <table className="table">
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
                      <div style={{ fontWeight: 600 }}>{holding.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{holding.symbol}</div>
                    </td>
                    <td>{formatAmount(holding.quantity)}</td>
                    <td>{formatPrice(holding.average_price)}</td>
                    <td>{formatPrice(holding.current_price)}</td>
                    <td>{formatAmount(holding.market_value)}</td>
                    <td style={{ color: holding.profit_loss >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatSignedAmount(holding.profit_loss)}</td>
                    <td style={{ color: holding.profit_loss_rate >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatPercentValue(holding.profit_loss_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>{isAvailable ? "보유 종목이 없습니다" : "계좌 정보를 불러올 수 없습니다"}</h3>
            <p>API 설정 및 연결 상태를 확인해주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
