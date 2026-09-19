import { useState, useCallback } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fmtCurrency, fmtPct } from '@/lib/utils';
import {
  Play, X, CheckCircle2, AlertTriangle,
  Loader2, Info, ChevronDown
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { api, type Params, type OptResult, type Point, type Candidate } from '@/lib/api';

type AlgoKey = 'greedy' | 'kmedoids' | 'localsearch' | 'annealing' | 'exact' | 'kmeans';
const ALGORITHMS: { key: AlgoKey; label: string }[] = [
  { key: 'exact',      label: 'Exact (branch & bound)' },
  { key: 'annealing',   label: 'Simulated Annealing' },
  { key: 'localsearch', label: 'Local Search' },
  { key: 'kmedoids',    label: 'K-Medoids' },
  { key: 'kmeans',      label: 'K-Means' },
  { key: 'greedy',      label: 'Greedy' },
];
const DIST_METRICS = [
  { key: 'euclidean', label: 'Euclidean (straight-line)' },
  { key: 'manhattan', label: 'Manhattan (grid)' },
  { key: 'road',      label: 'Road (×1.35 factor)' },
];

export function OptimizationWorkspace() {
  const { nb, wh, loaded, loading: storeLoading } = useStore();
  const [algo, setAlgo] = useState<AlgoKey>('exact');
  const [dist, setDist] = useState<string>('euclidean');
  const [radius, setRadius] = useState<number>(60);
  const [costPerKm, setCostPerKm] = useState<number>(2);
  const [capacity, setCapacity] = useState<number>(() => wh[0]?.capacity || 800);
  const [fixedCost, setFixedCost] = useState<number>(1500);
  const [minW, setMinW] = useState<number>(1);
  const [maxW, setMaxW] = useState<number>(5);
  const [ran, setRan] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<OptResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapSelection, setMapSelection] = useState<{ kind: 'demand' | 'warehouse'; id: string; label: string; detail: string } | null>(null);

  const run = useCallback(async () => {
    if (!loaded || !nb.length) return;
    setRunning(true); setErr(null); setRan(false);
    try {
      const out = await api.optimize({
        neighborhoods: nb,
        candidates: wh,
        params: {
          algorithm: algo,
          distanceMetric: dist,
          maxServiceRadius: radius,
          deliveryCostPerKm: costPerKm,
          capacity,
          fixedCost,
          minWarehouses: minW,
          maxWarehouses: maxW,
        },
        explain: true,
      });
      setResult(out); setRan(true);
      if (out.optimal === false && !out.algorithmUsed.includes('exact')) {
        // best effort
      }
    } catch (e: any) {
      setErr(e.message || 'Optimization failed');
    } finally { setRunning(false); }
  }, [loaded, nb, wh, algo, dist, radius, costPerKm, capacity, fixedCost, minW, maxW]);

  if (!loaded) return (
    <div className="h-full flex items-center justify-center bg-[#0a0a0f] text-[#6b6b80] text-xs">
      <Loader2 className="animate-spin mr-2" size={14} />Loading dataset...
    </div>
  );

  if (err) return (
    <div className="h-full flex items-center justify-center bg-[#0a0a0f]">
      <Card className="max-w-md"><CardBody>
        <div className="flex items-center gap-2 text-amber-400 text-xs mb-3"><AlertTriangle size={14}/>{err}</div>
        <Button variant="primary" size="sm" onClick={run}>Try again</Button>
      </CardBody></Card>
    </div>
  );

  const whList = result?.utilization?.map(u => {
    const w = wh.find(x => x.id === u.id);
    return { ...u, name: w?.name || u.id, fixedCost: w?.fixedCost ?? 0, capacity: w?.capacity ?? 0 };
  }) || [];

  return (
    <div className="h-full min-h-0 flex">
      {/* Left: controls + map */}
      <div className="flex-1 min-h-0 overflow-y-auto border-r border-[#1e1e2e] min-w-0">
        {/* Params bar */}
        <div className="p-3 border-b border-[#1e1e2e] bg-[#0d0d16] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-white">Plan your warehouse network</h1>
              <p className="text-xs text-[#8080a0] mt-0.5">Choose limits, then run the optimizer to find the lowest-cost plan.</p>
            </div>
            <details className="group relative shrink-0">
              <summary className="list-none cursor-pointer rounded-md border border-[#2a2a3a] px-3 py-2 text-xs text-blue-300 hover:bg-blue-500/10">What do these settings mean?</summary>
              <div className="absolute right-0 top-10 z-20 w-80 rounded-lg border border-[#2a2a3a] bg-[#111118] p-3 text-xs leading-relaxed text-[#c0c0d0] shadow-xl">
                <strong className="text-white">Min / Max warehouses</strong> sets the allowed number of warehouses to open. <strong className="text-white">Service radius</strong> is the farthest distance a warehouse can serve. <strong className="text-white">Capacity</strong> is the maximum demand each warehouse can handle. Start with Min 1 and Max 5, then compare results.
              </div>
            </details>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] font-mono text-[#4a4a60] block mb-1">Algorithm</label>
              <div className="relative">
                <select value={algo} onChange={e => setAlgo(e.target.value as AlgoKey)}
                  className="w-full appearance-none px-2 py-1.5 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-[#c0c0d0] focus:border-blue-500/40">
                  {ALGORITHMS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#3a3a50]" />
              </div>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] font-mono text-[#4a4a60] block mb-1">Distance</label>
              <div className="relative">
                <select value={dist} onChange={e => setDist(e.target.value)}
                  className="w-full appearance-none px-2 py-1.5 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-[#c0c0d0] focus:border-blue-500/40">
                  {DIST_METRICS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#3a3a50]" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-mono text-[#8080a0] block mb-1">Service radius (km)</label>
              <input type="number" value={radius} onChange={e => setRadius(+e.target.value)}
                className="w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-white font-mono focus:border-blue-500/40" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#8080a0] block mb-1">Delivery cost ($/km)</label>
              <input type="number" step="0.1" value={costPerKm} onChange={e => setCostPerKm(+e.target.value)}
                className="w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-white font-mono focus:border-blue-500/40" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#8080a0] block mb-1">Capacity per warehouse</label>
              <input type="number" value={capacity} onChange={e => setCapacity(+e.target.value)}
                className="w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-white font-mono focus:border-blue-500/40" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#8080a0] block mb-1">Fixed cost ($)</label>
              <input type="number" value={fixedCost} onChange={e => setFixedCost(+e.target.value)}
                className="w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-white font-mono focus:border-blue-500/40" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#8080a0] block mb-1">Minimum warehouses</label>
              <input type="number" min={1} max={maxW} value={minW} onChange={e => setMinW(Math.min(+e.target.value, maxW))}
                className="w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-white font-mono focus:border-blue-500/40" />
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#8080a0] block mb-1">Maximum warehouses</label>
              <input type="number" min={minW} max={wh.length} value={maxW} onChange={e => setMaxW(Math.max(minW, Math.min(+e.target.value, wh.length)))}
                className="w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-white font-mono focus:border-blue-500/40" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" loading={running} onClick={run} className="flex-1">
              <Play size={13} />{running ? 'Optimizing...' : 'Run Optimization'}
            </Button>
            {ran && <Button variant="ghost" size="sm" onClick={() => { setRan(false); setResult(null); }}><X size={13}/>Clear</Button>}
          </div>
        </div>

        {/* Map */}
        <div className="h-[560px] p-3">
          <div className="relative w-full h-full rounded-lg overflow-hidden border border-[#1e1e2e] bg-[#0a0f1a]">
            <WloMapSVG neighborhoods={nb} warehouses={wh} result={result} zoom={mapZoom} onSelect={setMapSelection} />
            <div className="absolute top-3 right-3 z-10 flex gap-1">
              <button onClick={() => setMapZoom(z => Math.min(2.2, +(z + 0.2).toFixed(1)))} className="h-8 w-8 rounded border border-[#2a2a3a] bg-[#111118] text-white hover:bg-[#1a1a24]" title="Zoom in">+</button>
              <button onClick={() => setMapZoom(z => Math.max(1, +(z - 0.2).toFixed(1)))} className="h-8 w-8 rounded border border-[#2a2a3a] bg-[#111118] text-white hover:bg-[#1a1a24]" title="Zoom out">−</button>
              <button onClick={() => { setMapZoom(1); setMapSelection(null); }} className="rounded border border-[#2a2a3a] bg-[#111118] px-2 text-xs text-[#c0c0d0] hover:bg-[#1a1a24]">Reset</button>
            </div>
            {/* status pill */}
            <div className="absolute top-3 left-3 z-10">
              {ran && result ? (
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono border flex items-center gap-1.5 ${
                  result.optimal ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                  <CheckCircle2 size={10} />{result.optimal ? 'Optimal · MILP' : 'Heuristic · ' + result.algorithmUsed}
                </div>
              ) : <div className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-[#111118] border border-[#1e1e2e] text-[#4a4a60]">Config & run</div>}
            </div>
            {result?.unserved && result.unserved.length > 0 && (
              <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-mono flex items-center gap-1">
                <AlertTriangle size={10} />{result.unserved.length} unserved
              </div>
            )}
            <div className="absolute bottom-3 left-3 z-10 rounded-md border border-[#2a2a3a] bg-[#111118]/95 px-3 py-2 text-[10px] text-[#c0c0d0] shadow-lg">
              <div className="mb-1 font-semibold text-white">Map guide</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1"><span>● Blue circles: demand areas</span><span>▣ Warehouse</span><span>◌ Dashed ring: service radius</span><span className="text-red-400">● Red: unserved</span></div>
            </div>
            {mapSelection && <div className="absolute bottom-3 right-3 z-10 max-w-xs rounded-md border border-blue-500/30 bg-[#111118]/95 px-3 py-2 shadow-lg">
              <div className="text-xs font-semibold text-white">{mapSelection.label}</div>
              <div className="mt-1 text-[11px] text-[#c0c0d0]">{mapSelection.detail}</div>
            </div>}
          </div>
        </div>

        {/* bottom info: assignments */}
        {ran && result && (
          <div className="p-2 border-t border-[#1e1e2e] bg-[#0d0d16] text-[10px] font-mono text-[#4a4a60] flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(result.assignments).slice(0, 40).map(([nid, wid]) => {
              const n = nb.find(x => x.id === nid); const w = wh.find(x => x.id === wid);
              return n && w ? <span key={nid}><span className="text-[#3a3a50]">{n.name}</span>→<span className="text-blue-400">{w.name}</span></span> : null;
            })}
          </div>
        )}
      </div>

      {/* Right: results */}
      <div className="w-72 border-l border-[#1e1e2e] overflow-y-auto bg-[#0d0d16] p-3 space-y-3">
        <div className="text-[10px] font-mono text-[#3a3a50] uppercase tracking-widest">Results</div>

        {!ran && !running && (
          <div className="text-center py-10">
            <Play size={24} className="mx-auto text-[#2a2a3a] mb-3" />
            <div className="text-xs text-[#3a3a50]">Configure and run<br />optimization</div>
          </div>
        )}

        {running && (
          <div className="text-center py-10">
            <Loader2 className="animate-spin mx-auto mb-3 text-blue-400" size={20} />
            <div className="text-xs text-blue-400 font-mono">Running {ALGORITHMS.find(a => a.key === algo)?.label}...</div>
          </div>
        )}

        {ran && result && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 py-1.5 px-2.5 rounded bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">{result.optimal ? 'Optimal (proven)' : 'Heuristic'}</span>
            </div>

            <div className="space-y-1.5">
              {[
                { label: 'Total Cost', value: fmtCurrency(result.totalCost), highlight: true },
                { label: 'Delivery Cost', value: fmtCurrency(result.deliveryCost) },
                { label: 'Fixed Cost', value: fmtCurrency(result.fixedCost) },
                { label: 'Avg Distance', value: `${result.avgDistance.toFixed(2)} km` },
                { label: 'Warehouses', value: String(result.openWarehouses.length) },
                { label: 'Violations', value: String(result.unserved?.length || 0), warn: !!(result.unserved?.length) },
              ].map((row, i) => (
                <div key={i} className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${
                  row.highlight ? 'bg-[#111118] border border-[#2a2a3a]' : ''
                }`}>
                  <span className="text-[#5a5a70]">{row.label}</span>
                  <span className={`font-mono font-medium ${row.highlight ? 'text-white' : row.warn ? 'text-amber-400' : 'text-[#c0c0d0]'}`}>{row.value}</span>
                </div>
              ))}
              {result.savingsPct != null && (
                <div className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-emerald-500/8 border border-emerald-500/20">
                  <span className="text-emerald-400">Savings vs 1 wh</span>
                  <span className="font-mono font-medium text-emerald-400">{result.savingsPct > 0 ? '+' : ''}{result.savingsPct.toFixed(1)}%</span>
                </div>
              )}
            </div>

            <div className="text-[10px] font-mono text-[#3a3a50] uppercase tracking-widest mt-2 mb-1">Warehouses</div>
            {whList.map((w, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#1a1a24] last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  w.u > 0.9 ? 'bg-amber-400' : w.u > 0.75 ? 'bg-blue-400' : 'bg-emerald-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[#8080a0] truncate">{w.id} {w.name}</div>
                  <div className="h-1 bg-[#1a1a24] rounded-full mt-0.5">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${w.u * 100}%` }} />
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[#5a5a70] flex-shrink-0">{fmtPct(w.u)}</span>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full">
              <Info size={12} />Export
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- SVG map (lightweight, deterministic, no external tile deps) ----------
function WloMapSVG({ neighborhoods, warehouses, result, zoom, onSelect }: {
  neighborhoods: (Point & { demand: number })[];
  warehouses: Candidate[];
  result?: OptResult | null;
  zoom: number;
  onSelect: (item: { kind: 'demand' | 'warehouse'; id: string; label: string; detail: string }) => void;
}) {
  const minX = Math.min(...neighborhoods.map(n => n.x), ...warehouses.map(w => w.x)) - 5;
  const maxX = Math.max(...neighborhoods.map(n => n.x), ...warehouses.map(w => w.x)) + 5;
  const minY = Math.min(...neighborhoods.map(n => n.y), ...warehouses.map(w => w.y)) - 5;
  const maxY = Math.max(...neighborhoods.map(n => n.y), ...warehouses.map(w => w.y)) + 5;
  const W = 640, H = 420;
  const toX = (x: number) => ((x - minX) / (maxX - minX)) * W;
  const toY = (y: number) => ((y - minY) / (maxY - minY)) * H;
  const openIds = new Set(result?.openWarehouses || []);
  const assigned = result?.assignments || {};
  const maxDemand = Math.max(...neighborhoods.map(n => n.demand), 1);

  return (
    <svg viewBox={`${(W - W / zoom) / 2} ${(H - H / zoom) / 2} ${W / zoom} ${H / zoom}`} className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {Array.from({ length: 13 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 35} x2={W} y2={i * 35} stroke="#1a1a2e" strokeWidth="1" />
      ))}
      {Array.from({ length: 19 }, (_, i) => (
        <line key={`v${i}`} x1={i * 35} y1="0" x2={i * 35} y2={H} stroke="#1a1a2e" strokeWidth="1" />
      ))}

      {/* assignment lines */}
      {Object.entries(assigned).map(([nid, wid]) => {
        const n = neighborhoods.find(x => x.id === nid);
        const w = warehouses.find(x => x.id === wid);
        if (!n || !w || !openIds.has(wid)) return null;
        return (
          <line key={nid} x1={toX(n.x)} y1={toY(n.y)} x2={toX(w.x)} y2={toY(w.y)}
            stroke="#3b82f6" strokeWidth="0.5" strokeOpacity="0.15" />
        );
      })}

      {/* service radius */}
      {warehouses.filter(w => openIds.has(w.id)).map(w => (
        <circle key={w.id} cx={toX(w.x)} cy={toY(w.y)} r={60}
          fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.2" />
      ))}

      {/* neighborhoods */}
      {neighborhoods.map(n => {
        const r = 3 + (n.demand / maxDemand) * 7;
        const isUnserved = result?.unserved?.includes(n.id);
        return (
          <g key={n.id} className="cursor-pointer" onClick={() => onSelect({ kind: 'demand', id: n.id, label: n.id, detail: `Demand ${n.demand} units${isUnserved ? ' · currently unserved' : ' · assigned to the lowest-cost feasible warehouse'}`)}>
            <title>{`${n.id}: demand ${n.demand}${isUnserved ? ' (unserved)' : ''}`}</title>
            <circle cx={toX(n.x)} cy={toY(n.y)} r={r + 4} fill="#3b82f6" fillOpacity="0.05" />
            <circle cx={toX(n.x)} cy={toY(n.y)} r={r}
              fill={isUnserved ? '#ef4444' : '#1e3a5f'}
              stroke={isUnserved ? '#ef4444' : '#3b82f6'}
              strokeWidth={isUnserved ? 1.5 : 1}
            />
          </g>
        );
      })}

      {/* warehouses */}
      {warehouses.map(w => {
        const isOpen = openIds.has(w.id);
        const u = result?.utilization?.find(x => x.id === w.id);
        return (
          <g key={w.id} className="cursor-pointer" onClick={() => onSelect({ kind: 'warehouse', id: w.id, label: w.name || w.id, detail: `${isOpen ? 'Open' : 'Candidate'} warehouse · capacity ${w.capacity}${u ? ` · ${Math.round(u.u * 100)}% utilized` : ''}`)}>
            <title>{`${w.name || w.id}: ${isOpen ? 'open' : 'candidate'}, capacity ${w.capacity}`}</title>
            <circle cx={toX(w.x)} cy={toY(w.y)} r={isOpen ? 14 : 10}
              fill={isOpen ? '#3b82f6' : '#1e1e2e'}
              fillOpacity={isOpen ? 0.15 : 0.5}
              stroke={isOpen ? '#60a5fa' : '#3a3a50'}
              strokeWidth={isOpen ? 2 : 1} />
            <rect x={toX(w.x) - 6} y={toY(w.y) - 4} width={12} height={8} rx={1}
              fill={isOpen ? '#3b82f6' : '#3a3a50'} />
            {isOpen && u && (
              <text x={toX(w.x)} y={toY(w.y) - 10} textAnchor="middle"
                fontSize="8" fill="#60a5fa" fontFamily="monospace">
                {Math.round(u.u * 100)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
