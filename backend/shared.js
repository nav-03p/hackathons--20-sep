// shared.js — multi-tenant warehouse sharing (Flipkart-style).
// Concepts:
// - Every warehouse has: owner (company id), visibility: 'solo' | 'shared' | 'open'
//   solo   = only owner sees/uses it
//   shared = visible to listed partners; each partner gets sharePct% of capacity,
//            pays sharePct% of fixed cost (agreement split)
//   open   = public pool any company can tap (sharePct from agreement or default)
// - Solo optimize: company optimizes its own demand over (own WHs + shared WHs
//   visible to it, with capacity derated to its share and fixed cost prorated).
// - Joint optimize: pool all companies' demand, one C++ run, savings split.
// Zero npm deps.
function euc(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

function visibleTo(wh, companyId, company){
  if(!wh.owner || wh.owner===companyId) return {share:1, fixed:wh.fixedCost, why:'owner'};
  const vis = wh.visibility||'solo';
  if(vis==='solo') return null;
  const partners = wh.partners||{};
  if(vis==='shared'){
    const ag = partners[companyId];
    if(ag==null) return null;
    const pct = (typeof ag==='object'? ag.sharePct : ag)/100;
    const fpct = (typeof ag==='object' && ag.fixedPct!=null? ag.fixedPct : (typeof ag==='object'? ag.sharePct:ag))/100;
    return {share:pct, fixed:wh.fixedCost*fpct,
      why:'shared '+Math.round(pct*100)+'% cap / '+Math.round(fpct*100)+'% fixed'};
  }
  // open pool
  const ag = partners[companyId];
  const pct = ag!=null? (typeof ag==='object'?ag.sharePct:ag)/100
    : ((company&&company.defaultSharePct!=null?company.defaultSharePct:30)/100);
  const fpct = ag!=null&&typeof ag==='object'&&ag.fixedPct!=null? ag.fixedPct/100 : pct;
  return {share:pct, fixed:wh.fixedCost*fpct,
    why:'open-pool '+Math.round(pct*100)+'% cap / '+Math.round(fpct*100)+'% fixed'};
}

// Build the candidate list a company actually sees (solo + its shared slices)
function viewFor(companyId, warehouses, companies){
  const comp = (companies||[]).find(function(c){return c.id===companyId;})||{};
  const out=[];
  warehouses.forEach(function(w){
    const v = visibleTo(w, companyId, comp);
    if(!v) return;
    out.push({id:w.id+(v.share<1?'['+companyId+':'+Math.round(v.share*100)+'%]':''),
      realId:w.id, x:w.x, y:w.y, fixedCost:+v.fixed.toFixed(2),
      capacity:Math.max(1,Math.floor(w.capacity*v.share)),
      owner:w.owner||null, visibility:w.visibility||'solo', note:v.why});
  });
  return out;
}

// Solo-per-company: each company optimizes own demand on its own view.
function soloAll(companies, warehouses, demands, params, runWlopt){
  const per={}; let total=0;
  companies.forEach(function(c){
    const view = viewFor(c.id, warehouses, companies);
    const N = demands[c.id]||[];
    const P = Object.assign({}, params, c.params||{});
    const sol = runWlopt({neighborhoods:N, candidates:view, params:P, mode:'optimize'});
    // map sliced ids back to real warehouse ids for display
    const byReal={}; view.forEach(function(v){byReal[v.id]=v;});
    sol.assignments.forEach(function(a){
      const v=byReal[a.warehouseId];
      if(v){ a.realWarehouseId=v.realId; a.sliceNote=v.note; }
    });
    sol.companyView = view;
    per[c.id]=sol; total+=sol.totalCost;
  });
  return {per:per, totalSolo:total};
}

// Joint: pool demands, all warehouses full capacity, one run; then split savings.
function joint(companies, warehouses, demands, params, runWlopt){
  let N=[]; const demBy={};
  companies.forEach(function(c){ (demands[c.id]||[]).forEach(function(n){
    const id=c.id+':'+n.id; N.push({id:id,x:n.x,y:n.y,demand:n.demand});
    demBy[id]=c.id; }); });
  const full = warehouses.map(function(w){
    return {id:w.id,x:w.x,y:w.y,fixedCost:w.fixedCost,capacity:w.capacity};});
  const sol = runWlopt({neighborhoods:N, candidates:full, params:params, mode:'optimize'});
  // attribute delivery cost back to companies
  const attr={}; companies.forEach(function(c){attr[c.id]={delivery:0,orders:0};});
  sol.assignments.forEach(function(a){
    const cid=demBy[a.neighborhoodId];
    if(cid){ attr[cid].delivery+=a.cost; attr[cid].orders+=1; a.company=cid; }
  });
  const totDel = sol.assignments.reduce(function(s,a){return s+a.cost;},0)||1;
  // fixed split pro-rata by company delivery share (agreement-neutral default)
  const split={};
  companies.forEach(function(c){
    const share=(attr[c.id].delivery/totDel);
    split[c.id]={fixed:+(sol.fixedCost*share).toFixed(2),
      delivery:+attr[c.id].delivery.toFixed(2),
      total:+(attr[c.id].delivery+sol.fixedCost*share).toFixed(2),
      sharePct:+(share*100).toFixed(1)};
  });
  sol.attr=attr; sol.split=split;
  return sol;
}

function compareSoloJoint(soloRes, jointSol){
  const rows=[];
  Object.keys(soloRes.per).forEach(function(cid){
    const s=soloRes.per[cid].totalCost;
    const j=(jointSol.split[cid]||{}).total||0;
    rows.push({company:cid, solo:+s.toFixed(0), joint:+j.toFixed(0),
      saved:+(s-j).toFixed(0), savedPct: s>0? +((1-j/s)*100).toFixed(1):0});
  });
  const sj=soloRes.totalSolo, jj=jointSol.totalCost;
  return {rows:rows, totalSolo:+sj.toFixed(0), totalJoint:+jj.toFixed(0),
    totalSaved:+(sj-jj).toFixed(0),
    totalSavedPct: sj>0? +((1-jj/sj)*100).toFixed(1):0};
}

module.exports={visibleTo:visibleTo,viewFor:viewFor,soloAll:soloAll,
  joint:joint,compareSoloJoint:compareSoloJoint,euc:euc};
