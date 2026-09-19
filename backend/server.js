// WLO backend — ZERO npm deps (stdlib only). Bridges HTTP <-> C++ wlopt.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const url = require('url');

const PORT = process.env.PORT || 4000;
const WLOPT = process.env.WLOPT || path.join(__dirname, '..', 'cpp', 'wlopt');
const ROOT = path.join(__dirname, '..');

function runWlopt(payload) {
  const r = spawnSync(WLOPT, [], {
    input: JSON.stringify(payload), encoding: 'utf8', maxBuffer: 64*1024*1024
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error((r.stderr||'wlopt failed').slice(0,2000));
  return JSON.parse(r.stdout);
}
function rng32(seed){ let a=seed>>>0; return function(){
  a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }
function genData(o){
  o=o||{};
  const n = Math.min(500, Math.max(3, o.neighborhoods||18));
  const m = Math.min(30, Math.max(2, o.candidates||6));
  const seed = o.seed!=null?o.seed:42, rng = rng32(seed);
  const mode = o.mode || 'mixed';
  // Normalized clusters used by the map projection. Bengaluru spreads demand
  // across its north, east, south, west and central urban areas.
  const centers = mode === 'bengaluru'
    ? [[50,50],[72,68],[73,38],[48,78],[27,56],[38,28],[62,20],[20,30]]
    : [[20,20],[80,30],[50,75],[25,70],[75,75]];
  const nb=[];
  for(let i=0;i<n;i++){
    let x,y;
    if(mode==='uniform'){ x=rng()*100; y=rng()*100; }
    else { const c=centers[Math.floor(rng()*centers.length)];
      x=Math.min(100,Math.max(0,c[0]+(rng()+rng()+rng()-1.5)*22));
      y=Math.min(100,Math.max(0,c[1]+(rng()+rng()+rng()-1.5)*22)); }
    const hotspot = (x>60&&y<45)?1.8:1.0;
    const demand = Math.max(5, Math.round((20+rng()*120)*hotspot));
    nb.push({id:'N'+(i+1), x:+x.toFixed(2), y:+y.toFixed(2), demand});
  }
  const cd=[];
  for(let j=0;j<m;j++)
    cd.push({id:'W'+(j+1), x:+(rng()*100).toFixed(2), y:+(rng()*100).toFixed(2),
      fixedCost: o.fixedCost!=null?o.fixedCost:1500,
      capacity: o.capacity!=null?o.capacity:800});
  return { neighborhoods: nb, candidates: cd };
}
function explain(sol, payload){
  payload=payload||{};
  const lines = [];
  const P = payload.params||{};
  lines.push('Opened '+sol.openWarehouses.length+' warehouse(s) ['+
    sol.openWarehouses.join(', ')+'] using '+sol.algorithmUsed+
    (sol.optimal?' (PROVEN OPTIMAL by branch-and-bound).':' (heuristic).'));
  lines.push('Total $'+sol.totalCost.toFixed(0)+' = delivery $'+
    sol.deliveryCost.toFixed(0)+' + fixed $'+sol.fixedCost.toFixed(0)+
    '. Avg distance '+sol.avgDistance.toFixed(2)+' km.');
  (sol.loads||[]).forEach(function(L){
    let c=null,u=null;
    (payload.candidates||[]).forEach(function(x){ if(x.id===L.id) c=x; });
    (sol.utilization||[]).forEach(function(x){ if(x.id===L.id) u=x; });
    const pct=u?(u.u*100).toFixed(1):'0';
    let tag='balanced.';
    if(u&&u.u>0.9) tag='nearly full: growth here forces a new warehouse.';
    if(u&&u.u<0.3) tag='underused: candidate for closure if fixed costs rise.';
    lines.push(L.id+': load '+L.load+'/'+(c?c.capacity:'?')+' ('+pct+'% util) - '+tag);
  });
  if((sol.unserved||[]).length)
    lines.push('Unserved ('+sol.unserved.length+'): '+
      sol.unserved.slice(0,8).join(', ')+' - outside radius or capacity full.');
  lines.push('Why: each neighborhood assigned to cheapest feasible open warehouse '+
    '(radius '+P.maxServiceRadius+', capacity-checked, demand-descending order).');
  return lines;
}
const year = require('./yearsim.js');
const shared = require('./shared.js');
const envdb = require('./envdb.js');
const fulfill = require('./fulfill.js');
// Per-company inventory ledger for the fulfillment layer (on-hand/reserved/incoming).
// Kept in-process like the rest of the repo's state: zero deps, no migrations.
const INV = {};
function invKeyFor(req){
  const me = bearer(req);
  return (me && me.companyId) ? me.companyId : 'demo';
}
function bearer(req){ const h=req.headers&&req.headers.authorization||''; const m=h.match(/^Bearer (.+)$/); return m?envdb.verify(m[1]):null; }
function send(res, code, obj, isText){
  const body = isText? String(obj) : JSON.stringify(obj);
  res.writeHead(code, {'Content-Type': isText?'text/plain':'application/json',
    'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, Authorization'});
  res.end(body);
}
function readBody(req){
  return new Promise(function(res,rej){ let b='';
    req.on('data',function(c){b+=c; if(b.length>20*1024*1024) rej(new Error('body too large'));});
    req.on('end',function(){res(b);}); req.on('error',rej); });
}
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css',
  '.json':'application/json','.csv':'text/csv','.png':'image/png'};
const server = http.createServer(function(req,res){
  const u = url.parse(req.url,true);
  if(req.method==='OPTIONS'){ send(res,200,{}); return; }
  (async function(){
    if(req.method==='GET' && (u.pathname==='/'||u.pathname==='/index.html')){
      const dist=path.join(ROOT,'frontend','dist','index.html');
      const f=fs.existsSync(dist)?dist:path.join(ROOT,'frontend','index.html');
      res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache','Expires':'0'});
      fs.createReadStream(f).pipe(res); return;
    }
    if(req.method==='GET' && u.pathname.indexOf('/assets/')===0){
      const f=path.join(ROOT,'frontend','dist',u.pathname.replace(/\.\./g,''));
      if(fs.existsSync(f)&&fs.statSync(f).isFile()){
        const ext=path.extname(f);
        res.writeHead(200,{'Content-Type':ext==='.js'?'text/javascript':ext==='.css'?'text/css':'application/octet-stream'});
        fs.createReadStream(f).pipe(res); return;
      }
      send(res,404,{error:'not found'}); return;
    }
    if(req.method==='GET' && u.pathname==='/sample.csv'){
      const f=path.join(ROOT,'data','sample.csv');
      res.writeHead(200,{'Content-Type':'text/csv'});
      fs.createReadStream(f).pipe(res); return;
    }
    if(req.method==='GET' && u.pathname==='/api/health'){
      send(res,200,{ok:true, wlopt:WLOPT, time:new Date().toISOString(),
        llm:(process.env.OPENROUTER_API_KEY||process.env.OPENAI_API_KEY)?('on:'+(process.env.OPENROUTER_MODEL||process.env.LLM_MODEL||'gpt-4o-mini')):'template-only',
        db:envdb.sbUrl()?'supabase:'+envdb.sbUrl():'local-only'}); return;
    }
    if(req.method==='GET' && u.pathname==='/api/demo'){
      send(res,200,genData({neighborhoods:18,candidates:6,seed:7,
        mode:'mixed',capacity:700,fixedCost:1500})); return;
    }
    if(req.method==='GET' && u.pathname.indexOf('/app/')===0){
      const f=path.join(ROOT,'frontend',u.pathname.slice(5).replace(/\.\./g,''));
      if(fs.existsSync(f)&&fs.statSync(f).isFile()){
        res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});
        fs.createReadStream(f).pipe(res); return;
      }
      send(res,404,{error:'not found'}); return;
    }
    if(req.method==='POST' && u.pathname==='/api/generate'){
      const b=JSON.parse(await readBody(req)||'{}');
      send(res,200,genData(b)); return;
    }
    const modes={'/api/optimize':'optimize','/api/compare':'compare',
      '/api/simulate':'simulate','/api/sensitivity':'sensitivity',
      '/api/median':'median','/api/explain':'optimize'};
    if(req.method==='POST' && modes[u.pathname]){
            const b=JSON.parse(await readBody(req)||'{}');
      const isMedian = u.pathname==='/api/median';
      if(!b.neighborhoods || (!isMedian && !b.candidates)){
        send(res,400,{error:'neighborhoods + candidates required'}); return;
      }
      const payload=Object.assign({}, b, {mode: b.mode||modes[u.pathname]});
      const out=runWlopt(payload);
            if(u.pathname==='/api/explain') out.explanation=explain(out,b);
            if(u.pathname==='/api/optimize'){
        if(b.explain) out.explanation=explain(out,b);
        try{
          const P=b.params||{};
          const base=runWlopt(Object.assign({}, b, {mode:'optimize',
            params:Object.assign({},P,{minWarehouses:1,maxWarehouses:1,algorithm:'greedy'})}));
          out.baselineSingle={total:base.totalCost,open:base.openWarehouses};
          if(base.totalCost>0&&isFinite(base.totalCost))
            out.savingsPct=+((1-out.totalCost/base.totalCost)*100).toFixed(1);
        }catch(e){}
      }
      try{ const me2=bearer(req); envdb.saveRun({company_id:me2?me2.companyId:null, name:(b.params&&b.params.algorithm||'auto')+' run',
        algorithm:(b.params&&b.params.algorithm)||'auto', warehouse_count:out.openWarehouses.length,
        total_cost:Math.round(out.totalCost), avg_distance:+out.avgDistance.toFixed(2), runtime_ms:Math.round(out.runtimeMs)}); }catch(e){}
      try{ const log=JSON.parse('[]'); }catch(e){}
      send(res,200,out); return;
    }
    if(req.method==='POST' && u.pathname==='/api/year'){

      // 365-day growth lab: monthly re-optimize, pressure, new-wh proposal,
      // reconnect + money/time/labour + LLM narration.
      const b=JSON.parse(await readBody(req)||'{}');
      if(!b.neighborhoods||!b.candidates){
        send(res,400,{error:'neighborhoods + candidates required'}); return;
      }
      const P=Object.assign({deliveryCostPerKm:2,maxServiceRadius:60,
        minWarehouses:1,maxWarehouses:3,distanceMetric:'euclidean',
        roadFactor:1.35,algorithm:'localsearch',randomSeed:42,
        saIterations:3000}, b.params||{});
      const Y=Object.assign({months:12,dailyGrowthPct:0.12,hotspotMult:1.6,
        weeklyAmp:0.12,annualAmp:0.10,noiseCv:0.06,utilThreshold:0.85,
        newCapacity:null,newFixedCost:1500,kmPerHour:30,wagePerHour:18,
        litresPerKm:0.12,fuelPrice:1.5}, b.year||{});
      const o=year.runYear(b.neighborhoods,b.candidates,P,Y,runWlopt);
      o.year=Y; o.params=P;
      // narration: try LLM if key set, else template (async-safe, fast path sync)
      if(process.env.OPENAI_API_KEY||process.env.LLM_API_KEY){
        year.llmNarrate(o, function(err, narr){
          o.narration = (narr&&narr.text? [narr.text] : year.templateNarr(o));
          o.narrVia = (narr&&narr.via) || 'template';
          send(res,200,o);
        });
      } else {
        o.narration=year.templateNarr(o); o.narrVia='template (no LLM key)';
        send(res,200,o);
      }
      return;
    }
    if(req.method==='POST' && u.pathname==='/api/narrate'){
      // LLM narrator: pass a /api/year result (or {yearResult}) -> story text.
      // Uses OPENAI_API_KEY / LLM_BASE / LLM_MODEL if set, else template.
      // Robust: missing fields -> template with what we have.
      const b=JSON.parse(await readBody(req)||'{}');
      const yr=b.yearResult||b;
      if(!yr.proposal||!yr.stats){
        send(res,200,{text:(yr.narration||['Run /api/year first for the full story.']).join
          ? (yr.narration||['Run /api/year first.']).join('\n')
          : String(yr.narration||'Run /api/year first.'),
          via:'template (need /api/year result)'});
        return;
      }
      const payload={firstPressure:yr.firstPressure,proposal:yr.proposal,
        baseSolMonth0:yr.baseSolMonth0,newSolEnd:yr.newSolEnd,
        totalYearBase:yr.totalYearBase,totalYearNew:yr.totalYearNew,
        saved:yr.saved,stats:yr.stats,year:yr.year||b.year||{}};
      year.llmNarrate(payload, function(err, out){
        if(err){ send(res,500,{error:String(err)}); return; }
        send(res,200,out);
      });
      return;
    }
    if(req.method==='POST' && u.pathname==='/api/tenants'){
      // multi-tenant sharing: register companies + warehouses (solo/shared/open),
      // agreements {sharePct, fixedPct} per partner, per-company demand slices.
      const b=JSON.parse(await readBody(req)||'{}');
      const companies=b.companies||[]; const warehouses=b.warehouses||[];
      const demands=b.demands||{};
      const P=Object.assign({deliveryCostPerKm:2,maxServiceRadius:200,
        minWarehouses:1,maxWarehouses:6,distanceMetric:'euclidean',
        roadFactor:1.35,algorithm:'localsearch',randomSeed:42}, b.params||{});
      const views={};
      companies.forEach(function(c){ views[c.id]=shared.viewFor(c.id,warehouses,companies); });
      const solo=shared.soloAll(companies,warehouses,demands,P,runWlopt);
      const j=shared.joint(companies,warehouses,demands,P,runWlopt);
      const cmp=shared.compareSoloJoint(solo,j);
      send(res,200,{companies:companies,warehouses:warehouses,views:views,
        solo:solo,joint:j,compare:cmp,
        note:'solo = each company on own view (own + shared slices, derated cap, prorated fixed). joint = pooled demand, one C++ run, fixed split pro-rata. Only shared/open warehouses are visible across companies.'});
      return;
    }
    if(req.method==='POST' && u.pathname==='/api/share'){
      // mutate visibility/agreement: {warehouses, op:{type, whId, ...}}
      // ops: setSolo|setShared|setOpen|agree|close
      const b=JSON.parse(await readBody(req)||'{}');
      let warehouses=(b.warehouses||[]).slice();
      const op=b.op||{};
      function find(id){ for(let i=0;i<warehouses.length;i++) if(warehouses[i].id===id) return i; return -1; }
      if(op.type==='setSolo'){ const i=find(op.whId); if(i>=0){ warehouses[i].visibility='solo'; warehouses[i].partners={}; } }
      else if(op.type==='setShared'){ const i=find(op.whId); if(i>=0){ warehouses[i].visibility='shared'; warehouses[i].partners=op.partners||warehouses[i].partners||{}; } }
      else if(op.type==='setOpen'){ const i=find(op.whId); if(i>=0){ warehouses[i].visibility='open'; warehouses[i].partners=op.partners||warehouses[i].partners||{}; } }
      else if(op.type==='agree'){ const i=find(op.whId); if(i>=0){ warehouses[i].partners=warehouses[i].partners||{}; warehouses[i].partners[op.partner]={sharePct:op.sharePct,fixedPct:(op.fixedPct!=null?op.fixedPct:op.sharePct)}; if(warehouses[i].visibility==='solo') warehouses[i].visibility='shared'; } }
      else if(op.type==='close'){ const i=find(op.whId); if(i>=0){ warehouses[i].visibility='solo'; warehouses[i].partners={}; } }
      send(res,200,{warehouses:warehouses}); return;
    }
    if(req.method==='POST' && u.pathname==='/api/auth/login'){
      const b=JSON.parse(await readBody(req)||'{}');
      const r=await envdb.login(b.email,b.password);
      if(!r){ send(res,401,{error:'bad email/password (see backend/.env USERS_JSON or demo logins)'}); return; }
      send(res,200,r); return;
    }
    if(req.method==='POST' && u.pathname==='/api/auth/signup'){
      const b=JSON.parse(await readBody(req)||'{}');
      try { send(res,201,await envdb.signup(b.email,b.password,b.companyName)); }
      catch(e) { send(res,400,{error:e.message||'Unable to create account'}); }
      return;
    }
    if(req.method==='POST' && u.pathname==='/api/datasets'){
      const me=bearer(req);
      if(!me){ send(res,401,{error:'Sign in before saving a dataset'}); return; }
      const b=JSON.parse(await readBody(req)||'{}');
      if(!Array.isArray(b.neighborhoods)||!Array.isArray(b.candidates)){ send(res,400,{error:'neighborhoods and candidates are required'}); return; }
      const out=await envdb.saveDataset({company_id:me.companyId,owner_email:me.sub,neighborhoods:b.neighborhoods,candidates:b.candidates,updated_at:new Date().toISOString()});
      send(res,200,out); return;
    }
    if(req.method==='GET' && u.pathname==='/api/history'){
      const me=bearer(req);
      const rows=await envdb.listRuns(me?me.companyId:null);
      if(rows){ send(res,200,{runs:rows,via:'supabase'}); return; }
      send(res,200,{runs:[],via:'none',note:'create table wlo_runs in Supabase (see README) or rely on local log'}); return;
    }
    if(req.method==='POST' && u.pathname==='/api/forecast'){
      const b=JSON.parse(await readBody(req)||'{}');
      const hist=b.history||{}; const h=b.horizon||4; const out={};
      Object.keys(hist).forEach(function(id){
        const arr=hist[id]; const n=arr.length, k=Math.min(3,n);
        const ma=arr.slice(-k).reduce(function(a,v){return a+v;},0)/k;
        let sx=0,sy=0,sxx=0,sxy=0;
        arr.forEach(function(v,i){sx+=i;sy+=v;sxx+=i*i;sxy+=i*v;});
        const slope=(n*sxy-sx*sy)/Math.max(1e-9,(n*sxx-sx*sx));
        const last=arr[n-1];
        const fc=[]; for(let t=0;t<h;t++) fc.push(Math.max(1,Math.round(last+slope*(t+1))));
        out[id]={movingAvg:+ma.toFixed(1),trend:+slope.toFixed(2),forecast:fc};
      });
      send(res,200,{forecasts:out,
        note:'Baseline (moving-average + linear trend). Feed forecast into /api/optimize.'});
      return;
    }
    if(req.method==='GET' && u.pathname==='/api/fulfill/demo'){
      // Ready-to-run fulfillment scenario: SKUs, sites with stock/vehicles/waves,
      // inbound replenishments, orders with deadlines, and forecast demand.
      const d=fulfill.demoFulfill({seed:u.query.seed!=null?+u.query.seed:7,
        orders:u.query.orders!=null?+u.query.orders:18});
      send(res,200,Object.assign({storedInventory:INV[invKeyFor(req)]||{},
        inventoryOps:'POST /api/inventory {op:{type:receive|reserve|release|commit|adjust,warehouseId,productId,qty}}'},d));
      return;
    }
    if(req.method==='POST' && u.pathname==='/api/fulfill'){
      // Full operational plan: allocate -> schedule waves -> assign vehicles ->
      // update inventory -> (optional) storage plan + rebalance.
      const b=JSON.parse(await readBody(req)||'{}');
      if(!b.warehouses||!b.orders){ send(res,400,{error:'warehouses + orders required'}); return; }
      const key=invKeyFor(req);
      INV[key]=INV[key]||{};
      if(!b.inventory && b.useStored!==false && Object.keys(INV[key]).length) b.inventory=INV[key];
      const out=fulfill.planFulfillment(runWlopt,b,key);
      if(out.error){ send(res,400,out); return; }
      if(out.committed) INV[key]=out.committed.inventory;
      try{ envdb.saveRun({company_id:key==='demo'?null:key,name:'fulfillment plan',
        algorithm:'fulfill',warehouse_count:out.totals.sitesUsed,
        total_cost:Math.round(out.totals.totalCost),
        avg_distance:+out.totals.avgTransitHr.toFixed(2),runtime_ms:out.runtimeMs}); }catch(e){}
      send(res,200,out); return;
    }
    if(req.method==='POST' && u.pathname==='/api/inventory'){
      // Inventory ledger ops: receive (add, or schedule inbound with etaHr),
      // reserve, release, commit (ship out), adjust (set), snapshot, reset.
      const b=JSON.parse(await readBody(req)||'{}');
      const key=invKeyFor(req);
      const base=b.inventory||INV[key]||{};
      const r=fulfill.applyInventoryOp(base,b.op||{type:'snapshot'});
      INV[key]=r.inventory;
      const whs=(b.warehouses||[]).map(function(w){return {id:w.id,name:w.name||w.id};});
      const rows=fulfill.inventoryMatrix(whs,INV[key],[]).rows;
      send(res,200,{result:r.result,inventory:INV[key],rows:rows}); return;
    }
    if(req.method==='POST' && u.pathname==='/api/rebalance'){
      // Move surplus SKUs to deficit sites (transportation problem) and, with
      // options.commit, actually apply the transfers to the inventory ledger.
      const b=JSON.parse(await readBody(req)||'{}');
      if(!b.warehouses){ send(res,400,{error:'warehouses required'}); return; }
      const key=invKeyFor(req);
      const out=fulfill.rebalancePlan(runWlopt,b);
      if(b.commit&&out.moves){
        INV[key]=INV[key]||{};
        out.applied=0;
        out.moves.forEach(function(m){
          INV[key]=fulfill.applyInventoryOp(INV[key],
            {type:'commit',warehouseId:m.from,productId:m.productId,qty:m.qty}).inventory;
          INV[key]=fulfill.applyInventoryOp(INV[key],
            {type:'receive',warehouseId:m.to,productId:m.productId,qty:m.qty}).inventory;
          out.applied++;
        });
        out.inventory=INV[key];
      }
      send(res,200,out); return;
    }
    if(req.method==='POST' && u.pathname==='/api/storage'){
      // How much of each SKU should each site hold? Fractional-knapsack by $/m3
      // (LP-optimal for the relaxation) + safety stock / reorder points.
      const b=JSON.parse(await readBody(req)||'{}');
      if(!b.warehouses){ send(res,400,{error:'warehouses required'}); return; }
      send(res,200,fulfill.storagePlan(runWlopt,b)); return;
    }
    send(res,404,{error:'unknown route '+u.pathname});
  })().catch(function(e){ send(res,500,{error:String(e.message||e).slice(0,2000)}); });
});
if(require.main===module)
  server.listen(PORT, function(){console.log('WLO backend on :'+PORT);});
module.exports={server:server,runWlopt:runWlopt,genData:genData,explain:explain};
