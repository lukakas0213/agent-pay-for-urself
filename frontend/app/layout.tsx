import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteNav } from "../components/site-nav";
import "./styles.css";

export const metadata: Metadata = {
  title: "agent-pay-for-urself",
  description: "Multi-agent investment decision support platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <SiteNav />
          <div className="app-main">
            <div className="app-content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
