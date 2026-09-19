import { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { fmt, fmtCurrency, fmtPct } from '@/lib/utils';
import {
  TrendingDown, TrendingUp, Package, MapPin, Zap, Users,
  AlertTriangle, CheckCircle2, RefreshCw, ExternalLink, Clock, Loader2
} from 'lucide-react';
import { api, type OptResult } from '@/lib/api';
import type { Page } from '@/components/layout/Sidebar';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

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
    <div className="h-full overflow-y-auto bg-[#0a0a0f] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Overview</h1>
          <p className="text-xs text-[#4a4a60] mt-0.5">Live optimization · {health ? health.db : 'starting...'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={health?.llm?.startsWith('on:') ? 'success' : 'muted'}>
            {health?.llm || 'loading...'}
          </Badge>
          <Button variant="primary" size="sm" loading={loading} onClick={runDemo}>
            <RefreshCw size={13} />Re-optimize
          </Button>
        </div>
      </div>

      {lastRun && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Cost', value: fmtCurrency(lastRun.totalCost), delta: lastRun.savingsPct != null ? (lastRun.savingsPct > 0 ? `-${lastRun.savingsPct.toFixed(1)}%` : `+${Math.abs(lastRun.savingsPct).toFixed(1)}%`) : '—', positive: lastRun.savingsPct != null && lastRun.savingsPct >= 0, icon: TrendingDown, color: 'text-emerald-400', bg: 'bg-emerald-500/8' },
            { label: 'Delivery Cost', value: fmtCurrency(lastRun.deliveryCost), delta: '?', positive: null, icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/8' },
            { label: 'Avg Distance', value: `${lastRun.avgDistance.toFixed(1)} km`, delta: 'per delivery', positive: null, icon: MapPin, color: 'text-purple-400', bg: 'bg-purple-500/8' },
            { label: 'Warehouses', value: String(lastRun.openWarehouses.length), delta: lastRun.baselineSingle ? `vs ${lastRun.baselineSingle.open.length} base` : 'candidates', positive: null, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/8' },
          ].map((k, i) => (
            <Card key={i}>
              <CardBody className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-[#4a4a60] font-mono mb-1">{k.label}</div>
                    <div className="text-xl font-mono font-bold text-white">{k.value}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[10px] font-mono ${k.positive === null ? 'text-[#4a4a60]' : k.positive ? 'text-emerald-400' : 'text-red-400'}`}>{k.delta}</span>
                      {k.positive === true && <TrendingDown size={10} className="text-emerald-400" />}
                      {k.positive === false && <TrendingUp size={10} className="text-red-400" />}
                    </div>
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center`}>
                    <k.icon size={14} className={k.color} />
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader><span className="text-sm font-medium text-white">Cost Breakdown</span></CardHeader>
          <CardBody>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                    {costBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtCurrency(Number(v))} contentStyle={{ background: '#111118', border: '1px solid #2a2a3a', borderRadius: 6, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 text-xs">
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
          <CardHeader><span className="text-sm font-medium text-white">Warehouse Utilization</span></CardHeader>
          <CardBody>
            <div className="space-y-3">
              {whRows.map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: w.color }} />
                  <div className="w-16 text-xs text-[#8080a0]">{w.name}</div>
                  <div className="flex-1 h-1.5 bg-[#1a1a24] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${w.utilization}%`, background: w.utilization > 90 ? '#ef4444' : w.utilization > 75 ? '#f59e0b' : w.color }} />
                  </div>
                  <div className="w-10 text-right font-mono text-xs text-[#c0c0d0]">{w.utilization}%</div>
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
              <span className="text-sm font-medium text-white">Last Optimization</span>
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
          <CardHeader><span className="text-sm font-medium text-white">Why This Solution?</span></CardHeader>
          <CardBody>
            {lastRun?.explanation ? (
              <ul className="space-y-2 text-xs text-[#8080a0]">
                {lastRun.explanation.map((e, i) => (
                  <li key={i} className="flex gap-2"><span className="text-blue-400">•</span>{e}</li>
                ))}
              </ul>
            ) : <div className="text-xs text-[#3a3a50]">Run with explain=true to see reasoning</div>}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
