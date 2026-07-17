import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-primary text-white shadow-lg shadow-primary/25 hover:brightness-110 dark:text-slate-950 dark:font-semibold",
  outline:
    "border border-card-border text-foreground hover:border-primary/50 hover:bg-primary-soft",
  ghost: "text-muted hover:text-foreground hover:bg-primary-soft",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20",
  success: "bg-success/10 text-success border border-success/30 hover:bg-success/20",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
