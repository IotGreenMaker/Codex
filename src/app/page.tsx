"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sprout, Mic, Bot, BarChart3, Shield, WifiOff, Download, ArrowRight } from "lucide-react";
import { usePlants } from "@/hooks/use-plants";

export default function HomePage() {
  const { plants, addPlant, loadedFromServer } = usePlants();
  const router = useRouter();

  const handleGetStarted = async () => {
    if (plants.length === 0) {
      await addPlant({ strainName: "My First Plant", stage: "Seedling" });
    }
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-hero-grid relative">
      {/* Animated background orbs - behind all content */}
      <div className="bg-orb bg-orb--green" aria-hidden="true" />
      <div className="bg-orb bg-orb--purple" aria-hidden="true" />
      <div className="bg-orb bg-orb--orange" aria-hidden="true" />

        <section className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:py-32 lg:px-6">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-8 ">
              <div className="rounded-3xlbg-gradient-to-br sh-glow   from-lime-300/35 via-fuchsia-400/25 to-emerald-300/25 p-6 ring-1 ring-lime-400/20 ">
               <img src="/g-icon.png" alt="G-Buddy Icon" className="h-20 w-20 "/>
              </div>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
              <span className="text-lime-400">G-Buddy</span>
            </h1>
            <p className="mt-4 text-lg font-medium text-lime-300/80">
              Your AI-Powered Grow Companion
            </p>
            <p className="mt-6 max-w-2xl mx-auto text-base leading-relaxed text-slate-400">
              Track your grow, log watering with your voice, get AI-powered advice.
              <br />
              <span className="text-lime-400/80">100% private. 100% local. No account needed.</span>
            </p>

            <div className="mt-10 flex items-center justify-center gap-4">
              <button
                onClick={handleGetStarted}
                disabled={!loadedFromServer}
                className="group flex items-center gap-2 rounded-xl bg-lime-400/20 px-6 py-3 text-base font-semibold text-lime-100 border border-lime-400/30 hover:bg-lime-400/30 transition-all shadow-[0_0_20px_rgba(132,204,22,0.1)] hover:shadow-[0_0_30px_rgba(132,204,22,0.2)] disabled:opacity-50"
              >
                {plants.length > 0 ? "Open Dashboard" : "Get Started"}
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>

      {/* Features Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-24 lg:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">Everything You Need</h2>
          <p className="mt-3 text-slate-400">All the tools to grow with confidence</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Voice Logging */}
          <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-lime-400/30 hover:bg-lime-400/5 transition-all">
            <div className="mb-4 rounded-xl bg-lime-400/10 p-3 w-fit">
              <Mic className="h-6 w-6 text-lime-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Voice Logging</h3>
            <p className="mt-2 text-sm text-slate-400">
              Just speak naturally. "I watered 500ml, pH 6.2" — G-Buddy logs it automatically.
            </p>
          </div>

          {/* AI Assistant */}
          <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-lime-400/30 hover:bg-lime-400/5 transition-all">
            <div className="mb-4 rounded-xl bg-lime-400/10 p-3 w-fit">
              <Bot className="h-6 w-6 text-lime-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
            <p className="mt-2 text-sm text-slate-400">
              Get instant advice on nutrients, diagnose problems, and learn best practices.
            </p>
          </div>

          {/* Track Progress */}
          <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-lime-400/30 hover:bg-lime-400/5 transition-all">
            <div className="mb-4 rounded-xl bg-lime-400/10 p-3 w-fit">
              <BarChart3 className="h-6 w-6 text-lime-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Track Progress</h3>
            <p className="mt-2 text-sm text-slate-400">
              Monitor VPD, watering history, climate trends, and nutrient calculations.
            </p>
          </div>

          {/* Privacy First */}
          <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-lime-400/30 hover:bg-lime-400/5 transition-all">
            <div className="mb-4 rounded-xl bg-lime-400/10 p-3 w-fit">
              <Shield className="h-6 w-6 text-lime-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Privacy First</h3>
            <p className="mt-2 text-sm text-slate-400">
              All data stays on your device. No cloud, no tracking, no accounts required.
            </p>
          </div>

          {/* Works Offline */}
          <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-lime-400/30 hover:bg-lime-400/5 transition-all">
            <div className="mb-4 rounded-xl bg-lime-400/10 p-3 w-fit">
              <WifiOff className="h-6 w-6 text-lime-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Works Offline</h3>
            <p className="mt-2 text-sm text-slate-400">
              No internet? No problem. Your grow data is always available, even without connection.
            </p>
          </div>

          {/* Export Data */}
          <div className="group rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-lime-400/30 hover:bg-lime-400/5 transition-all">
            <div className="mb-4 rounded-xl bg-lime-400/10 p-3 w-fit">
              <Download className="h-6 w-6 text-lime-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Export Data</h3>
            <p className="mt-2 text-sm text-slate-400">
              Download your grow data for analysis or sharing.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-24 lg:px-6">
        <div className="rounded-3xl border border-lime-400/20 bg-gradient-to-br from-lime-400/5 to-transparent p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to Grow Smarter?
          </h2>
          <p className="mt-4 text-slate-400 max-w-xl mx-auto">
            Start tracking your grow today. No sign-up, no credit card, no hassle.
          </p>
          <button
            onClick={handleGetStarted}
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-lime-400/20 px-8 py-3 text-base font-semibold text-lime-100 border border-lime-400/30 hover:bg-lime-400/30 transition-all"
          >
            {plants.length > 0 ? "Resume Grow" : "Get Started — It's Free"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500 lg:px-6">
          <p>G-Buddy — AI Grow Companion. Built for growers.</p>
          <p className="mt-1">Open source. Privacy-first. No tracking.</p>
        </div>
      </footer>
    </main>
  );
}