// envdb.js — .env loading, JWT demo auth, OpenRouter LLM, Supabase persistence.
// Zero npm deps (node:crypto + https only).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

function loadEnv() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  lines.forEach(l => {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] != null) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  });
}
loadEnv();

const JWT_SECRET = process.env.JWT_SECRET || 'wlo-hackathon-secret';
// Hackathon-local accounts. They live for the lifetime of the server process;
// deploy with a real identity provider/database for production use.
const localUsers = [];
function b64url(b) { return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sign(payload) {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify(payload));
  const s = b64url(crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + p).digest());
  return h + '.' + p + '.' + s;
}
function verify(tok) {
  try {
    const [h, p, s] = tok.split('.');
    const e = b64url(crypto.createHmac('sha256', JWT_SECRET).update(h + '.' + p).digest());
    if (e !== s) return null;
    const d = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (d.exp && Date.now() > d.exp) return null;
    return d;
  } catch { return null; }
}
function users() {
  let configured = [];
  try { if (process.env.USERS_JSON) configured = JSON.parse(process.env.USERS_JSON); } catch {}
  return configured.concat([
    { email: 'planner@northstar.demo', password: 'northstar123', companyId: 'Northstar Logistics', companyName: 'Northstar Logistics', datasetSize: 56, seed: 56 },
    { email: 'planner@harbor.demo', password: 'harbor123', companyId: 'Harbor Retail', companyName: 'Harbor Retail', datasetSize: 90, seed: 90 },
    { email: 'planner@karnataka300.demo', password: 'karnataka300', companyId: 'Karnataka Logistics 300', companyName: 'Karnataka Logistics', datasetSize: 300, seed: 300 },
    { email: 'planner@karnataka500.demo', password: 'karnataka500', companyId: 'Karnataka Logistics 500', companyName: 'Karnataka Logistics Enterprise', datasetSize: 500, seed: 500 },
    { email: 'namit@gmail.com', password: '12345678', companyId: 'Namit Logistics', companyName: 'Namit Logistics', datasetSize: 500, seed: 501, warehouseCapacity: 300 },
    { email: 'panda@gmail.com', password: '12345678', companyId: 'Panda Logistics', companyName: 'Panda Logistics', datasetSize: 500, seed: 502, warehouseCapacity: 300 },
    { email: 'demo@flipkart.com', password: 'demo123', companyId: 'Flipkart', companyName: 'Flipkart', datasetSize: 56, seed: 56 },
    { email: 'partner@acme.com', password: 'partner123', companyId: 'Partner', companyName: 'Partner', datasetSize: 90, seed: 90 },
  ], localUsers);
}
function authResponse(u) {
  const companyName = u.companyName || u.companyId;
  const warehouseCapacity = u.warehouseCapacity || 1100;
  return { token: sign({ sub: u.email, companyId: u.companyId, companyName, datasetSize: u.datasetSize || 56, seed: u.seed || 56, warehouseCapacity, exp: Date.now() + 12 * 3600e3 }), user: { id: u.email, email: u.email, companyId: u.companyId, companyName, role: 'planner', datasetSize: u.datasetSize || 56, seed: u.seed || 56, warehouseCapacity } };
}
function passwordHash(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(password), salt, 64).toString('hex');
}
function passwordMatches(password, encoded) {
  const parts = String(encoded || '').split(':');
  if (parts.length !== 2) return false;
  return crypto.timingSafeEqual(Buffer.from(parts[1], 'hex'), Buffer.from(passwordHash(password, parts[0]).split(':')[1], 'hex'));
}
async function storedUser(email) {
  if (!sbUrl()) return null;
  const r = await sb({ path: '/rest/v1/wlo_users?email=eq.' + encodeURIComponent(email) + '&limit=1', method: 'GET', service: true });
  try { return r.ok ? JSON.parse(r.body)[0] || null : null; } catch { return null; }
}
async function login(email, password) {
  const u = users().find(x => x.email === email && x.password === password);
  if (u) return authResponse(u);
  const saved = await storedUser(String(email || '').trim().toLowerCase());
  if (!saved || !passwordMatches(password, saved.password_hash)) return null;
  return authResponse({ email: saved.email, companyId: saved.company_id, companyName: saved.company_name, datasetSize: saved.dataset_size, seed: saved.dataset_seed });
}
async function signup(email, password, companyName) {
  email = String(email || '').trim().toLowerCase();
  companyName = String(companyName || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address');
  if (String(password || '').length < 6) throw new Error('Password must be at least 6 characters');
  if (!companyName) throw new Error('Enter a company name');
  if (users().some(u => u.email.toLowerCase() === email)) throw new Error('An account with this email already exists');
  const companyId = companyName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'company';
  const seed = Array.from(email).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  const u = { email, password, companyId, companyName, datasetSize: 56, seed };
  const alreadyStored = await storedUser(email);
  if (alreadyStored) throw new Error('An account with this email already exists');
  if (sbUrl()) {
    const r = await sb({ path: '/rest/v1/wlo_users', method: 'POST', service: true }, {
      email, password_hash: passwordHash(password), company_id: companyId, company_name: companyName, dataset_size: 56, dataset_seed: seed,
    });
    if (!r.ok) throw new Error('Supabase could not create this account. Run backend/supabase.sql and check your service-role key.');
  }
  localUsers.push(u);
  return authResponse(u);
}
async function saveDataset(dataset) {
  if (!sbUrl()) return { saved: false, via: 'local-only' };
  const r = await sb({ path: '/rest/v1/wlo_datasets?on_conflict=company_id', method: 'POST', service: true }, dataset);
  return { saved: r.ok, via: 'supabase' };
}
function sbHeaders(service) {
  const key = service ? process.env['supabase-service-key'] : process.env['supabase-anon-key'];
  return { 'apikey': key || '', 'Authorization': 'Bearer ' + (key || ''), 'Content-Type': 'application/json' };
}
function sbUrl() { return (process.env['supabase-project-id'] || '').replace(/\/$/, ''); }
function sb(req2, body) {
  return new Promise(resolve => {
    if (!sbUrl()) return resolve({ ok: false, skip: true });
    const u = new URL(sbUrl() + req2.path);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: req2.method || 'GET', headers: Object.assign(sbHeaders(req2.service), req2.method === 'POST' ? { Prefer: 'resolution=merge-duplicates,return=minimal' } : {}) }, res => {
      let b = ''; res.on('data', c => { b += c; }); res.on('end', () => resolve({ ok: res.statusCode < 300, status: res.statusCode, body: b.slice(0, 4000) }));
    });
    req.on('error', () => resolve({ ok: false, err: true }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ ok: false, err: true }); });
    if (data) req.end(data); else req.end();
  });
}
async function saveRun(run) { // table wlo_runs (create in supabase SQL editor; ignored if missing)
  return sb({ path: '/rest/v1/wlo_runs', method: 'POST', service: true }, run);
}
async function listRuns(companyId) {
  const q = companyId ? `?company_id=eq.${encodeURIComponent(companyId)}&order=created_at.desc&limit=50` : '?order=created_at.desc&limit=50';
  const r = await sb({ path: '/rest/v1/wlo_runs' + q, method: 'GET' });
  if (!r.ok) return null;
  try { return JSON.parse(r.body); } catch { return null; }
}
function llmChat(messages, opts) { // OpenRouter (backend .env), fallback to OpenAI layout
  opts = opts || {};
  return new Promise(resolve => {
    const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    if (!key) return resolve({ ok: false, noKey: true });
    const useOR = !!process.env.OPENROUTER_API_KEY;
    const host = useOR ? 'openrouter.ai' : new URL(process.env.LLM_BASE || 'https://api.openai.com').hostname;
    const rpath = useOR ? '/api/v1/chat/completions' : '/v1/chat/completions';
    const body = JSON.stringify({ model: process.env.OPENROUTER_MODEL || process.env.LLM_MODEL || 'gpt-4o-mini', messages, max_tokens: opts.maxTokens || 500, temperature: opts.temperature != null ? opts.temperature : 0.5 });
    const req = https.request({ hostname: host, path: rpath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'Content-Length': Buffer.byteLength(body), ...(useOR ? { 'HTTP-Referer': 'http://localhost:4000', 'X-Title': 'WLO-hackathon' } : {}) } },
      res => { let b = ''; res.on('data', c => { b += c; }); res.on('end', () => { try { const j = JSON.parse(b); resolve({ ok: true, text: j.choices?.[0]?.message?.content || '', raw: b.slice(0, 500) }); } catch { resolve({ ok: false, body: b.slice(0, 500) }); } }); });
    req.on('error', () => resolve({ ok: false, err: true }));
    req.setTimeout(20000, () => { req.destroy(); resolve({ ok: false, err: true }); });
    req.end(body);
  });
}
module.exports = { login, signup, verify, saveDataset, saveRun, listRuns, llmChat, sbUrl };
