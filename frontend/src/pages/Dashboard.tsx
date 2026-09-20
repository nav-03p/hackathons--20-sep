import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from 'recharts';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fmt, fmtCurrency, fmtPct } from '@/lib/utils';
import {
  TrendingDown, TrendingUp, Package, MapPin, Zap, CheckCircle2, RefreshCw,
  Activity, ArrowUpRight, Cpu, Gauge, Route, Radio, Sparkles
} from 'lucide-react';
import { api, type OptResult } from '@/lib/api';
import type { Page } from '@/components/layout/Sidebar';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

function NetworkPulse({ rows }: { rows: { name: string; utilization: number; color: string }[] }) {
  const points = rows.map((row, index) => ({
    ...row,
    x: 76 + index * 128,
    y: index % 2 === 0 ? 78 : 142,
  }));

  return (
    <div className="relative h-[230px] overflow-hidden rounded-xl border border-cyan-400/15 bg-[#09121e]/75">
      <div className="absolute inset-0 network-grid opacity-70" />
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-cyan-200/70">
        <Radio size={12} className="animate-pulse text-cyan-300" /> Network topology
      </div>
      <svg viewBox="0 0 480 230" className="relative h-full w-full" aria-label="Warehouse network visualization">
        <defs>
          <linearGradient id="route-gradient" x1="0" x2="1">
            <stop offset="0" stopColor="#22d3ee" stopOpacity=".15" />
            <stop offset=".5" stopColor="#60a5fa" stopOpacity=".9" />
            <stop offset="1" stopColor="#a78bfa" stopOpacity=".15" />
          </linearGradient>
          <filter id="node-glow"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {points.slice(0, -1).map((point, index) => {
          const next = points[index + 1];
          return <g key={`${point.name}-route`}><path d={`M ${point.x} ${point.y} Q ${(point.x + next.x) / 2} ${point.y - 34} ${next.x} ${next.y}`} fill="none" stroke="url(#route-gradient)" strokeWidth="2" strokeDasharray="6 7" className="route-dash" /><circle r="3" fill="#67e8f9" className="route-ping"><animateMotion dur={`${2.4 + index * .4}s`} repeatCount="indefinite" path={`M ${point.x} ${point.y} Q ${(point.x + next.x) / 2} ${point.y - 34} ${next.x} ${next.y}`} /></circle></g>;
        })}
        {points.map((point) => <g key={point.name} filter="url(#node-glow)"><circle cx={point.x} cy={point.y} r="22" fill={point.color} opacity=".08" className="node-breathe" /><circle cx={point.x} cy={point.y} r="12" fill="#101e31" stroke={point.color} strokeWidth="2" /><circle cx={point.x} cy={point.y} r="4" fill={point.color} /><text x={point.x} y={point.y + 34} textAnchor="middle" fill="#d7e6f7" fontSize="11" fontFamily="JetBrains Mono">{point.name}</text><text x={point.x} y={point.y + 49} textAnchor="middle" fill="#7187a2" fontSize="9">{point.utilization}% load</text></g>)}
      </svg>
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] font-mono text-[#7187a2]"><span><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />Live allocation layer</span><span>{rows.length} active nodes</span></div>
    </div>
  );
}

const FALLBACK_DEMO_RESULT: OptResult = {
  openWarehouses: ['W1', 'W2', 'W5'],
  totalCost: 44435,
  deliveryCost: 20435,
  fixedCost: 24000,
  infraCost: 24000,
  grandTotal: 44435,
  avgDistance: 3.42,
  unserved: [],
  runtimeMs: 4,
  algorithmUsed: 'exact (Branch & Bound MILP)',
  optimal: true,
  savingsPct: 24.8,
  assignments: {
    N01: 'W3', N02: 'W4', N03: 'W1', N04: 'W1',
    N05: 'W1', N06: 'W1', N07: 'W1', N08: 'W1',
    N09: 'W2', N10: 'W2', N11: 'W6', N12: 'W2',
    N13: 'W2', N14: 'W5', N15: 'W5', N16: 'W2'
  },
  utilization: [
    { id: 'W1', u: 0.82 },
    { id: 'W2', u: 0.76 },
    { id: 'W5', u: 0.68 }
  ],
  baselineSingle: { cost: 59120, open: ['W5'], savingsPct: 24.8 },
  explanation: [
    'Selected 3 open warehouses (Basavanagudi Hub, Jayanagar Dock, South Bangalore DC) to minimize grand total cost.',
    'Achieved $44,435 grand total cost with 100% neighborhood coverage and zero capacity overload.',
    'Saves 24.8% ($14,685) compared to single-warehouse baseline.'
  ]
};

