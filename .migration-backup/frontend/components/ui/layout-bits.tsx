import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Inbox } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          {eyebrow}
        </span>
        <h1 className="mt-2 text-pretty text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  count,
  kicker,
  actions,
  className,
}: {
  title: string;
  count?: number | string;
  kicker?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex items-center gap-2">
        {kicker ? (
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            {kicker}
          </span>
        ) : null}
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        {count !== undefined ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-muted px-1.5 text-[11px] font-semibold text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="text-subtle">{icon ?? <Inbox className="h-6 w-6" />}</span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function Banner({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-4 py-3 text-[13px] leading-relaxed",
        isError
          ? "border-negative/30 bg-negative-soft text-negative"
          : "border-positive/30 bg-positive-soft text-positive",
      )}
    >
      {isError ? (
        <AlertCircle className="mt-px h-4 w-4 flex-shrink-0" />
      ) : (
        <CheckCircle2 className="mt-px h-4 w-4 flex-shrink-0" />
      )}
      <span>{children}</span>
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: "positive" | "negative" | "default";
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3.5">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <strong
        className={cn(
          "mt-1.5 block truncate text-lg font-semibold tracking-tight",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
          (!tone || tone === "default") && "text-foreground",
        )}
      >
        {value}
      </strong>
      {hint ? <span className="mt-0.5 block text-[11px] text-subtle">{hint}</span> : null}
    </div>
  );
}
