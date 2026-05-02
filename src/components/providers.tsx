"use client";

import { SessionProvider, signOut, useSession } from "next-auth/react";
import { Toaster } from "@/components/ui/sonner";
import { useEffect, useRef } from "react";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function IdleWatcher() {
  const { data: session } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session) return;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, IDLE_TIMEOUT_MS);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleWatcher />
      {children}
      <Toaster />
    </SessionProvider>
  );
}
