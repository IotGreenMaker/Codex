import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CurrentTimeProvider } from "@/lib/time-context";

export default function DashboardPage() {
  return (
    <CurrentTimeProvider>
      <DashboardShell
        heading="G-Buddy your best dashboard for climate, feeding, and grow-cycle decisions."
        subheading="Track your plants, review progression graphs, calculate nutrient inputs, and keep every voice interaction tied to structured grow data."
      />
    </CurrentTimeProvider>
  );
}