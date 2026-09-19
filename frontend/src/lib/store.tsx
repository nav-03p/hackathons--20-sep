import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Point, Candidate } from './api';
import { api } from './api';

type NB = Point & { demand: number; name: string };
type WH = Candidate & { name: string };

export const DEFAULT_BENGALURU_NB: NB[] = [
  { id: 'N01', name: 'Gandhi Bazaar', x: 12.934, y: 77.571, demand: 420 },
  { id: 'N02', name: 'DVG Road', x: 12.938, y: 77.569, demand: 310 },
  { id: 'N03', name: 'Bull Temple Road', x: 12.941, y: 77.568, demand: 380 },
  { id: 'N04', name: 'Tagore Park', x: 12.945, y: 77.572, demand: 190 },
  { id: 'N05', name: 'Sajjan Rao Circle', x: 12.948, y: 77.575, demand: 260 },
  { id: 'N06', name: 'NR Colony', x: 12.936, y: 77.563, demand: 230 },
  { id: 'N07', name: 'Hanumanthanagar', x: 12.939, y: 77.558, demand: 175 },
  { id: 'N08', name: 'VV Puram', x: 12.951, y: 77.578, demand: 345 },
  { id: 'N09', name: '4th Block Jayanagar', x: 12.925, y: 77.583, demand: 500 },
  { id: 'N10', name: '7th Block Jayanagar', x: 12.928, y: 77.578, demand: 440 },
  { id: 'N11', name: '9th Block Jayanagar', x: 12.921, y: 77.592, demand: 390 },
  { id: 'N12', name: 'RV Road', x: 12.931, y: 77.579, demand: 280 },
  { id: 'N13', name: '11th Main Jayanagar', x: 12.926, y: 77.588, demand: 320 },
  { id: 'N14', name: 'Tilak Nagar', x: 12.922, y: 77.599, demand: 210 },
  { id: 'N15', name: 'Jayanagar East', x: 12.918, y: 77.596, demand: 185 },
  { id: 'N16', name: '3rd Block Jayanagar', x: 12.932, y: 77.585, demand: 295 },
];

export const DEFAULT_BENGALURU_WH: WH[] = [
  { id: 'W1', name: 'Basavanagudi Hub', x: 12.942, y: 77.570, fixedCost: 1500, capacity: 900 },
  { id: 'W2', name: 'Jayanagar Dock', x: 12.924, y: 77.585, fixedCost: 1500, capacity: 1100 },
  { id: 'W3', name: 'Gandhi Bazaar Depot', x: 12.935, y: 77.573, fixedCost: 1400, capacity: 700 },
  { id: 'W4', name: 'DVG Road Point', x: 12.939, y: 77.566, fixedCost: 1300, capacity: 650 },
  { id: 'W5', name: 'South Bangalore DC', x: 12.930, y: 77.580, fixedCost: 1800, capacity: 1400 },
  { id: 'W6', name: '9th Block Node', x: 12.920, y: 77.590, fixedCost: 1400, capacity: 800 },
];

function savedDataset(): { nb: NB[]; wh: WH[] } | null {
  try {
    const value = JSON.parse(localStorage.getItem('wlo_dataset') || 'null');
    return Array.isArray(value?.nb) && Array.isArray(value?.wh) && value.nb.length > 0 ? value : null;
  } catch { return null; }
}

type ColorPrefs = {
  accent: string;
  warehouse: string;
  neighborhood: string;
  openWarehouse: string;
  unserved: string;
  gridLine: string;
  mapTile: 'dark' | 'light' | 'satellite' | 'outdoor';
};

type Ctx = {
  nb: NB[]; wh: WH[]; loaded: boolean; loading: boolean;
  token: string | null; companyId: string | null; companyName: string | null;
  prefs: ColorPrefs;
  loadDemo: () => Promise<void>;
  loadBengaluru: () => Promise<void>;
  loadSynthetic: (size?: number, seed?: number, authToken?: string, warehouseCapacity?: number) => Promise<void>;
  setData: (nb: NB[], wh: WH[]) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, companyName: string) => Promise<void>;
  logout: () => void;
  setPrefs: (p: Partial<ColorPrefs>) => void;
  addNeighborhood: (n: Omit<NB, 'id'>) => void;
  updateNeighborhood: (id: string, patch: Partial<NB>) => void;
  removeNeighborhood: (id: string) => void;
  addWarehouse: (w: Omit<WH, 'id'>) => void;
  updateWarehouse: (id: string, patch: Partial<WH>) => void;
  removeWarehouse: (id: string) => void;
};

