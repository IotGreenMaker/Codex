export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        {/* Animated logo */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-lime-400/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-lime-400 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl bg-lime-400/10 p-2">
              <svg
                className="h-8 w-8 text-lime-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
          </div>
        </div>

        <p className="mt-6 text-sm font-medium text-lime-300/80 animate-pulse">
          Loading G-Buddy...
        </p>
      </div>
    </div>
  );
}