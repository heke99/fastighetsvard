"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { ResetPasswordForm } from "./ResetPasswordForm";

type GateState = "checking" | "ready" | "expired";

/**
 * Supabase's default hosted invite/recovery templates may return an implicit
 * session in the URL fragment. FaddeBo's custom templates use /auth/confirm
 * and SSR cookies, but this bridge keeps the flow functional before the hosted
 * templates have been pasted into Dashboard as well.
 */
export function RecoverySessionGate({ hasServerSession }: { hasServerSession: boolean }) {
  const [state, setState] = useState<GateState>(hasServerSession ? "ready" : "checking");

  useEffect(() => {
    if (hasServerSession) return;

    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    async function establishSession() {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }

        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          if (!cancelled) setState("expired");
          return;
        }
        if (!cancelled) setState("ready");
      } catch (error) {
        console.error("FaddeBo recovery session bridge failed", error);
        if (!cancelled) setState("expired");
      }
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, [hasServerSession]);

  if (state === "checking") {
    return <p className="mt-6 text-sm text-stone-600">Verifierar den säkra länken …</p>;
  }

  if (state === "expired") {
    return (
      <div className="card mt-6 space-y-4 p-6">
        <p className="text-sm text-stone-700">Länken är ogiltig eller har gått ut.</p>
        <Link href="/glomt-losenord" className="btn-primary inline-flex">
          Skicka en ny länk
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm />;
}
