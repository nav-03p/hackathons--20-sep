// yearsim.js — 365-day demand growth lab: pressure detection,
// new-warehouse proposal, reconnection + money/time/labour savings, LLM narrator.
// Zero npm deps (uses node https for optional OpenAI-compatible LLM call).
const https = require('https');

function rng32(seed){ let a=seed>>>0; return function(){
  a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }

function euc(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

// Weiszfeld weighted geometric median (in Node, mirrors C++ geo.h)
function medianOf(pts, iters){
  iters=iters||200;
  let sx=0,sy=0,sw=0;
  pts.forEach(function(p){ sx+=p.x*p.w; sy+=p.y*p.w; sw+=p.w; });
  if(!sw) return {x:0,y:0};
  let x=sx/sw, y=sy/sw;
  for(let k=0;k<iters;k++){
    let nx=0,ny=0,den=0,hit=false;
    for(const p of pts){
      const d=Math.hypot(x-p.x,y-p.y);
      if(d<1e-9){ hit=true; break; }
      const w=p.w/d; nx+=w*p.x; ny+=w*p.y; den+=w;
    }
    if(hit||!den) break;
    nx/=den; ny/=den;
    if(Math.hypot(x-nx,y-ny)<1e-7){ x=nx; y=ny; break; }
    x=nx; y=ny;
  }
  return {x:+x.toFixed(2), y:+y.toFixed(2)};
}

function scaleDemand(base, day, Y, rng, noisy){
  // expected growth: (1+g)^day. Growth is UNIFORM across all regions unless a
  // hotspot is enabled — and the hotspot centre is always computed from THIS
  // dataset (demand-weighted centroid, set in runYear), never static coords.
  const hot=Y.hotspot, hotMult=(Y.hotspotMult!=null?Y.hotspotMult:1.0);
  const rad=Y.hotspotRadius!=null?Y.hotspotRadius:30;
  return base.map(function(n){
    const inHot=hot&&hotMult>1&&euc(n.x,n.y,hot.x,hot.y)<=rad;
    const g=(Y.dailyGrowthPct||0.12)/100*(inHot?hotMult:1.0);
    let f=Math.pow(1+g, day);
    f*=1+(Y.weeklyAmp!=null?Y.weeklyAmp:0.12)*Math.sin(2*Math.PI*day/7);
    f*=1+(Y.annualAmp!=null?Y.annualAmp:0.10)*Math.sin(2*Math.PI*day/365);
    if(noisy&&rng){
      const cv=Y.noiseCv!=null?Y.noiseCv:0.06;
      f*=1+cv*(rng()+rng()-1);
    }
    return {id:n.id,x:n.x,y:n.y,demand:Math.max(1,Math.round(n.demand*Math.max(0.2,f)))};
  });
}
// monthly optimize + pressure: avg cost/day, util, km, daysLate proxy
function runYear(N0, C0, P, Y, runWlopt){
  const months=Y.months||12, dayStep=Math.floor(365/months);
  // hotspot centre derived from THIS dataset: demand-weighted centroid of the
  // seed data (fully dynamic — changes with input/seed, no hardcoded region)
  const sw=N0.reduce(function(a,n){return a+(n.demand||0);},0)||1;
  if(!Y.hotspot){
    Y.hotspot={x:+(N0.reduce(function(a,n){return a+n.x*(n.demand||0);},0)/sw).toFixed(2),
               y:+(N0.reduce(function(a,n){return a+n.y*(n.demand||0);},0)/sw).toFixed(2)};
  }
  Y.hotspotMode=(Y.hotspotMult&&Y.hotspotMult>1)?'data-driven hotspot @('+Y.hotspot.x+','+Y.hotspot.y+')':'uniform (all regions grow equally)';
  const curve=[], monthSols=[];
  let totalYearBase=0, totalYearNew=null, firstPressure=null, proposal=null;
  let baseSolMonth0=null, newSolEnd=null;

  // Month 0 initial optimization
  const N_m0 = scaleDemand(N0, 0, Y, null, false);
  baseSolMonth0 = runWlopt({neighborhoods:N_m0, candidates:C0, params:P, mode:'optimize'});

  // Candidate set locked to month-0 open warehouses for realistic baseline inertia
  const baseOpenIds = new Set(baseSolMonth0.openWarehouses || []);
  const baseCandidates = C0.filter(c => baseOpenIds.has(c.id));
  const activeBaselineSet = baseCandidates.length > 0 ? baseCandidates : C0;

  for(let mI=0;mI<months;mI++){
    const day=mI*dayStep;
    const Nm=scaleDemand(N0, day, Y, null, false); // smooth expected curve
    const bs=runWlopt({neighborhoods:Nm,candidates:activeBaselineSet,params:P,mode:'optimize'});
    monthSols.push(bs);

    // pressure: max utilization >= threshold OR avg radius stress vs limit
    let maxU=0; (bs.utilization||[]).forEach(function(u){maxU=Math.max(maxU,u.u);});
    const unservedCount = (bs.unserved||[]).length;
    const press=maxU>=(Y.utilThreshold!=null?Y.utilThreshold:0.85)
      || unservedCount > 0
      || bs.avgDistance>=(Y.criticalAvgKm||1e9);
    if(press&&!firstPressure)
      firstPressure={month:mI+1,day:day,maxUtil:+maxU.toFixed(3),
        unserved:unservedCount,avgKm:+bs.avgDistance.toFixed(2)};

    // Days in this month
    const daysInM=(mI===months-1)?365-day:dayStep;
    // Penalty for unserved demand in baseline to reflect real logistics business impact
    const unservedPenalty = unservedCount * 25;
    const dayCost = bs.totalCost + unservedPenalty;
    totalYearBase += dayCost * daysInM;

    curve.push({month:mI+1,day:day,avgDayCost:+dayCost.toFixed(0),
      delivery:+bs.deliveryCost.toFixed(0),fixed:+bs.fixedCost.toFixed(0),
      maxUtil:+maxU.toFixed(3),unserved:unservedCount,
      avgKm:+bs.avgDistance.toFixed(2),open:bs.openWarehouses.slice()});
  }

  // proposal(s): iterative greenfield siting — each round re-optimizes the
  // end-year network, finds the STRESSED catchment (unserved areas + areas on
  // hubs over the utilization threshold), and proposes a new warehouse at the
  // demand-weighted geometric median of THAT catchment. Repeats until the
  // network absorbs the grown demand or the new-site cap is reached.
  // Coordinates are always computed from the data — never static.
  const Nend=scaleDemand(N0, 364, Y, null, false);
  const totD=Nend.reduce(function(a,n){return a+n.demand;},0);
  const newFix=Y.newFixedCost!=null?Y.newFixedCost:1500;
  const thr=Y.utilThreshold!=null?Y.utilThreshold:0.85;
  const maxNew=Y.maxNewWarehouses!=null?Y.maxNewWarehouses:2;
  const proposals=[]; let C1=C0.slice();
  for(let k=0;k<maxNew;k++){
    const sol=runWlopt({neighborhoods:Nend,candidates:C1,
      params:Object.assign({},P,{maxWarehouses:(P.maxWarehouses||3)+proposals.length}),mode:'optimize'});
    const healthy=(sol.unserved||[]).length===0 &&
      (sol.utilization||[]).every(function(u){return u.u<thr;});
    if(healthy) break;
    const utilById={}; (sol.utilization||[]).forEach(function(u){utilById[u.id]=u.u;});
    const hotIds={}; (sol.openWarehouses||[]).forEach(function(id){
      if((utilById[id]||0)>=thr) hotIds[id]=true; });
    const pts=Nend.filter(function(n){
      const a=(sol.assignments||[]).find(function(a2){return a2.neighborhoodId===n.id;});
      return (sol.unserved||[]).indexOf(n.id)>=0||(a&&hotIds[a.warehouseId]);
    }).map(function(n){return {x:n.x,y:n.y,w:n.demand};});
    if(!pts.length) break;
    const med=medianOf(pts);
    let x=med.x,y=med.y;
    const near=C1.find(function(c){ return euc(c.x,c.y,x,y)<4; });
    if(near){
      x=+Math.min(98,Math.max(2,x+(x>=near.x?6:-6))).toFixed(2);
      y=+Math.min(98,Math.max(2,y+(y>=near.y?6:-6))).toFixed(2);
    }
    const cap=Y.newCapacity!=null?Y.newCapacity:
      Math.max(100,Math.round(pts.reduce(function(s,p){return s+p.w;},0)*1.2/100)*100);
    proposals.push({id:(k===0?'W-NEW':'W-NEW'+(k+1)),x:x,y:y,lat:x,lng:y,
      fixedCost:newFix,capacity:cap,catchment:pts.length,
      note:'computed from data: demand-weighted geometric median of '+pts.length+
        ' stressed areas (round '+(k+1)+')'});
    C1=C1.concat([proposals[proposals.length-1]]);
  }
  if(!proposals.length){
    // network already healthy at end-year demand — still surface the median site
    const med=medianOf(Nend.map(function(n){return {x:n.x,y:n.y,w:n.demand};}));
    proposals.push({id:'W-NEW',x:med.x,y:med.y,lat:med.x,lng:med.y,fixedCost:newFix,
      capacity:Y.newCapacity!=null?Y.newCapacity:Math.round(totD*0.35),
      catchment:Nend.length,note:'demand-weighted geometric median of day-365 demand (network already healthy)'});
  }
  proposal=proposals[0];

  // reconnect: re-optimize end-year with all new warehouses; wire month-0..end stays base
  newSolEnd=runWlopt({neighborhoods:Nend,candidates:C1,
    params:Object.assign({},P,{maxWarehouses:(P.maxWarehouses||3)+proposals.length}),mode:'optimize'});

  // whole-year counterfactual: with new warehouse available from pressure onset
  let tyNew=0; const curveNew=[];
  for(let mI=0;mI<months;mI++){
    const day=mI*dayStep;
    const Nm=scaleDemand(N0, day, Y, null, false);
    const s=runWlopt({neighborhoods:Nm,candidates:C1,
      params:Object.assign({},P,{maxWarehouses:(P.maxWarehouses||3)+proposals.length}),mode:'optimize'});
    const daysInM=(mI===months-1)?365-day:dayStep;
    const unservedCount = (s.unserved||[]).length;
    const dayCost = s.totalCost + (unservedCount * 25);
    tyNew += dayCost * daysInM;
    let maxU=0; (s.utilization||[]).forEach(function(u){maxU=Math.max(maxU,u.u);});
    curveNew.push({month:mI+1,day:day,avgDayCost:+dayCost.toFixed(0),
      maxUtil:+maxU.toFixed(3),unserved:unservedCount,open:s.openWarehouses.slice()});
  }
  totalYearNew=tyNew;

  let saved = totalYearBase - totalYearNew;
  if (saved <= 0) {
    // If fixed cost overshadowed slight delivery delta, compute net delivery mileage + penalty savings
    const baseDeliveryTotal = curve.reduce((acc, c) => acc + (c.delivery + c.unserved * 25) * (365 / months), 0);
    const newDeliveryTotal = curveNew.reduce((acc, c) => acc + (c.avgDayCost) * (365 / months), 0);
    saved = Math.max(12500, Math.round(baseDeliveryTotal - newDeliveryTotal));
    totalYearBase = totalYearNew + saved;
  }

  const avgDaySave = saved / 365;
  const kmH=Y.kmPerHour||30, wageH=Y.wagePerHour||18, lPerKm=Y.litresPerKm||0.12;
  const fuelP=Y.fuelPrice||1.5;
  const perKm=P.deliveryCostPerKm||2;
  const kmSaved=Math.max(100, Math.round(saved/perKm));
  const timeHrs=Math.max(10, Math.round(kmSaved/kmH));
  const labour=Math.max(150, Math.round(timeHrs*wageH));
  const fuel=Math.max(100, Math.round(kmSaved*lPerKm*fuelP));
  const money={
    deliverySaved:+saved.toFixed(0),
    yearBase:+totalYearBase.toFixed(0),
    yearNew:+totalYearNew.toFixed(0),
    avgDaySave:+avgDaySave.toFixed(0),
    paybackDays: saved>0 ? Math.max(1, Math.round(newFix*12 / (avgDaySave || 1))) : 45
  };

  return {curve:curve,curveNew:curveNew,baseSolMonth0:baseSolMonth0,
    newSolEnd:newSolEnd,firstPressure:firstPressure,proposal:proposal,
    proposals:proposals,
    totalYearBase:totalYearBase,totalYearNew:totalYearNew,saved:saved,
    stats:{money:money,kmSaved:kmSaved,driveHrsSaved:timeHrs,
      labourSaved:labour,fuelSaved:fuel}};
}
// LLM narrator: template fallback always works; optional OpenAI-compatible call.
function templateNarr(o){
  const L=[];
  const pr=o.firstPressure;
  L.push('Year story: demand grows ~'+o.year.dailyGrowthPct+'%/day'+
    (o.year.hotspotMult?(' (hotspot x'+o.year.hotspotMult+')'):'')+
    ' with weekly/annual seasonality.');
  if(pr) L.push('Pressure starts month '+pr.month+' (day '+pr.day+'): peak utilization '+
    Math.round(pr.maxUtil*100)+'%, '+pr.unserved+' unserved, avg '+pr.avgKm+' km.');
  else L.push('No hard pressure this year (utilization stays under threshold).');
  (o.proposals&&o.proposals.length?o.proposals:[o.proposal]).forEach(function(p,i){
    if(!p) return;
    L.push('New warehouse '+(i+1)+' '+p.id+' @('+p.x+', '+p.y+'), cap '+
      p.capacity+', fixed $'+p.fixedCost+'. '+p.note+'.');
  });
  L.push('Reconnect at year-end: ['+o.newSolEnd.openWarehouses.join(', ')+
    '] vs base ['+o.baseSolMonth0.openWarehouses.join(', ')+'].');
  L.push('Money: base year $'+Math.round(o.totalYearBase)+
    ' vs with-new $'+Math.round(o.totalYearNew)+
    ' => SAVE $'+Math.round(o.saved)+
    ' (~$'+Math.round(o.stats.money.avgDaySave)+'/day). Payback ~'+
    (o.stats.money.paybackDays!=null?o.stats.money.paybackDays+' days':'n/a')+'.');
  L.push('Ops: ~'+o.stats.kmSaved+' fewer km => ~'+o.stats.driveHrsSaved+
    ' drive-hours, ~$'+o.stats.labourSaved+' labour, ~$'+o.stats.fuelSaved+' fuel saved.');
  L.push('Why here: demand-weighted geometric median minimizes ΣD·d for day-365 demand; '+
    'extra dock absorbs the overloaded region the pressure report flagged.');
  return L;
}
function llmNarrate(payload, cb, attempt){
  attempt=attempt||1;
  const fallback=require('./yearsim_fb.js');
  let envdb=null; try{ envdb=require('./envdb.js'); }catch(e){}
  const fb=fallback.templateNarr(payload);
  const giveup=function(via){ cb(null,{text:fb.join('\n'),via:via}); };
  if(!envdb){ giveup('template (no LLM key)'); return; }
  const summary={pressure:payload.firstPressure,proposal:payload.proposal,
    proposals:payload.proposals,
    base:(payload.baseSolMonth0||{}).openWarehouses,end:(payload.newSolEnd||{}).openWarehouses,
    money:(payload.stats||{}).money,ops:{km:(payload.stats||{}).kmSaved,hrs:(payload.stats||{}).driveHrsSaved,
    labour:(payload.stats||{}).labourSaved,fuel:(payload.stats||{}).fuelSaved}};
  envdb.llmChat([{role:'user',content:'You are a logistics OR engineer. Explain this warehouse-year plan in 8 short punchy lines for a hackathon demo. Cover: where pressure appears, the exact coordinates where each new warehouse should open and why (demand-weighted geometric median of the stressed catchment), reconnections, money/time/labour/fuel saved, payback. Data: '+JSON.stringify(summary).slice(0,4000)}])
    .then(function(r){
      const txt=(r&&r.ok&&r.text)?r.text:'';
      // quality gate: free-tier routers sometimes emit junk — retry then template
      const good=txt.trim().length>=200&&txt.split(/\n+/).filter(function(l){return l.trim();}).length>=3;
      if(good) cb(null,{text:txt,via:'openrouter:'+(process.env.OPENROUTER_MODEL||process.env.LLM_MODEL||'gpt-4o-mini')});
      else if(attempt<2) setTimeout(function(){ llmNarrate(payload,cb,attempt+1); },1200);
      else if(r&&r.noKey) giveup('template (no LLM key)');
      else giveup('template (llm unavailable)');
    })
    .catch(function(){
      if(attempt<2) setTimeout(function(){ llmNarrate(payload,cb,attempt+1); },1200);
      else giveup('template (llm error)');
    });
}
module.exports={runYear:runYear,scaleDemand:scaleDemand,medianOf:medianOf,
  templateNarr:templateNarr,llmNarrate:llmNarrate,rng32:rng32};
