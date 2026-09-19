// Shared optimizer parameter bar used by Workspace + Map pages.
import type { Params } from '@/lib/api';

export function ParamsBar({ p, set }: { p: Params; set: (p: Params) => void }) {
  const num = (k: keyof Params) => ({
    value: p[k] as number, type: 'number' as const,
    onChange: (e: any) => set({ ...p, [k]: +e.target.value }),
    className: 'w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-[#c0c0d0] font-mono',
  });
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
      <label className="text-[10px] text-[#5a5a70]">Min WH<input {...num('minWarehouses')} /></label>
      <label className="text-[10px] text-[#5a5a70]">Max WH<input {...num('maxWarehouses')} /></label>
      <label className="text-[10px] text-[#5a5a70]">$/km<input {...num('deliveryCostPerKm')} step={0.1 as any} /></label>
      <label className="text-[10px] text-[#5a5a70]">Radius<input {...num('maxServiceRadius')} /></label>
      <label className="text-[10px] text-[#5a5a70]">Road ×<input {...num('roadFactor')} step={0.05 as any} /></label>
      <label className="text-[10px] text-[#5a5a70]">Seed<input {...num('randomSeed')} /></label>
      <label className="text-[10px] text-[#5a5a70]">Metric
        <select value={p.distanceMetric} onChange={e => set({ ...p, distanceMetric: e.target.value as any })} className="w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-[#c0c0d0]">
          <option>euclidean</option><option>manhattan</option><option>road</option>
        </select></label>
      <label className="text-[10px] text-[#5a5a70]">Algorithm
        <select value={p.algorithm} onChange={e => set({ ...p, algorithm: e.target.value as any })} className="w-full px-2 py-1 rounded text-xs bg-[#111118] border border-[#1e1e2e] text-[#c0c0d0]">
          <option>auto</option><option>exact</option><option>greedy</option><option>kmeans</option><option>kmedoids</option><option>localsearch</option><option>annealing</option>
        </select></label>
    </div>
  );
}
