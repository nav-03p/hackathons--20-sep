// expansion.js — demand-growth expansion advisor for the optimization page.
// Answers: which warehouses to expand, by how much, where to open a new one,
// re-optimized network on a map + LLM executive summary. Zero npm deps.
const year = require('./yearsim.js');

function round100(v){ return Math.max(100, Math.ceil(v/100)*100); }

function runExpansion(N0, C0, P, X, runWlopt){
  const growthPct = X.growthPct!=null ? X.growthPct : 25;
  const g = 1 + growthPct/100;
  const thr = X.utilThreshold!=null ? X.utilThreshold : 0.85;
  const N = N0.map(function(n){
    return {id:n.id, x:n.x, y:n.y, demand:Math.max(1, Math.round((n.demand||0)*g))};
  });
  const grownDemandTotal = N.reduce(function(s,n){ return s+n.demand; }, 0);

  // 1) grown-demand run on the CURRENT network (inertia: existing sites only)
  const base = runWlopt({neighborhoods:N, candidates:C0, params:P, mode:'optimize'});
  const utilById={}; (base.utilization||[]).forEach(function(u){ utilById[u.id]=u.u; });
  const capById={}; C0.forEach(function(c){ capById[c.id]=c.capacity; });
  const baseMaxUtil = Math.max(0, (base.utilization||[]).map(function(u){return u.u;})
    .reduce(function(a,b){ return Math.max(a,b); }, 0));

  // 2) which hubs to expand, and by how much (target: util back to threshold)
  const expansions=[];
  (base.openWarehouses||[]).forEach(function(id){
    const u=utilById[id]||0;
    if(u>=thr){
      const cap=capById[id]||0;
      const load=cap*u;                          // current assigned volume
      const to=round100(load/Math.max(0.3,thr)); // capacity that brings util to threshold
      const add=Math.max(100, to-cap);
      const cand=C0.find(function(c){ return c.id===id; });
      expansions.push({id:id, name:(cand&&cand.name)||id, utilBefore:+u.toFixed(3),
        capacityFrom:cap, capacityTo:to, addUnits:add});
    }
  });

  // 3) leftover unmet demand -> propose a NEW warehouse (greenfield site):
  //    demand-weighted geometric median of the stressed catchment
  //    (unserved areas + areas crowded into the hubs we are expanding).
  const overloadedIds={}; expansions.forEach(function(e){ overloadedIds[e.id]=true; });
  const pts=[];
  const asgBase = Array.isArray(base.assignments) ? base.assignments : [];
  N.forEach(function(n){
    const a=asgBase.find(function(x){ return x.neighborhoodId===n.id; });
    const unserved=(base.unserved||[]).indexOf(n.id)>=0;
    if(unserved || (a && overloadedIds[a.warehouseId]))
      pts.push({x:n.x, y:n.y, w:n.demand});
  });
  let proposal=null;
  const capAfterOpen=(base.openWarehouses||[]).reduce(function(s,id){
    const e=expansions.find(function(x){ return x.id===id; });
    return s+(e?e.capacityTo:(capById[id]||0));
  },0);
  const unmetBefore=Math.max(0, grownDemandTotal-capAfterOpen);
  if(pts.length && (expansions.length || (base.unserved||[]).length)){
    const med=year.medianOf(pts);
    let x=med.x, y=med.y;
    // jitter away if we landed on top of an existing candidate site
    const near=C0.find(function(c){ return Math.hypot(c.x-x,c.y-y)<4; });
    if(near){
      x=Math.min(98, Math.max(2, x+(x>=near.x?6:-6)));
      y=Math.min(98, Math.max(2, y+(y>=near.y?6:-6)));
    }
    const need=pts.reduce(function(s,p){ return s+p.w; },0)*(X.buffer!=null?X.buffer:1.2);
    proposal={id:'NEW1', name:'Proposed Hub', x:+x.toFixed(2), y:+y.toFixed(2),
      capacity:round100(need), fixedCost:X.newFixedCost!=null?X.newFixedCost:1500,
      catchment:pts.length,
      note:'Demand-weighted geometric median of '+pts.length+' stressed areas (Weiszfeld)'};
  }

  // 4) re-optimize with expanded capacities + the proposed site available
  let C1=C0.map(function(c){
    const e=expansions.find(function(x){ return x.id===c.id; });
    return e?Object.assign({},c,{capacity:e.capacityTo}):c;
  });
  if(proposal) C1=C1.concat([Object.assign({},proposal)]);
  const P2=Object.assign({},P,{maxWarehouses:(P.maxWarehouses||3)+(proposal?1:0)});
  const fin=runWlopt({neighborhoods:N, candidates:C1, params:P2, mode:'optimize'});
  const finMaxUtil = Math.max(0,(fin.utilization||[]).map(function(u){return u.u;})
    .reduce(function(a,b){ return Math.max(a,b); },0));
  const capAfterFin=(fin.openWarehouses||[]).reduce(function(s,id){
    const c=C1.find(function(x){ return x.id===id; });
    return s+((c&&c.capacity)||0);
  },0);

  const saved=Math.max(0, (base.totalCost||0)-(fin.totalCost||0));
  const paybackDays = saved>0 && proposal ? Math.max(1, Math.round(proposal.fixedCost*12/saved)) : null;

  return {growthPct:growthPct, utilThreshold:thr, grownDemandTotal:grownDemandTotal,
    base:{openWarehouses:base.openWarehouses, utilization:base.utilization,
      unserved:base.unserved, totalCost:base.totalCost, maxUtil:+baseMaxUtil.toFixed(3),
      capacityViolations:base.capacityViolations},
    expansions:expansions, proposal:proposal,
    final:{openWarehouses:fin.openWarehouses, utilization:fin.utilization,
      unserved:fin.unserved, totalCost:fin.totalCost, maxUtil:+finMaxUtil.toFixed(3),
      assignments:fin.assignments},
    savings:{savedPerPeriod:Math.round(saved),
      unmetBefore:Math.min(grownDemandTotal, unmetBefore),
      unmetAfter:Math.max(0, grownDemandTotal-capAfterFin),
      unservedBefore:(base.unserved||[]).length, unservedAfter:(fin.unserved||[]).length,
      paybackDays:paybackDays},
    stats:{newSiteFixed:proposal?proposal.fixedCost:0,
      expansionUnits:expansions.reduce(function(s,e){ return s+e.addUnits; },0)}};
}

