import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "positive" | "negative" | "warning" | "outline";

const variantClasses: Record<Variant, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary border border-primary-border",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
  outline: "border border-border text-muted-foreground",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
