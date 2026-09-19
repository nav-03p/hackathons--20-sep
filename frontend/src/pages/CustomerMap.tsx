import { cn, fmt } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import { hLabel } from './Fulfillment';
import type { Assignment, FulfillDemo, FulfillOrderRow, FulfillPlan } from '@/lib/api';

const capOf = (w: FulfillDemo['warehouses'][number]) => {
  const t = w.throughputPerHr ?? w.capacity ?? 0;
  return fmt(t >= 1e9 ? (w.capacity ?? 0) : t);
};

type Dock = { w: FulfillDemo['warehouses'][number]; a: Assignment | undefined; km: number; eta: number; optimal: boolean };

function dockList(plan: FulfillPlan, demo: FulfillDemo, order: FulfillOrderRow, assignments: Assignment[]): Dock[] {
  const roadKm = (wx: number, wy: number) =>
    Math.hypot(order.x - wx, order.y - wy) * (plan.params.roadFactor ?? 1.35);
  const roadHr = (km: number) => (plan.params.kmPerHour ? km / plan.params.kmPerHour : 0);
  return demo.warehouses.map(w => {
    const a = assignments.find(x => x.warehouseId === w.id);
    const km = a ? a.distKm : roadKm(w.x, w.y);
    const eta = a ? a.etaHr : roadHr(km);
    return { w, a, km, eta, optimal: !!a && a === assignments[0] };
  }).sort((p, q) => p.km - q.km);
}

/** Customer-centred map: ONE customer, lanes from EVERY warehouse.
 *  Each lane + warehouse is tagged with km, travel time, capacity and
 *  expected delivery (ETA) so you can read the optimal dock at a glance. */
