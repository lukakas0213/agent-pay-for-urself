"use client";

import Link from "next/link";
import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shell">
      <section className="panel error-panel">
        <span className="eyebrow">오류 발생</span>
        <h1>화면을 불러오는 중 문제가 생겼습니다</h1>
        <p>잠시 후 다시 시도하거나 처음 화면으로 돌아가서 다시 열어보세요.</p>
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
  );
}
