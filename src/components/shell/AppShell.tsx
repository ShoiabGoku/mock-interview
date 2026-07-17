"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Home, Moon, Settings2, Sun, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/setup", label: "New Interview", icon: Users },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mi-theme", next ? "dark" : "light");
  };
  return { dark, toggle };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { dark, toggle } = useTheme();
  // The live interview room is distraction-free (no chrome).
  const fullscreen = pathname.startsWith("/interview");

  if (fullscreen) return <main className="min-h-screen">{children}</main>;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="glass fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t px-1 py-1 md:sticky md:top-0 md:h-screen md:w-56 md:flex-col md:items-stretch md:justify-start md:gap-1 md:rounded-none md:border-r md:border-t-0 md:px-4 md:py-6">
        <Link href="/" className="mb-0 hidden items-center gap-2 px-2 md:mb-8 md:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg">🎤</span>
          <div>
            <div className="text-sm font-bold tracking-tight">PanelPrep</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">AI Interview Panels</div>
          </div>
        </Link>
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium transition-colors md:flex-row md:gap-3 md:py-2.5 md:text-sm",
                active ? "bg-primary-soft text-primary" : "text-muted hover:bg-primary-soft/50 hover:text-foreground"
              )}
            >
              <Icon size={18} />
              <span className="hidden sm:block">{label}</span>
            </Link>
          );
        })}
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className="mt-0 flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-muted hover:text-foreground md:mt-auto md:flex-row md:gap-3"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          <span className="hidden text-sm md:block">{dark ? "Light" : "Dark"}</span>
        </button>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
    </div>
  );
}
