import Link from "next/link";
import { Home, Sprout } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="rounded-3xl bg-lime-400/10 p-6 ring-1 ring-lime-400/20">
            <Sprout className="h-16 w-16 text-lime-400" />
          </div>
        </div>

        <h1 className="text-6xl font-bold text-lime-400">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-white">Page Not Found</h2>
        <p className="mt-3 text-slate-400">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-lime-400/20 px-6 py-3 text-sm font-semibold text-lime-100 border border-lime-400/30 hover:bg-lime-400/30 transition-all"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}