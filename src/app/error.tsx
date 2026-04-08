"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-3xl bg-red-400/10 p-6 ring-1 ring-red-400/20">
            <AlertTriangle className="h-16 w-16 text-red-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mt-3 text-slate-400">
          An unexpected error occurred. Your data is safe — G-Buddy stores everything locally.
        </p>

        {/* Error details (only on client) */}
        {isClient && error.message && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-400">
              Error details
            </summary>
            <pre className="mt-2 rounded-lg bg-black/30 p-3 text-xs text-red-300 overflow-auto max-h-32">
              {error.message}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-xl bg-lime-400/20 px-6 py-3 text-sm font-semibold text-lime-100 border border-lime-400/30 hover:bg-lime-400/30 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl bg-white/5 px-6 py-3 text-sm font-semibold text-slate-300 border border-white/10 hover:bg-white/10 transition-all"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}