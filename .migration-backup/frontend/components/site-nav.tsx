"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  Cpu,
  Database,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  LineChart,
  ListChecks,
  type LucideIcon,
  Menu,
  Plug,
  Scale,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";

import { buildApiUrl } from "@/lib/api";
import { agentDefinitions, primaryNavItems } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const primaryIcons: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/account": Wallet,
  "/reports": FileText,
  "/agents": Bot,
  "/settings": Settings,
};

const stageIcons: Record<string, LucideIcon> = {
  data_collection: Database,
  data_analysis: LineChart,
  report: FileText,
  buy_sell: Scale,
  order_execution: Send,
  log_evaluation: ListChecks,
};

const systemItems: { label: string; href: string; icon: LucideIcon; tag: string }[] = [
  { label: "런타임 모드", href: "/reports", icon: Cpu, tag: "Live" },
  { label: "정책 가드레일", href: "/agents/log_evaluation", icon: ShieldCheck, tag: "1" },
  { label: "브로커 연결", href: "/account", icon: Plug, tag: "KIS" },
  { label: "시장 데이터 소스", href: "/agents/data_collection", icon: Activity, tag: "MD" },
  { label: "워크플로우 기록", href: "/reports", icon: History, tag: "Runs" },
  { label: "실험 저장소", href: "/reports", icon: FlaskConical, tag: "Repo" },
  { label: "워크스페이스 설정", href: "/settings", icon: Settings, tag: "Cfg" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

type HealthState = "loading" | "ok" | "error";

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  tag,
  onNavigate,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  tag?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 flex-shrink-0",
          active ? "text-primary" : "text-subtle group-hover:text-foreground",
        )}
      />
      <span className="flex-1 truncate">{label}</span>
      {tag ? (
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            active ? "text-primary/70" : "text-subtle",
          )}
        >
          {tag}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarBody({
  pathname,
  health,
  onNavigate,
}: {
  pathname: string;
  health: HealthState;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-[13px] font-semibold text-foreground">
            agent-pay-for-urself
          </strong>
          <span className="block truncate text-[11px] text-subtle">Main Console</span>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-slim">
        <div className="space-y-1">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Navigation
          </p>
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={primaryIcons[item.href] ?? LayoutDashboard}
              label={item.label}
              active={isActivePath(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            Workflow Stage
          </p>
          {agentDefinitions.map((agent) => (
            <NavLink
              key={agent.key}
              href={agent.path}
              icon={stageIcons[agent.key] ?? Database}
              label={agent.label}
              active={isActivePath(pathname, agent.path)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle">
            System
          </p>
          {systemItems.map((item) => (
            <NavLink
              key={item.label}
              href={item.href}
              icon={item.icon}
              label={item.label}
              tag={item.tag}
              active={false}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              health === "ok" && "bg-positive",
              health === "error" && "bg-negative",
              health === "loading" && "animate-pulse bg-subtle",
            )}
          />
          <span className="text-[12px] font-medium text-muted-foreground">
            {health === "loading" ? "연결 확인 중" : health === "ok" ? "API 정상" : "API 연결 오류"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function NavShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<HealthState>("loading");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(buildApiUrl("/api/health"))
      .then((response) => {
        if (active) setHealth(response.ok ? "ok" : "error");
      })
      .catch(() => {
        if (active) setHealth("error");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-border bg-sidebar lg:block">
        <SidebarBody pathname={pathname} health={health} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] border-r border-border bg-sidebar shadow-xl">
            <SidebarBody
              pathname={pathname}
              health={health}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="메뉴 열기"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="relative hidden flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              aria-label="검색"
              placeholder="심볼, run_id, 에이전트, 리포트 이름으로 검색…"
              className="h-9 w-full max-w-md rounded-md border border-input bg-muted/50 pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-subtle focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex-1 sm:hidden" />

          <div className="flex items-center gap-2">
            <label className="relative hidden md:block">
              <span className="sr-only">워크스페이스 선택</span>
              <select
                defaultValue="Main Console"
                className="h-9 rounded-md border border-input bg-card px-3 text-[13px] font-medium text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <option>Main Console</option>
                <option>Research Lab</option>
              </select>
            </label>
            <Link
              href="/#new-run"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Sparkles className="h-4 w-4" />
              새 실행
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollbar-slim">
          <div className="mx-auto w-full max-w-[1240px] px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
