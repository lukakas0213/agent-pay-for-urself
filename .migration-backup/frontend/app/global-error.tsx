"use client";

import Link from "next/link";
import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main className="shell">
          <section className="panel error-panel">
            <span className="eyebrow">전역 오류</span>
            <h1>앱 전체에서 오류가 발생했습니다</h1>
            <p>페이지를 다시 불러오거나 메인 화면으로 돌아가서 다시 시도해보세요.</p>
            <div className="error-actions">
              <button onClick={reset} type="button">
                다시 시도
              </button>
              <Link className="nav-pill" href="/">
                메인으로 이동
              </Link>
            </div>
            <small>{error.message}</small>
          </section>
        </main>
      </body>
    </html>
  );
}
