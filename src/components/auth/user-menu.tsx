"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { signOut } from "next-auth/react";

interface UserMenuProps {
  user: { email: string; name?: string | null };
  /** Tweak the avatar size if needed (default 36px on app nav, 32px on landing). */
  size?: number;
}

export function UserMenu({ user, size = 36 }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initials = (user.name ?? user.email)
    .split(/[ .@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-full bg-secondary text-secondary-foreground text-xs font-medium hover:bg-accent transition-colors"
        style={{ width: size, height: size }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {initials || "?"}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-popover text-popover-foreground shadow-card-lg overflow-hidden z-50"
        >
          <div className="px-3.5 py-3 border-b border-border">
            <div className="text-sm font-medium truncate">{user.name ?? user.email}</div>
            {user.name ? (
              <div className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</div>
            ) : null}
          </div>
          <div className="p-1">
            <Link
              href="/profile"
              className="flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm hover:bg-secondary transition-colors"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <UserIcon className="size-4 text-muted-foreground" />
              Profile
            </Link>
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-sm hover:bg-secondary transition-colors text-left"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
            >
              <LogOut className="size-4 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
