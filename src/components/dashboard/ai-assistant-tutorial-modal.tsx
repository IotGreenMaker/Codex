"use client";

import { BookOpen, X, Sparkles, MessageSquare, Brain, TrendingUp, BarChart3, Target, Zap, CheckCircle2, Lightbulb, Eye, Send, Mic } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

type AiAssistantTutorialModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const chatExamples = [
  {
    category: "Watering Schedule",
    prompt: "Should I water today?",
    response: "Based on your last watering 3 days ago and current soil moisture trends, yes - it's a good time to water. Your plants are in week 5 of veg and consuming more water daily. I'd recommend watering in the morning, about 1 hour after lights on, so the roots can absorb before the midday heat peak."
  },
  {
    category: "Light Schedule",
    prompt: "What's the best time to run my lights?",
    response: "For your current veg stage, running lights from 6 AM to 10 PM (16/8 cycle) is ideal. This gives you a consistent schedule and aligns with natural daylight patterns. If you're on a time-of-use electricity plan, consider shifting to off-peak hours - just keep the 16-hour window consistent."
  },
  {
    category: "PPFD Check",
    prompt: "Is my PPFD too high for seedlings?",
    response: "Your current PPFD reading is around 400 μmol/m²/s at canopy level. For seedlings, the ideal range is 200-300 μmol/m²/s. I'd recommend raising your light to 24 inches or dimming to 40% for the next 10-14 days. Once you see 3-4 true leaf nodes, you can gradually increase to 400-500."
  },
  {
    category: "Bloom Timing",
    prompt: "How many days in bloom until harvest?",
    response: "You're currently on day 18 of bloom. Most strains finish between 55-70 days of bloom, so you're looking at roughly 5-7 more weeks. Your strain typically runs 63 days, so expect harvest around day 63. Watch for trichome changes starting around week 7 to dial in the exact day."
  },
  {
    category: "Temperature Alert",
    prompt: "I had a temp spike to 31°C. Should I worry?",
    response: "A single spike to 31°C isn't critical, but it's above the ideal 24-27°C range for your current stage. If it was brief (under 2 hours), your plants should be fine. Check for leaf curling or bleaching over the next 24 hours. If this keeps happening, consider increasing exhaust fan speed or adding oscillating fans for better air movement."
  },
  {
    category: "Diagnosis",
    prompt: "My leaves are drooping. What's going on?",
    response: "Drooping leaves can mean a few things. Based on your data: you watered 4 days ago and your medium looks dry, so this is likely underwatering. However, if the leaves feel heavy and wet, it could be overwatering. Check the weight of your pots - if they feel light, water now. If heavy, let them dry out more and improve drainage."
  }
];

const keyFeatures = [
  {
    icon: <Brain className="h-5 w-5" />,
    title: "Smart Context Awareness",
    description: "The AI knows your plant's current stage, climate data, watering history, and nutrient schedule. Every recommendation is personalized to YOUR exact situation."
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Natural Language Commands",
    description: "Just ask in plain English. 'Should I water today?' 'Increase my light to 80%' 'My pH dropped to 5.8 - is that ok?' The AI understands and acts on your requests."
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Proactive Alerts",
    description: "The AI monitors your grow conditions and alerts you when something needs attention - before problems become serious."
  },
  {
    icon: <Target className="h-5 w-5" />,
    title: "Stage-Specific Guidance",
    description: "Advice changes based on your plant's growth stage. Seedling care differs dramatically from late bloom - the AI always gives stage-appropriate guidance."
  },
  {
    icon: <TrendingUp className="h-5 w-5" />,
    title: "Growth Pattern Recognition",
    description: "Over time, the AI learns what works for your specific setup and can predict optimal conditions based on your historical data."
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Instant Calculations",
    description: "Nutrient mixing ratios, VPD calculations, watering schedules - just ask and get precise numbers instead of doing math yourself."
  }
];

