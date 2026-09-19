import { useEffect, useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { fmt } from '@/lib/utils';
import { api, type FulfillWarehouse } from '@/lib/api';
import { Warehouse as WarehouseIcon, Plus, Trash2, Save, RefreshCw, MapPin } from 'lucide-react';

const blank = (): FulfillWarehouse => ({
  id: 'W' + Math.floor(100 + Math.random() * 900),
  name: 'New warehouse', x: 50, y: 50,
  capacity: 600, storageM3: 3, throughputPerHr: 100,
  handlingCostPerUnit: 1.2, fixedOperatingCost: 600,
  open: true, waves: [8, 12, 16, 20], vehicles: [],
});

/** Warehouse registry: every site lives in the DB (Supabase wlo_warehouses
 *  when configured, else backend/data/warehouses.json). */
export function Warehouses() {
  const [rows, setRows] = useState<FulfillWarehouse[]>([]);
  const [via, setVia] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await api.warehouses();
      setRows(r.warehouses); setVia(r.via); setUpdatedAt(r.updatedAt ?? null);
    } catch (e: any) { setErr(e.message || 'Failed to load warehouses'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const patch = (id: string, p: Partial<FulfillWarehouse>) =>
    setRows(prev => prev.map(w => w.id === id ? { ...w, ...p } : w));

  const save = async () => {
    setSaving(true); setErr(null); setMsg(null);
    try {
      const r = await api.saveWarehouses({ warehouses: rows });
      setRows(r.warehouses); setVia(r.via);
      setMsg('Saved ' + r.count + ' via ' + r.via);
    } catch (e: any) { setErr(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };
  const num = (v: string, fb: number) => { const n = parseFloat(v); return isFinite(n) ? n : fb; };

  return (
    <div className="p-4 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            <WarehouseIcon size={15} className="text-emerald-400" />Warehouses
          </h1>
          <p className="text-[11px] text-[#4a4a60]">
            Stored in DB{via ? <> · <span className="font-mono text-[#8080a0]">via {via}</span></> : null}
            {updatedAt ? <> · <span className="font-mono text-[#8080a0]">{new Date(updatedAt).toLocaleString()}</span></> : null}
            {' '}· changes apply to fulfillment on next run
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw size={12} />Reload
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRows(prev => [...prev, blank()])}>
            <Plus size={12} />Add
          </Button>
          <Button size="sm" variant="primary" onClick={save} loading={saving}>
            <Save size={12} />Save all
          </Button>
        </div>
      </div>

      {err && <Card><CardBody className="text-xs text-red-400">{err}</CardBody></Card>}
      {msg && <Card><CardBody className="text-xs text-emerald-400">{msg}</CardBody></Card>}

      {loading ? (
        <Card><CardBody className="text-xs text-[#6b6b80]">Loading warehouses…</CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rows.map(w => (
            <Card key={w.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <input value={w.name || w.id} onChange={e => patch(w.id, { name: e.target.value })}
                    className="bg-transparent text-sm font-medium text-white focus:outline-none w-48 border-b border-transparent focus:border-blue-500/40" />
                  <div className="flex items-center gap-1.5">
                    <Badge variant={w.open === false ? 'muted' : 'success'}>{w.open === false ? 'closed' : 'open'}</Badge>
                    <button onClick={() => patch(w.id, { open: !(w.open !== false) })}
                      className="text-[10px] font-mono text-[#8080a0] hover:text-white border border-[#1e1e2e] rounded px-1.5 py-0.5">
                      {w.open === false ? 'open' : 'close'}
                    </button>
                    <button onClick={() => setRows(prev => prev.filter(x => x.id !== w.id))}
                      className="text-[#4a4a60] hover:text-red-400 p-1"><Trash2 size={13} /></button>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-[#4a4a60] mt-0.5">{w.id}</div>
              </CardHeader>
              <CardBody className="grid grid-cols-3 gap-2 text-[11px]">
                <label className="space-y-1">
                  <span className="text-[10px] font-mono text-[#4a4a60] flex items-center gap-1"><MapPin size={10} />x (east km)</span>
                  <input type="number" value={w.x} onChange={e => patch(w.id, { x: num(e.target.value, w.x) })}
                    className="w-full bg-[#111118] border border-[#1e1e2e] rounded px-2 py-1 text-white font-mono" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-mono text-[#4a4a60]">y (north km)</span>
                  <input type="number" value={w.y} onChange={e => patch(w.id, { y: num(e.target.value, w.y) })}
                    className="w-full bg-[#111118] border border-[#1e1e2e] rounded px-2 py-1 text-white font-mono" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-mono text-[#4a4a60]">capacity (units)</span>
                  <input type="number" value={w.capacity ?? 500} onChange={e => patch(w.id, { capacity: num(e.target.value, 500) })}
                    className="w-full bg-[#111118] border border-[#1e1e2e] rounded px-2 py-1 text-white font-mono" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-mono text-[#4a4a60]">throughput/hr</span>
                  <input type="number" value={w.throughputPerHr ?? 100} onChange={e => patch(w.id, { throughputPerHr: num(e.target.value, 100) })}
                    className="w-full bg-[#111118] border border-[#1e1e2e] rounded px-2 py-1 text-white font-mono" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-mono text-[#4a4a60]">storage m³</span>
                  <input type="number" value={w.storageM3 ?? 3} onChange={e => patch(w.id, { storageM3: num(e.target.value, 3) })}
                    className="w-full bg-[#111118] border border-[#1e1e2e] rounded px-2 py-1 text-white font-mono" />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-mono text-[#4a4a60]">waves (csv hrs)</span>
                  <input value={(w.waves || []).join(',')} onChange={e => patch(w.id, { waves: e.target.value.split(',').map(s => num(s.trim(), 0)).filter(n => n > 0) })}
                    className="w-full bg-[#111118] border border-[#1e1e2e] rounded px-2 py-1 text-white font-mono" />
                </label>
                <div className="col-span-3 text-[10px] font-mono text-[#3a3a50]">
                  cap {fmt(w.capacity ?? 0)} · {fmt(w.throughputPerHr ?? 0)}/hr · waves {(w.waves || []).join(', ')}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
