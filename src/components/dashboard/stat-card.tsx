import type { ReactNode } from "react";

type StatCardProps = {
  eyebrow: string;
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
};

export function StatCard({ eyebrow, title, value, helper, icon }: StatCardProps) {
  return (
    <div className="glass-panel rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">{eyebrow}</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{title}</h3>
        </div>
        <div className="rounded-2xl border border-lime-300/20 bg-lime-300/10 p-3 text-lime-200">{icon}</div>
      </div>
      <p className="mt-6 text-3xl font-bold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{helper}</p>
    </div>
  );
}