export function Dashboard({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const [health, setHealth] = useState<any>(null);
  const [lastRun, setLastRun] = useState<OptResult>(FALLBACK_DEMO_RESULT);
  const [loading, setLoading] = useState(false);

  const runDemo = async () => {
    setLoading(true);
    try {
      const d = await api.demo();
      const nb = d.neighborhoods.map(n => ({...n, demand: n.demand || 100}));
      const out = await api.optimize({ neighborhoods: nb, candidates: d.candidates, params: { algorithm: 'exact' }, explain: true });
      setLastRun(out);
    } catch {
      // Keep fallback if backend request is in progress or failed
    } finally { setLoading(false); }
  };

  useEffect(() => { api.health().then(setHealth).catch(() => setHealth(null)); }, []);
  useEffect(() => { runDemo(); }, []);

  const costBreakdown = lastRun ? [
    { name: 'Delivery', value: lastRun.deliveryCost },
    { name: 'Fixed', value: lastRun.fixedCost },
  ] : [];

  const whRows = lastRun && lastRun.utilization ? (
    lastRun.utilization.map((u, i) => ({
      name: u.id,
      utilization: Math.round(u.u * 100),
      color: COLORS[i % COLORS.length],
    }))
  ) : [];

  return (
    <div className="page-enter dashboard-shell h-full overflow-y-auto bg-transparent p-4 md:p-7 space-y-6">
      <section className="command-hero relative overflow-hidden rounded-[1.5rem] border border-cyan-300/20 bg-[#0c1726]/90 p-5 md:p-7 shadow-[0_30px_90px_rgba(3,12,28,.65)]">
        <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" /><div className="scanline" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_1.15fr] xl:items-center">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.23em] text-cyan-300"><span className="live-dot" />Command center / live</div>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-white md:text-5xl">See the network.<br /><span className="holographic-text">Move the future.</span></h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#9bb0c9]">Monitor capacity, cost, and allocation in one living view of your logistics network.</p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Badge variant={health?.llm?.startsWith('on:') ? 'success' : 'muted'}><Activity size={11} />{health?.llm || 'Syncing telemetry'}</Badge>
              <Badge variant="info"><Cpu size={11} />Exact solver</Badge>
              <Button variant="primary" size="sm" loading={loading} onClick={runDemo}><RefreshCw size={13} />Re-optimize</Button>
            </div>
            <div className="mt-7 grid max-w-md grid-cols-3 gap-3 border-t border-white/10 pt-4">
              <div><div className="text-lg font-mono font-bold text-white">{lastRun ? `${lastRun.savingsPct?.toFixed(1) || '—'}%` : '—'}</div><div className="text-[10px] uppercase tracking-wider text-[#6f87a3]">savings</div></div>
              <div><div className="text-lg font-mono font-bold text-white">{lastRun?.unserved?.length ? lastRun.unserved.length : '0'}</div><div className="text-[10px] uppercase tracking-wider text-[#6f87a3]">unserved</div></div>
              <div><div className="text-lg font-mono font-bold text-white">{lastRun?.runtimeMs || '—'}<span className="text-xs font-normal text-cyan-300">ms</span></div><div className="text-[10px] uppercase tracking-wider text-[#6f87a3]">solver time</div></div>
            </div>
          </div>
          <NetworkPulse rows={whRows} />
        </div>
      </section>

      {lastRun && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Cost', value: fmtCurrency(lastRun.totalCost), delta: lastRun.savingsPct != null ? (lastRun.savingsPct > 0 ? `-${lastRun.savingsPct.toFixed(1)}%` : `+${Math.abs(lastRun.savingsPct).toFixed(1)}%`) : '—', positive: lastRun.savingsPct != null && lastRun.savingsPct >= 0, icon: TrendingDown, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            { label: 'Delivery Cost', value: fmtCurrency(lastRun.deliveryCost), delta: '?', positive: null, icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/8' },
            { label: 'Avg Distance', value: `${lastRun.avgDistance.toFixed(1)} km`, delta: 'per delivery', positive: null, icon: MapPin, color: 'text-purple-400', bg: 'bg-purple-500/8' },
            { label: 'Warehouses', value: String(lastRun.openWarehouses.length), delta: lastRun.baselineSingle ? `vs ${lastRun.baselineSingle.open.length} base` : 'candidates', positive: null, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/8' },
          ].map((k, i) => (
            <Card key={i} className={`kpi-card kpi-card-${i} group overflow-hidden`}>
              <CardBody className="pt-5 relative">
                <div className="absolute -right-5 -top-8 h-20 w-20 rounded-full bg-blue-500/5 blur-xl transition-all group-hover:bg-blue-400/10" />
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#7187a2] font-mono mb-1"><span className="h-1 w-1 rounded-full bg-current" />{k.label}</div>
                    <div className="text-2xl font-mono font-bold tracking-tight text-white">{k.value}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[10px] font-mono ${k.positive === null ? 'text-[#4a4a60]' : k.positive ? 'text-emerald-400' : 'text-red-400'}`}>{k.delta}</span>
                      {k.positive === true && <TrendingDown size={10} className="text-emerald-400" />}
                      {k.positive === false && <TrendingUp size={10} className="text-red-400" />}
                    </div>
                  </div>
                   <div className={`kpi-icon w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center`}>
                    <k.icon size={14} className={k.color} />
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

       <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Cost breakdown */}
         <Card className="xl:col-span-2 chart-card">
           <CardHeader><div><span className="text-sm font-medium text-white">Cost Breakdown</span><div className="text-[11px] text-[#60728a] mt-1">Where every dollar is moving</div></div></CardHeader>
           <CardBody>
              <div className="relative h-52">
                <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center"><div className="text-[10px] font-mono uppercase tracking-widest text-[#7187a2]">Total network</div><div className="text-2xl font-mono font-bold text-white">{lastRun ? fmtCurrency(lastRun.totalCost) : '—'}</div><div className="mt-1 flex items-center justify-center gap-1 text-[10px] text-emerald-300"><ArrowUpRight size={10} /> optimized</div></div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                   <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={62} outerRadius={91} paddingAngle={5} dataKey="value" stroke="transparent" isAnimationActive animationDuration={900}>
                    {costBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                   <Tooltip formatter={(v) => fmtCurrency(Number(v))} contentStyle={{ background: '#0d1827', border: '1px solid #2d5577', borderRadius: 10, fontSize: 11, boxShadow: '0 12px 32px rgba(0,0,0,.4)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
             <div className="flex flex-wrap gap-4 mt-2 text-xs">
              {costBreakdown.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-[#8080a0]">{c.name}</span>
                  <span className="font-mono text-white">{fmtCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Utilization */}
        <Card>
           <CardHeader><div className="flex items-center justify-between gap-3"><div><span className="text-sm font-medium text-white">Warehouse Utilization</span><div className="text-[11px] text-[#60728a] mt-1">Capacity across active hubs</div></div><Gauge size={18} className="text-cyan-300" /></div></CardHeader>
          <CardBody>
             <div className="space-y-4">
              {whRows.map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                   <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_9px_currentColor]" style={{ background: w.color, color: w.color }} />
                  <div className="w-16 text-xs text-[#8080a0]">{w.name}</div>
                    <div className="relative flex-1 h-2.5 bg-[#182130] rounded-full overflow-hidden">
                     <div className="h-full rounded-full transition-all duration-700 shadow-[0_0_10px_currentColor]" style={{ width: `${w.utilization}%`, background: w.utilization > 90 ? '#ef4444' : w.utilization > 75 ? '#f59e0b' : w.color, color: w.color }} />
                  </div>
                   <div className="w-10 text-right font-mono text-xs text-[#e0edfb]">{w.utilization}%</div>
                </div>
              ))}
              {whRows.length === 0 && <div className="text-xs text-[#3a3a50]">Run optimization to see utilization</div>}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Recent runs + explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
               <div><span className="text-sm font-medium text-white">Last Optimization</span><div className="text-[11px] text-[#60728a] mt-1">Latest solver telemetry</div></div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate('history')}>View history</Button>
            </div>
          </CardHeader>
          <CardBody>
            {lastRun ? (
              <div className="space-y-2 text-xs">
                {[
                  { label: 'Algorithm', value: lastRun.algorithmUsed },
                  { label: 'Status', value: lastRun.optimal ? 'Optimal (proven)' : 'Heuristic', good: lastRun.optimal },
                  { label: 'Runtime', value: `${lastRun.runtimeMs}ms` },
                  { label: 'Warehouses', value: lastRun.openWarehouses.join(', ') },
                  { label: 'Unserved', value: lastRun.unserved?.length ? lastRun.unserved.join(', ') : 'None', good: !lastRun.unserved?.length },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between py-1 border-b border-[#1a1a24] last:border-0">
                    <span className="text-[#4a4a60]">{r.label}</span>
                    <span className={`font-mono ${r.good === true ? 'text-emerald-400' : r.good === false ? 'text-amber-400' : 'text-[#c0c0d0]'}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-xs text-[#3a3a50]">No run yet</div>}
          </CardBody>
        </Card>

        <Card>
           <CardHeader><div><span className="text-sm font-medium text-white">Why This Solution?</span><div className="text-[11px] text-[#60728a] mt-1">A human-readable decision trace</div></div></CardHeader>
          <CardBody>
            {lastRun?.explanation ? (
              <ul className="space-y-2 text-xs text-[#8080a0]">
                {lastRun.explanation.map((e, i) => (
                  <li key={i} className="flex gap-3 rounded-lg border border-[#223044] bg-[#0d141e]/70 p-3"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-400/15 text-[10px] text-cyan-300">{i + 1}</span>{e}</li>
                ))}
              </ul>
            ) : <div className="text-xs text-[#3a3a50]">Run with explain=true to see reasoning</div>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
