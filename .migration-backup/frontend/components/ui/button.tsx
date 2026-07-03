import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "icon";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover focus-visible:ring-primary/40",
  secondary:
    "bg-card text-foreground border border-border hover:border-border-strong hover:bg-muted focus-visible:ring-primary/30",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-muted focus-visible:ring-primary/30",
  ghost:
    "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-primary/30",
  danger:
    "bg-negative text-white shadow-sm hover:opacity-90 focus-visible:ring-negative/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  icon: "h-9 w-9",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity,box-shadow] duration-150 outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