export function AiAssistantTutorialModal({ isOpen, onClose }: AiAssistantTutorialModalProps) {
  const [currentExample, setCurrentExample] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<"idle" | "typing-prompt" | "showing-prompt" | "typing-response" | "showing-response">("idle");
  const [typedPrompt, setTypedPrompt] = useState("");
  const [typedResponse, setTypedResponse] = useState("");

  const animateConversation = useCallback((exampleIndex: number) => {
    const example = chatExamples[exampleIndex];
    
    // Reset state
    setTypedPrompt("");
    setTypedResponse("");
    setAnimationPhase("typing-prompt");
    
    // Type out the prompt
    let charIndex = 0;
    const promptInterval = setInterval(() => {
      if (charIndex <= example.prompt.length) {
        setTypedPrompt(example.prompt.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(promptInterval);
        setAnimationPhase("showing-prompt");
        
        // Start typing response after a brief pause
        setTimeout(() => {
          setAnimationPhase("typing-response");
          let respIndex = 0;
          const responseInterval = setInterval(() => {
            if (respIndex <= example.response.length) {
              setTypedResponse(example.response.slice(0, respIndex));
              respIndex++;
            } else {
              clearInterval(responseInterval);
              setAnimationPhase("showing-response");
              
              // Move to next example after pause
              setTimeout(() => {
                const nextIndex = (exampleIndex + 1) % chatExamples.length;
                setCurrentExample(nextIndex);
                animateConversation(nextIndex);
              }, 2000);
            }
          }, 12);
        }, 400);
      }
    }, 20);

    return () => {
      clearInterval(promptInterval);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentExample(0);
      animateConversation(0);
    }
  }, [isOpen, animateConversation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl glass-panel flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-lime-500/10 bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lime-300/20 p-2.5">
              <BookOpen className="h-5 w-5 text-lime-400" />
            </div>
            <div>
              <p className="font-semibold text-lg text-lime-100">AI Assistant Guide</p>
              <p className="text-xs text-lime-100/60">Master your grow with intelligent assistance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          
          {/* Welcome Section */}
          <section>
            <div className="rounded-xl glass-panel p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-lime-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-lime-100 text-lg mb-2">Your Personal Grow Intelligence</h3>
                  <p className="text-sm text-lime-100/80 leading-relaxed">
                    The AI Assistant is your expert grow partner. It understands your plants' complete history - from climate data 
                    and VPD trends to watering schedules and nutrient levels. Whether you're debugging a problem, planning your next 
                    feed, or just want a second opinion, the AI is always ready with personalized, stage-specific advice.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Key Advantages */}
          <section>
            <h3 className="font-semibold text-lime-100 text-base mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-lime-400" />
              Key Advantages
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {keyFeatures.map((feature, idx) => (
                <div key={idx} className="rounded-xl glass-panel p-4 hover:bg-white/[0.06] transition">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lime-400">{feature.icon}</span>
                    <span className="font-medium text-sm text-lime-100">{feature.title}</span>
                  </div>
                  <p className="text-xs text-lime-100/70 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Charts Deep Dive */}
          <section>
            <h3 className="font-semibold text-lime-100 text-base mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-lime-400" />
              Charts: Your Pattern Recognition Powerhouse
            </h3>
            <div className="space-y-4">
              {/* VPD Chart Highlight */}
              <div className="rounded-xl glass-panel p-5">
                <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-500/15 p-2 flex-shrink-0">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lime-100 mb-1">VPD Chart - The Climate Compass</h4>
                    <p className="text-xs text-lime-100/70 leading-relaxed mb-3">
                      The VPD chart is your window into the relationship between temperature and humidity. By watching where your 
                      plant sits on the heatmap over time, you'll develop an intuitive understanding of the <em>exact conditions</em> 
                      that produce the best results. 
                    </p>
                    <div className="rounded-lg bg-black/15 p-3">
                      <p className="text-xs text-lime-100/90 font-medium mb-1">Why it matters:</p>
                      <ul className="text-xs text-lime-100/50 space-y-1">
                        <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" /> Recognize that Day 35 with 25°C and 55% RH gave your best growth surge</li>
                        <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" /> Notice patterns: "Every time VPD drops below 0.8, growth slows"</li>
                        <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" /> Build consistency: replicate winning conditions across every grow</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Growth Chart Highlight */}
              <div className="rounded-xl glass-panel p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-green-500/15 p-2 flex-shrink-0">
                    <BarChart3 className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-lime-100 mb-1">Growth Chart - The Progress Tracker</h4>
                    <p className="text-xs text-lime-100/70 leading-relaxed mb-3">
                      The growth progress chart overlays temperature, humidity, VPD, and watering data on a single timeline. 
                      This lets you correlate specific environmental conditions with growth rate and plant health - something 
                      impossible to see from individual data points alone.
                    </p>
                    <div className="rounded-lg bg-black/15 p-3">
                      <p className="text-xs text-lime-100/90 font-medium mb-1">Why it matters:</p>
                      <ul className="text-xs text-lime-100/50 space-y-1">
                        <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" /> Spot trends: "Week 3 had the highest daily growth - what changed?"</li>
                        <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" /> Connect watering events to growth spikes for optimal scheduling</li>
                        <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" /> Compare grows side-by-side to refine your technique</li>
                        <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-400 mt-0.5 flex-shrink-0" /> Data-driven decisions replace guessing and "grow feel"</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Chat Demo */}
          <section>
            <h3 className="font-semibold text-lime-100 text-base mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-lime-400" />
              See AI in Action
            </h3>
            
            {/* Mock Chat Window */}
            <div className="rounded-2xl glass-panel overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-lime-500/10 bg-white/[0.03]">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-lime-300/70">
                  AI Conversation Demo
                </p>
                <span className="flex rounded-full px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest bg-lime-300/14 text-lime-100">
                  connected
                  <div className="flex items-center gap-2 ml-2">
                    <div className={`w-2 h-2 rounded-full ${animationPhase !== "idle" ? "bg-green-400 animate-pulse" : "bg-slate-500"}`} />
                  </div>
                </span>
              </div>
              
              {/* Chat Messages */}
              <div className="p-4 space-y-3 min-h-[320px] max-h-[400px] overflow-y-auto pr-1 bg-black/5">
                {/* User Message */}
                {(animationPhase === "typing-prompt" || animationPhase === "showing-prompt" || animationPhase === "typing-response" || animationPhase === "showing-response") && (
                  <div className="border-l-2 border-green-500/80 pl-3 pb-2 animate-fade-in-up">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
                      👤 You
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-100">
                      {typedPrompt}
                      {animationPhase === "typing-prompt" && <span className="animate-pulse">|</span>}
                    </p>
                  </div>
                )}
                
                {/* AI Response */}
                {(animationPhase === "typing-response" || animationPhase === "showing-response") && (
                  <div className="border-l-2 border-indigo-500/80 pl-3 pb-2 animate-fade-in-up">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-400">
                      🤖 Assistant
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-100 whitespace-pre-line">
                      {typedResponse}
                      {animationPhase === "typing-response" && <span className="animate-pulse">|</span>}
                    </p>
                    
                  </div>
                )}
                
                {/* Placeholder when idle */}
                {animationPhase === "idle" && (
                  <div className="flex items-center justify-center h-[280px] text-slate-400">
                    <p className="text-sm italic">Starting demo conversation...</p>
                  </div>
                )}
              </div>
              
              {/* Chat Input */}
              <div className="p-3 border-t border-lime-500/10 bg-white/[0.03]">
                <div className="flex gap-2">
                  <div className="flex-1 rounded-full border border-lime-300/15 bg-black/15 px-3 py-2 text-sm text-lime-100">
                    <span className="text-slate-500 text-sm">Type or speak...</span>
                  </div>
                  <button
                    type="button"
                    className="group relative grid h-10 w-10 place-items-center rounded-full border border-lime-300/20 bg-gradient-to-br from-lime-300/12 via-fuchsia-400/8 to-emerald-300/8 text-lime-100 transition"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-lime-300/15 bg-lime-300/8 px-4 py-2 text-sm font-semibold text-lime-100 transition flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Demo Navigation Dots */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {chatExamples.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentExample(idx);
                    animateConversation(idx);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentExample 
                      ? "w-6 bg-lime-400" 
                      : "w-2 bg-lime-100/20 hover:bg-lime-100/30"
                  }`}
                  aria-label={`View ${chatExamples[idx].category} example`}
                />
              ))}
            </div>
            
            <p className="text-center text-xs text-lime-100/50 mt-3">
              Click dots to explore different conversation examples
            </p>
          </section>

          {/* Pro Tips */}
          <section>
            <h3 className="font-semibold text-lime-100 text-base mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-lime-400" />
              Pro Tips
            </h3>
            <div className="rounded-xl glass-panel p-5 border-l-2 border-l-amber-400/40">
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-lime-400 mt-2 flex-shrink-0" />
                  <p className="text-sm text-lime-100/80"><strong className="text-lime-100">Be specific:</strong> Instead of "how's my grow?" try "is my VPD optimal for week 5 bloom?"</p>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-lime-400 mt-2 flex-shrink-0" />
                  <p className="text-sm text-lime-100/80"><strong className="text-lime-100">Ask follow-ups:</strong> The AI maintains conversation context. Build on previous answers.</p>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-lime-400 mt-2 flex-shrink-0" />
                  <p className="text-sm text-lime-100/80"><strong className="text-lime-100">Log consistently:</strong> More data = better AI insights. Regular watering and climate logs unlock powerful pattern recognition.</p>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-lime-400 mt-2 flex-shrink-0" />
                  <p className="text-sm text-lime-100/80"><strong className="text-lime-100">Use charts + AI together:</strong> Check your charts first, then ask the AI "why did this happen?" for deeper insights.</p>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-lime-400 mt-2 flex-shrink-0" />
                  <p className="text-sm text-lime-100/80"><strong className="text-lime-100">Save winning recipes:</strong> When a nutrient mix produces great results, ask the AI to help you save and replicate it.</p>
                </li>
              </ul>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-lime-500/10 bg-black/10 flex items-center justify-between">
          <p className="text-xs text-lime-100/60">Tip: Keep this guide handy until you're comfortable with all features</p>
          <button
            onClick={onClose}
            className="rounded-lg bg-lime-400/20 border border-lime-300/30 hover:bg-lime-400/30 px-4 py-2 text-sm font-semibold text-lime-100 transition"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}