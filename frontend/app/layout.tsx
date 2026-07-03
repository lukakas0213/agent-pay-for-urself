import type { Metadata } from "next";
import type { ReactNode } from "react";

import { NavShell } from "../components/site-nav";
import "./globals.css";
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
        <NavShell>{children}</NavShell>
      </body>
    </html>
  );
}