// Template summary (always available, used when LLM is unavailable)
function templateSummary(o){
  const L=[];
  L.push('At +'+o.growthPct+'% demand ('+o.grownDemandTotal+' orders/day), peak hub utilization is '+
    Math.round((o.base.maxUtil||0)*100)+'% vs threshold '+Math.round(o.utilThreshold*100)+'%.');
  if(o.expansions.length){
    L.push('Expand '+o.expansions.length+' existing hub'+(o.expansions.length>1?'s':'')+': '+
      o.expansions.map(function(e){ return e.name+' +'+e.addUnits+' ('+e.capacityFrom+'→'+e.capacityTo+
        ', was '+Math.round(e.utilBefore*100)+'% full)'; }).join('; ')+'.');
  } else {
    L.push('No existing hub crosses the utilization threshold — capacity is sufficient for this growth.');
  }
  if(o.proposal){
    L.push('Open new warehouse '+o.proposal.id+' @('+o.proposal.x+', '+o.proposal.y+') with capacity '+
      o.proposal.capacity+' — demand-weighted geometric median of the '+o.proposal.catchment+
      ' stressed areas minimizes total weighted distance.');
  } else {
    L.push('No new site needed: expanding existing hubs covers the whole growth scenario.');
  }
  L.push('Re-optimized network: ['+(o.final.openWarehouses||[]).join(', ')+'] — peak utilization drops '+
    Math.round((o.base.maxUtil||0)*100)+'% → '+Math.round((o.final.maxUtil||0)*100)+'%.');
  L.push('Unserved areas: '+o.savings.unservedBefore+' → '+o.savings.unservedAfter+
    '; unmet capacity: '+o.savings.unmetBefore+' → '+o.savings.unmetAfter+' orders/day.');
  if(o.savings.savedPerPeriod>0){
    L.push('Delivery cost '+Math.round(o.base.totalCost||0)+' → '+Math.round(o.final.totalCost||0)+
      ' (saves ~$'+o.savings.savedPerPeriod+'/period)'+(o.savings.paybackDays?
      '; new-site payback ~'+o.savings.paybackDays+' days.':'.'));
  } else {
    L.push('Delivery cost moves '+Math.round(o.base.totalCost||0)+' → '+Math.round(o.final.totalCost||
      0)+' — the plan buys full coverage: '+o.savings.unmetBefore+' previously unserved/unmet orders now served.');
  }
  return L;
}

// LLM executive summary via OpenRouter/OpenAI-compatible chat; template fallback.
// Free-tier routers fail intermittently, so retry once before falling back.
function llmSummarize(o, cb, attempt){
  attempt=attempt||1;
  let envdb=null; try{ envdb=require('./envdb.js'); }catch(e){}
  const fb=templateSummary(o);
  const giveup=function(via){ cb(null,{text:fb.join('\n'), via:via}); };
  if(!envdb){ giveup('template (no envdb)'); return; }
  const data={growthPct:o.growthPct, grownDemandTotal:o.grownDemandTotal,
    base:{open:o.base.openWarehouses, maxUtil:o.base.maxUtil, unserved:(o.base.unserved||[]).length,
      totalCost:o.base.totalCost},
    expansions:o.expansions, proposal:o.proposal,
    final:{open:o.final.openWarehouses, maxUtil:o.final.maxUtil,
      unserved:(o.final.unserved||[]).length, totalCost:o.final.totalCost},
    savings:o.savings};
  envdb.llmChat([{role:'user', content:'You are a logistics OR engineer. Give an executive summary in 6-8 short punchy lines for a hackathon demo of this demand-growth expansion plan. Cover: how much demand grew, which existing warehouses to expand and by how much (with before/after utilization), where a new warehouse should open and why (geometric median of stressed areas), the re-optimized network, utilization/unserved improvement, cost saved and payback. Data: '+JSON.stringify(data).slice(0,4000)}])
    .then(function(r){
      const txt=(r&&r.ok&&r.text)?r.text:'';
      // quality gate: free-tier models sometimes emit junk one-liners
      const good=txt.trim().length>=200 && txt.split(/\n+/).filter(function(l){return l.trim();}).length>=3;
      if(good){
        cb(null,{text:txt, via:'llm:'+(process.env.OPENROUTER_MODEL||process.env.LLM_MODEL||'default')});
      } else if(attempt<2){
        setTimeout(function(){ llmSummarize(o, cb, attempt+1); }, 1200);
      } else if(r&&r.noKey){
        giveup('template (no LLM key)');
      } else {
        giveup('template (llm unavailable)');
      }
    })
    .catch(function(){ 
      if(attempt<2) setTimeout(function(){ llmSummarize(o, cb, attempt+1); }, 1200);
      else giveup('template (llm error)');
    });
}

module.exports={runExpansion:runExpansion, templateSummary:templateSummary, llmSummarize:llmSummarize};

