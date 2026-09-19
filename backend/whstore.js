// whstore.js — persistent warehouse registry (DB-backed, file fallback).
// ---------------------------------------------------------------------------
// Why this exists: the fulfillment demo built warehouses fresh on every
// request, so edits never stuck. This module keeps ONE warehouse list that
// survives restarts and (when Supabase is configured) syncs to the cloud.
//
//   storage order:  Supabase wlo_warehouses  ->  backend/data/warehouses.json
//                   -> seed defaults from fulfill.js whSpec
// Zero npm deps, like the rest of the backend.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'warehouses.json');

function seedWarehouses() {
  return [
    { id: 'W1', name: 'Whitefield DC', x: 12.9750, y: 77.7400, lat: 12.9750, lng: 77.7400, capacity: 900, storageM3: 5, throughputPerHr: 160, handlingCostPerUnit: 1.1, fixedOperatingCost: 900, open: true, waves: [7, 11, 15, 19], vehicles: [{ id: 'W1-V1', capacityUnits: 36, speedKmH: 30, maxStops: 12 }, { id: 'W1-V2', capacityUnits: 20, speedKmH: 30, maxStops: 8 }] },
    { id: 'W2', name: 'Peenya Hub', x: 13.0300, y: 77.5250, lat: 13.0300, lng: 77.5250, capacity: 700, storageM3: 4, throughputPerHr: 120, handlingCostPerUnit: 1.4, fixedOperatingCost: 750, open: true, waves: [8, 12, 16, 20], vehicles: [{ id: 'W2-V1', capacityUnits: 36, speedKmH: 30, maxStops: 12 }] },
    { id: 'W3', name: 'Hosur Road Depot (Electronic City)', x: 12.8452, y: 77.6602, lat: 12.8452, lng: 77.6602, capacity: 600, storageM3: 3, throughputPerHr: 90, handlingCostPerUnit: 1.3, fixedOperatingCost: 620, open: true, waves: [6, 10, 14, 18], vehicles: [{ id: 'W3-V1', capacityUnits: 36, speedKmH: 30, maxStops: 12 }] },
    { id: 'W4', name: 'Hebbal Cross-dock', x: 13.0358, y: 77.5970, lat: 13.0358, lng: 77.5970, capacity: 500, storageM3: 2, throughputPerHr: 80, handlingCostPerUnit: 1.6, fixedOperatingCost: 480, open: true, waves: [9, 13, 17], vehicles: [{ id: 'W4-V1', capacityUnits: 20, speedKmH: 30, maxStops: 8 }] },
  ];
}

function readFile() {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const j = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(j.warehouses) ? j : null;
  } catch { return null; }
}

function writeFile(doc) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(Object.assign({ updatedAt: new Date().toISOString() }, doc), null, 2));
    return true;
  } catch { return false; }
}

let cache = null; // { warehouses, via, updatedAt }

async function list(envdb) {
  if (cache) return cache;
  // 1) Supabase when configured
  if (envdb && envdb.sbUrl()) {
    try {
      const rows = await envdb.listWarehouses();
      if (rows && rows.length) {
        cache = { warehouses: rows, via: 'supabase', updatedAt: new Date().toISOString() };
        writeFile({ warehouses: rows, via: 'supabase-mirror' });
        return cache;
      }
    } catch {}
  }
  // 2) local file
  const f = readFile();
  if (f && f.warehouses && f.warehouses.length) {
    cache = { warehouses: f.warehouses, via: f.via || 'local-file', updatedAt: f.updatedAt || null };
    return cache;
  }
  // 3) seed + persist
  const warehouses = seedWarehouses();
  writeFile({ warehouses, via: 'seed' });
  cache = { warehouses, via: 'seed', updatedAt: new Date().toISOString() };
  return cache;
}

async function saveAll(envdb, warehouses) {
  const clean = (warehouses || []).map(function (w, i) {
    return {
      id: String(w.id || ('W' + (i + 1))),
      name: w.name || String(w.id || ('W' + (i + 1))),
      x: +w.x || 0, y: +w.y || 0,
      capacity: +w.capacity || 500, storageM3: +w.storageM3 || 3,
      throughputPerHr: +w.throughputPerHr || 100,
      handlingCostPerUnit: +w.handlingCostPerUnit || 1.2,
      fixedOperatingCost: +w.fixedOperatingCost || 600,
      open: w.open !== false,
      waves: Array.isArray(w.waves) ? w.waves : [8, 12, 16, 20],
      vehicles: Array.isArray(w.vehicles) ? w.vehicles : [{ id: String(w.id || 'W') + '-V1', capacityUnits: 20, speedKmH: 30, maxStops: 8 }],
    };
  });
  cache = { warehouses: clean, via: 'local-file', updatedAt: new Date().toISOString() };
  writeFile({ warehouses: clean, via: 'local-file' });
  let remote = { saved: false, via: 'local-only' };
  if (envdb && envdb.sbUrl()) {
    try { remote = await envdb.saveWarehouses(clean); } catch {}
    if (remote && remote.saved) cache.via = 'supabase';
  }
  return { warehouses: clean, via: cache.via, remote };
}

async function upsert(envdb, wh) {
  const cur = await list(envdb);
  const arr = cur.warehouses.slice();
  const i = arr.findIndex(function (w) { return w.id === wh.id; });
  if (i >= 0) arr[i] = Object.assign({}, arr[i], wh, { id: arr[i].id });
  else arr.push(wh);
  return saveAll(envdb, arr);
}

async function remove(envdb, id) {
  const cur = await list(envdb);
  return saveAll(envdb, cur.warehouses.filter(function (w) { return w.id !== id; }));
}

function invalidate() { cache = null; }

module.exports = { list, saveAll, upsert, remove, invalidate, seedWarehouses };
