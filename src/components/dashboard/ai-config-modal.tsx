"use client";

import { useState, useEffect } from "react";
import { X, Settings, Shield, Cpu, Volume2, Eye, EyeOff } from "lucide-react";

export type AiProvider = "groq" | "openai" | "anthropic";
export type VoiceProvider = "inworld" | "elevenlabs" | "browser";

export interface AiConfig {
  aiProvider: AiProvider;
  aiApiKey: string;
  voiceProvider: VoiceProvider;
  voiceApiKey: string;
}

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AiConfig;
  
  onSave: (config: AiConfig) => void;
}

export function AiConfigModal({ isOpen, onClose, config, onSave }: AiConfigModalProps) {
  const [draft, setDraft] = useState<AiConfig>(config);
  const [showAiKey, setShowAiKey] = useState(false);
  const [showVoiceKey, setShowVoiceKey] = useState(false);

  useEffect(() => {
    setDraft(config);
    setShowAiKey(false);
    setShowVoiceKey(false);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Modal content */}
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] glass-panel shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-lime-500/10 bg-white/[0.03] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lime-300/20 p-2.5">
              <Settings className="h-5 w-5 text-lime-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Configuration</h2>
              <p className="text-xs text-lime-100/60">Manage your intelligence providers</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* AI Provider Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-lime-200">
              <Cpu className="h-4 w-4" />
              <span>AI Provider</span>
            </div>
            
            <div className="space-y-2">
              <select
                value={draft.aiProvider}
                onChange={(e) => setDraft({ ...draft, aiProvider: e.target.value as AiProvider })}
                className="w-full rounded-xl border border-lime-300/15 bg-black/20 px-4 py-2.5 text-sm text-white outline-none focus:border-lime-500/50"
              >
                <option value="groq" className="bg-slate-900">Groq (Llama 3)</option>
                <option value="openai" disabled className="bg-slate-900">OpenAI (Coming Soon)</option>
                <option value="anthropic" disabled className="bg-slate-900">Anthropic (Coming Soon)</option>
              </select>
              
              <div className="relative">
                <input
                  type={showAiKey ? "text" : "password"}
                  placeholder="Enter AI API Key"
                  value={draft.aiApiKey}
                  onChange={(e) => setDraft({ ...draft, aiApiKey: e.target.value })}
                  className="w-full rounded-xl border border-lime-300/15 bg-black/20 pl-10 pr-10 py-2.5 text-sm text-white outline-none focus:border-lime-500/50 placeholder:text-slate-600"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-1p-ignore="true"
                  data-lpignore="true"
                  data-form-type="other"
                />
                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-lime-400/50" />
                <button
                  type="button"
                  onClick={() => setShowAiKey(!showAiKey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-lime-300 transition"
                  tabIndex={-1}
                >
                  {showAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Voice Provider Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-sky-200">
              <Volume2 className="h-4 w-4" />
              <span>Voice Provider</span>
            </div>
            
            <div className="space-y-2">
              <select
                value={draft.voiceProvider}
                onChange={(e) => setDraft({ ...draft, voiceProvider: e.target.value as VoiceProvider })}
                className="w-full rounded-xl border border-lime-300/15 bg-black/20 px-4 py-2.5 text-sm text-white outline-none focus:border-sky-500/50"
              >
                <option value="inworld" className="bg-slate-900">Inworld AI</option>
                <option value="browser" className="bg-slate-900">Browser Native (Free)</option>
                <option value="elevenlabs" disabled className="bg-slate-900">ElevenLabs (Coming Soon)</option>
              </select>
              
              {draft.voiceProvider !== "browser" && (
                <div className="relative">
                  <input
                    type={showVoiceKey ? "text" : "password"}
                    placeholder="Enter Voice API Key"
                    value={draft.voiceApiKey}
                    onChange={(e) => setDraft({ ...draft, voiceApiKey: e.target.value })}
                    className="w-full rounded-xl border border-lime-300/15 bg-black/20 pl-10 pr-10 py-2.5 text-sm text-white outline-none focus:border-sky-500/50 placeholder:text-slate-600"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    data-1p-ignore="true"
                    data-lpignore="true"
                    data-form-type="other"
                  />
                  <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400/50" />
                  <button
                    type="button"
                    onClick={() => setShowVoiceKey(!showVoiceKey)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-lime-300 transition"
                    tabIndex={-1}
                  >
                    {showVoiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200/70">
            <p>Your API keys are stored locally in your browser (IndexedDB) and are never sent to our servers. They are only used to authenticate directly with the providers via the edge API.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-lime-500/10 bg-white/[0.03] px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-lime-500/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.06] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl bg-lime-400/20 border border-lime-300/30 hover:bg-lime-400/30 px-4 py-2.5 text-sm font-bold text-lime-100 shadow-lg shadow-lime-500/20 transition active:scale-95"
          >
            Save Config
          </button>
        </div>
      </div>
    </div>
  );
}
