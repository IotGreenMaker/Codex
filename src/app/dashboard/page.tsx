import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ServiceWorkerRegistration } from "@/components/onboarding/service-worker-registration";

export default function DashboardPage() {
  return (
    <>
      <ServiceWorkerRegistration />
      <DashboardShell
        heading="G-Buddy your best dashboard for climate, feeding, and grow-cycle decisions."
        subheading="Track your plants, review progression graphs, calculate nutrient inputs, and keep every voice interaction tied to structured grow data."
      />
    </>
  );
}