const DEFAULT_PREFS: ColorPrefs = {
  accent: '#3b82f6',
  warehouse: '#22c55e',
  neighborhood: '#1e3a5f',
  openWarehouse: '#22c55e',
  unserved: '#ef4444',
  gridLine: '#1a1a2e',
  mapTile: 'dark',
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [nb, setNb] = useState<NB[]>(() => savedDataset()?.nb || DEFAULT_BENGALURU_NB);
  const [wh, setWh] = useState<WH[]>(() => savedDataset()?.wh || DEFAULT_BENGALURU_WH);
  const [loaded, setLoaded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('wlo_token'));
  const [companyId, setCompanyId] = useState<string | null>(() => localStorage.getItem('wlo_company'));
  const [companyName, setCompanyName] = useState<string | null>(() => localStorage.getItem('wlo_companyName'));
  const [prefs, setPrefs] = useState<ColorPrefs>(() => {
    try { return Object.assign({}, DEFAULT_PREFS, JSON.parse(localStorage.getItem('wlo_prefs') || '{}')); }
    catch { return DEFAULT_PREFS; }
  });

  const loadDemo = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.demo();
      setNb(d.neighborhoods.map(n => ({...n, demand: n.demand || 100, name: 'N-' + n.id})));
      setWh(d.candidates.map(w => ({...w, name: 'Dock ' + w.id})));
      setLoaded(true);
    } finally { setLoading(false); }
  }, []);

  const loadBengaluru = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.bengaluru();
      const nextNb = d.neighborhoods.map(n => ({...n, demand: n.demand || 100, name: n.name || n.id}));
      const nextWh = d.candidates.map(w => ({...w, name: w.name || w.id}));
      saveDataset(nextNb, nextWh);
    } finally { setLoading(false); }
  }, [saveDataset]);

  const saveDataset = useCallback((nextNb: NB[], nextWh: WH[]) => {
    setNb(nextNb); setWh(nextWh); setLoaded(true);
    localStorage.setItem('wlo_dataset', JSON.stringify({ nb: nextNb, wh: nextWh }));
  }, []);

  const loadSynthetic = useCallback(async (size = 56, seed = 56, authToken?: string, warehouseCapacity?: number) => {
    setLoading(true);
    try {
      const d = await api.generate({ neighborhoods: size, candidates: Math.max(6, Math.round(size / 10)), seed, mode: 'bengaluru', capacity: warehouseCapacity || Math.max(1100, size * 10), fixedCost: 1500 });
      const nextNb = d.neighborhoods.map(n => ({ ...n, demand: n.demand || 100, name: n.name || `Bengaluru area ${n.id.replace(/^N/, '')}` }));
      const nextWh = d.candidates.map(w => ({ ...w, name: w.name || `Bengaluru warehouse ${w.id.replace(/^W/, '')}` }));
      saveDataset(nextNb, nextWh);
      if (authToken) await api.saveDataset({ neighborhoods: nextNb, candidates: nextWh }, authToken);
    } finally { setLoading(false); }
  }, [saveDataset]);

  const setData = useCallback((n: NB[], w: WH[]) => { saveDataset(n, w); }, [saveDataset]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api.login({ email, password });
    setToken(r.token); setCompanyId(r.user.companyId); setCompanyName(r.user.companyName);
    localStorage.setItem('wlo_token', r.token);
    localStorage.setItem('wlo_company', r.user.companyId);
    localStorage.setItem('wlo_companyName', r.user.companyName);
    await loadSynthetic(r.user.datasetSize || 56, r.user.seed || 56, r.token, r.user.warehouseCapacity);
  }, [loadSynthetic]);

  const signup = useCallback(async (email: string, password: string, companyName: string) => {
    const r = await api.signup({ email, password, companyName });
    setToken(r.token); setCompanyId(r.user.companyId); setCompanyName(r.user.companyName);
    localStorage.setItem('wlo_token', r.token);
    localStorage.setItem('wlo_company', r.user.companyId);
    localStorage.setItem('wlo_companyName', r.user.companyName);
    await loadSynthetic(56, r.user.seed || 56, r.token);
  }, [loadSynthetic]);

  const logout = useCallback(() => {
    setToken(null); setCompanyId(null); setCompanyName(null); setNb([]); setWh([]); setLoaded(false);
    localStorage.removeItem('wlo_token');
    localStorage.removeItem('wlo_company');
    localStorage.removeItem('wlo_companyName');
    localStorage.removeItem('wlo_dataset');
  }, []);

  const setPref = useCallback((p: Partial<ColorPrefs>) => {
    const next = Object.assign({}, prefs, p);
    setPrefs(next);
    localStorage.setItem('wlo_prefs', JSON.stringify(next));
  }, [prefs]);

  const addNeighborhood = useCallback((n: Omit<NB, 'id'>) => {
    const id = 'N-' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    setNb(prev => [...prev, { ...n, id }]);
  }, []);

  const updateNeighborhood = useCallback((id: string, patch: Partial<NB>) => {
    setNb(prev => prev.map(n => n.id === id ? {...n, ...patch} : n));
  }, []);

  const removeNeighborhood = useCallback((id: string) => {
    setNb(prev => prev.filter(n => n.id !== id));
  }, []);

  const addWarehouse = useCallback((w: Omit<WH, 'id'>) => {
    const id = 'W-' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    setWh(prev => [...prev, { ...w, id }]);
  }, []);

  const updateWarehouse = useCallback((id: string, patch: Partial<WH>) => {
    setWh(prev => prev.map(w => w.id === id ? {...w, ...patch} : w));
  }, []);

  const removeWarehouse = useCallback((id: string) => {
    setWh(prev => prev.filter(w => w.id !== id));
  }, []);

  return (
    <StoreCtx.Provider value={{
      nb, wh, loaded, loading, token, companyId, companyName,
      prefs, loadDemo, loadBengaluru, loadSynthetic, setData, login, signup, logout,
      setPrefs: setPref,
      addNeighborhood, updateNeighborhood, removeNeighborhood,
      addWarehouse, updateWarehouse, removeWarehouse,
    }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore(): Ctx {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore outside provider');
  return c;
}
