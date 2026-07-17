import { cn, clamp } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  barClassName,
}: {
  /** 0-100 */
  value: number;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-primary-soft", className)}>
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700",
          barClassName
        )}
        style={{ width: `${clamp(value, 0, 100)}%` }}
      />
    </div>
  );
}

export function StatRing({
  value,
  size = 120,
  stroke = 10,
  label,
  sublabel,
}: {
  /** 0-100 */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = (clamp(value, 0, 100) / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary-soft)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold">{label}</span>
        {sublabel && <span className="text-[10px] uppercase tracking-wider text-muted">{sublabel}</span>}
      </div>
    </div>
  );
}
