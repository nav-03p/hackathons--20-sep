// StepNarration — renders LLM/template narration as a structured, scannable
// step list: numbered badge, keyword-matched icon, bold title, detail text
// with highlighted metrics (costs, %, km, hrs, days...). Falls back gracefully
// for any line shape ("Title: detail", "**Title:** detail", plain sentences).
import { ReactNode } from 'react';
import {
  AlertTriangle, MapPin, Crosshair, TrendingDown, TrendingUp,
  Clock, Users, Fuel, Wallet, Sparkles, Target, RefreshCw, ShieldCheck,
} from 'lucide-react';

export interface NarrationStep { title: string; detail: string; }

export function parseNarration(lines: string[]): NarrationStep[] {
  const steps: NarrationStep[] = [];
  for (const raw of lines || []) {
    let s = (raw || '').trim();
    if (!s) continue;
    s = s.replace(/^[-*•]\s*/, '')       // bullets
      .replace(/^\d+[.)]\s*/, '');     // numbering
    s = s.replace(/\*\*/g, '');          // markdown bold
    let title = '';
    let detail = s;
    const idx = s.indexOf(':');
    if (idx > 2 && idx < 55) {
      title = s.slice(0, idx).trim();
      detail = s.slice(idx + 1).trim();
    } else {
      const words = s.split(/\s+/);
      title = words.slice(0, 3).join(' ');
      detail = s;
    }
    if (!detail) detail = title;
    steps.push({ title, detail });
  }
  return steps;
}

// split text into plain segments and "metric" tokens worth highlighting
function renderDetail(text: string): ReactNode[] {
  const parts = text.split(/(\b(?:[€$₹]?\s?\d[\d,.]*(?:\s?(?:%|km|kms|hrs?|hours?|days?|L|litres?|units?))?(?=[\s.,;)–—]|$)))/gi);
  return parts.filter(Boolean).map((p, i) =>
    /^[\d€$₹]/.test(p.trim())
      ? <span key={i} className="text-white font-semibold font-mono">{p}</span>
      : <span key={i}>{p}</span>
  );
}

function iconFor(step: NarrationStep): ReactNode {
  const t = (step.title + ' ' + step.detail).toLowerCase();
  if (/pressure|strain|alert|overload|stress|risk/.test(t)) return <AlertTriangle size={13} className="text-amber-400" />;
  if (/location|coordinate|where|open|site|launch|place|median/.test(t)) return <MapPin size={13} className="text-violet-400" />;
  if (/why|optimal|rationale|minimi/.test(t)) return <Crosshair size={13} className="text-blue-400" />;
  if (/reconnect|rebalance|route|network|shift/.test(t)) return <RefreshCw size={13} className="text-sky-400" />;
  if (/sav|cost|money|€|\$|budget/.test(t)) return /payback|breakeven|break even|roi/.test(t)
    ? <Wallet size={13} className="text-emerald-400" />
    : <TrendingDown size={13} className="text-emerald-400" />;
  if (/km|mileage|distance|fuel/.test(t)) return <Fuel size={13} className="text-orange-400" />;
  if (/labor|labour|team|driver|hour/.test(t)) return <Users size={13} className="text-purple-400" />;
  if (/day|time|timeline|when|month/.test(t)) return <Clock size={13} className="text-blue-300" />;
  if (/capacity|expand|scale|utilization/.test(t)) return <Target size={13} className="text-amber-300" />;
  if (/bottom line|greener|footprint|future|growth/.test(t)) return <Sparkles size={13} className="text-pink-400" />;
  if (/serve|unserved|coverage/.test(t)) return <ShieldCheck size={13} className="text-teal-400" />;
  return <TrendingUp size={13} className="text-[#8080a0]" />;
}

export function StepNarration({ lines, via }: { lines: string[]; via?: string }) {
  const steps = parseNarration(lines);
  if (!steps.length) return null;
  return (
    <div className="relative">
      {/* connector line */}
      <div className="absolute left-[13px] top-2 bottom-2 w-px bg-[#1e1e2e]" />
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="relative flex items-start gap-3 pl-0">
            <div className="relative z-10 w-7 h-7 flex-shrink-0 rounded-full bg-[#111118] border border-[#2a2a3a] flex items-center justify-center">
              {iconFor(s)}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-[#4a4a60]">{String(i + 1).padStart(2, '0')}</span>
                {s.title && <span className="text-xs font-semibold text-white">{s.title}</span>}
              </div>
              <div className="text-xs text-[#a0a0b0] leading-relaxed mt-0.5">
                {renderDetail(s.detail)}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