export function CustomerMap({ plan, demo, order, assignments, areaOf, onClear }: {
  plan: FulfillPlan; demo: FulfillDemo; order: FulfillOrderRow;
  assignments: Assignment[]; areaOf: (n: string) => string; onClear: () => void;
}) {
  const pts = [{ x: order.x, y: order.y },
    ...assignments.map(a => {
      const w = demo.warehouses.find(x => x.id === a.warehouseId);
      return w ? { x: w.x, y: w.y } : null;
    }).filter(Boolean) as { x: number; y: number }[]];
  const lo = { x: Math.min(...pts.map(p => p.x)) - 8, y: Math.min(...pts.map(p => p.y)) - 8 };
  const hi = { x: Math.max(...pts.map(p => p.x)) + 8, y: Math.max(...pts.map(p => p.y)) + 8 };
  const spanX = Math.max(12, hi.x - lo.x), spanY = Math.max(12, hi.y - lo.y);
  const X = (x: number) => 6 + ((x - lo.x) / spanX) * 88;
  const Y = (y: number) => 100 - (6 + ((y - lo.y) / spanY) * 88);
  const addr = areaOf(order.customerName) + ' \u00b7 blk ' + (1 + Math.floor(order.x % 9)) +
    ', st ' + (1 + Math.floor(order.y % 12)) + ' \u2014 grid ' +
    order.x.toFixed(1) + 'E / ' + order.y.toFixed(1) + 'N';
  const docks = dockList(plan, demo, order, assignments);
  return (
    <>
      <div className="mb-3 flex items-start gap-2 rounded-md border border-blue-500/25 bg-blue-500/5 px-3 py-2">
        <MapPin size={13} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs text-white font-medium truncate">
            {order.customerName} <span className="text-[#4a4a60] font-mono">\u00b7 {order.customerId} \u00b7 {order.orderId}</span>
          </div>
          <div className="text-[11px] text-[#8080a0] truncate">
            User address: {addr} \u00b7 due {hLabel(order.dueHr)} \u00b7 {order.priority}
          </div>
        </div>
        <button onClick={onClear}
          className="text-[10px] font-mono text-[#8080a0] hover:text-white border border-[#1e1e2e] rounded px-1.5 py-0.5 flex-shrink-0">
          show all \u2715
        </button>
      </div>
      <svg viewBox="0 0 100 100" className="w-full h-[420px]">
        {[20, 40, 60, 80].map(v => (
          <g key={'g' + v}>
            <line x1={v} y1={6} x2={v} y2={94} stroke="#16161f" strokeWidth={0.2} />
            <line x1={6} y1={v} x2={94} y2={v} stroke="#16161f" strokeWidth={0.2} />
          </g>
        ))}
        {docks.map(({ w, a, km, eta, optimal }) => {
          const bad = a && (a.atRisk || a.lateHr > 0 || a.split);
          const mx = (X(w.x) + X(order.x)) / 2, my = (Y(w.y) + Y(order.y)) / 2;
          return (
            <g key={'lane' + w.id}>
              <line x1={X(w.x)} y1={Y(w.y)} x2={X(order.x)} y2={Y(order.y)}
                stroke={optimal ? '#22c55e' : bad ? '#ef4444' : '#3b82f6'}
                strokeWidth={optimal ? 0.9 : 0.45}
                opacity={optimal ? 1 : 0.55}
                strokeDasharray={optimal ? '' : '2 1.2'}
                strokeLinecap="round" />
              <rect x={mx - 11} y={my - 3.4} width={22} height={6.4} rx={1.2}
                fill="#0d0d16" stroke={optimal ? '#22c55e55' : '#2a2a3a'} strokeWidth={0.3} />
              <text x={mx} y={my + 0.4} textAnchor="middle" fontSize={2.5}
                fill={optimal ? '#4ade80' : '#c0c0d0'} fontFamily="monospace"
                fontWeight={optimal ? 'bold' : 'normal'}>
                {km.toFixed(1)}km \u00b7 {hLabel(eta)}
              </text>
            </g>
          );
        })}
        <g>
          <circle cx={X(order.x)} cy={Y(order.y)} r={2.6} fill="#3b82f6" fillOpacity={0.15} />
          <circle cx={X(order.x)} cy={Y(order.y)} r={1.4} stroke="#ffffff" strokeWidth={0.7} fill="#60a5fa" />
          <text x={X(order.x)} y={Y(order.y) - 3.4} textAnchor="middle" fontSize={2.8}
            fill="#ffffff" fontFamily="monospace" fontWeight="bold">
            {order.customerName}
          </text>
        </g>
        {demo.warehouses.map(w => {
          const lane = docks.find(d => d.w.id === w.id);
          return (
            <g key={w.id}>
              <rect x={X(w.x) - 2.4} y={Y(w.y) - 2.4} width={4.8} height={4.8} rx={0.8}
                fill="#22c55e" fillOpacity={lane && !lane.optimal ? 0.45 : 1}
                stroke={lane?.optimal ? '#ffffff' : 'none'} strokeWidth={lane?.optimal ? 0.6 : 0} />
              <text x={X(w.x) + 3.4} y={Y(w.y) - 0.6} fontSize={2.5}
                fill={lane?.optimal ? '#4ade80' : '#8080a0'} fontFamily="monospace"
                fontWeight={lane?.optimal ? 'bold' : 'normal'}>
                {lane?.optimal ? '\u25b8 ' : ''}{(w.name || w.id).split(' ')[0]}
                {lane ? ' \u00b7 ' + lane.km.toFixed(0) + 'km' : ''}
              </text>
              <text x={X(w.x) + 3.4} y={Y(w.y) + 2.4} fontSize={2.1} fill="#4a4a60" fontFamily="monospace">
                cap {capOf(w)}
                {lane ? ' \u00b7 ETA ' + hLabel(lane.eta) + (lane.optimal ? ' \u2605' : '') : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

export function DockTable({ plan, demo, order, assignments }: {
  plan: FulfillPlan; demo: FulfillDemo; order: FulfillOrderRow; assignments: Assignment[];
}) {
  const roadHr = (km: number) => (plan.params.kmPerHour ? km / plan.params.kmPerHour : 0);
  const docks = dockList(plan, demo, order, assignments);
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-[#1e1e2e]">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[10px] font-mono uppercase text-[#3a3a50] border-b border-[#1e1e2e] bg-[#0d0d16]">
            <th className="text-left px-3 py-1.5 font-medium">Warehouse \u2192 user</th>
            <th className="text-right px-2 py-1.5 font-medium">Capacity</th>
            <th className="text-right px-2 py-1.5 font-medium">Km</th>
            <th className="text-right px-2 py-1.5 font-medium">Travel time</th>
            <th className="text-right px-2 py-1.5 font-medium">Expected delivery</th>
            <th className="text-left px-3 py-1.5 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {docks.map(({ w, a, km, eta, optimal }) => (
            <tr key={w.id} className={cn('border-t border-[#1e1e2e]/60', optimal && 'bg-emerald-500/5')}>
              <td className="px-3 py-1.5 font-mono text-[#c0c0d0]">
                {optimal ? '\u25b8 ' : ''}{w.id} <span className="text-[#4a4a60]">\u2192 {order.customerName}</span>
                {optimal && <span className="ml-1 text-[9px] text-emerald-400 border border-emerald-500/30 rounded px-1">OPTIMAL</span>}
              </td>
              <td className="px-2 py-1.5 text-right font-mono text-[#8080a0]">{capOf(w)}</td>
              <td className="px-2 py-1.5 text-right font-mono text-[#c0c0d0]">{km.toFixed(1)} km</td>
              <td className="px-2 py-1.5 text-right font-mono text-[#8080a0]">{hLabel(roadHr(km))}</td>
              <td className={cn('px-2 py-1.5 text-right font-mono', a && a.lateHr > 0 ? 'text-red-400' : 'text-emerald-400')}>
                ETA {hLabel(eta)}{a ? ' \u00b7 depart ' + hLabel(a.departHr) : ''}
              </td>
              <td className="px-3 py-1.5 text-[#6b6b80]">
                {a ? (a.lateHr > 0 ? 'late +' + a.lateHr.toFixed(1) + 'h'
                  : a.wavePolicy.replace(/-/g, ' ') + (a.tripId ? ' \u00b7 ' + a.tripId : ''))
                  : 'no stock for this order'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
