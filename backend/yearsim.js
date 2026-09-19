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
  // expected growth: (1+g)^day, hotspot grows faster; weekly+annual seasonality
  return base.map(function(n){
    const hot=(n.x>60&&n.y<45)?(Y.hotspotMult||1.6):1.0;
    const g=(Y.dailyGrowthPct||0.12)/100*hot;
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
  const curve=[], monthSols=[];
  let totalYearBase=0, totalYearNew=null, firstPressure=null, proposal=null;
  let baseSolMonth0=null, newSolEnd=null;
  for(let mI=0;mI<months;mI++){
    const day=mI*dayStep;
    const Nm=scaleDemand(N0, day, Y, null, false); // smooth expected curve
    const bs=runWlopt({neighborhoods:Nm,candidates:C0,params:P,mode:'optimize'});
    monthSols.push(bs);
    if(mI===0) baseSolMonth0=bs;
    // pressure: max utilization >= threshold OR avg radius stress vs limit
    let maxU=0; (bs.utilization||[]).forEach(function(u){maxU=Math.max(maxU,u.u);});
    const press=maxU>=(Y.utilThreshold!=null?Y.utilThreshold:0.85)
      || (bs.unserved||[]).length>0
      || bs.avgDistance>=(Y.criticalAvgKm||1e9);
    if(press&&!firstPressure)
      firstPressure={month:mI+1,day:day,maxUtil:+maxU.toFixed(3),
        unserved:(bs.unserved||[]).length,avgKm:+bs.avgDistance.toFixed(2)};
    const daysInM=(mI===months-1)?365-day:dayStep;
    totalYearBase+=bs.totalCost*daysInM; // $/day assumed constant within month
    curve.push({month:mI+1,day:day,avgDayCost:+bs.totalCost.toFixed(0),
      delivery:+bs.deliveryCost.toFixed(0),fixed:+bs.fixedCost.toFixed(0),
      maxUtil:+maxU.toFixed(3),unserved:(bs.unserved||[]).length,
      avgKm:+bs.avgDistance.toFixed(2),open:bs.openWarehouses.slice()});
  }
  // proposal: geometric median of the END-year demand (pressure-weighted)
  const Nend=scaleDemand(N0, 364, Y, null, false);
  const totD=Nend.reduce(function(a,n){return a+n.demand;},0);
  const med=medianOf(Nend.map(function(n){return {x:n.x,y:n.y,w:n.demand};}));
  const nid='W-NEW';
  const newCap=Y.newCapacity!=null?Y.newCapacity:Math.round(totD*0.35);
  const newFix=Y.newFixedCost!=null?Y.newFixedCost:1500;
  // avoid proposing on top of existing candidate (snap check)
  let clash=null;
  C0.forEach(function(c){ if(euc(c.x,c.y,med.x,med.y)<4) clash=c.id; });
  proposal={id:nid,x:med.x,y:med.y,fixedCost:newFix,capacity:newCap,
    note: clash?('median snapped near existing '+clash+' — still added as extra dock'):
      'placed at demand-weighted geometric median of day-365 demand'};
  const C1=C0.concat([proposal]);
  // reconnect: re-optimize end-year with new warehouse; wire month-0..end stays base
  newSolEnd=runWlopt({neighborhoods:Nend,candidates:C1,
    params:Object.assign({},P,{maxWarehouses:(P.maxWarehouses||3)+1}),mode:'optimize'});
  // whole-year counterfactual: base plan frozen (month-0 assignment) vs new plan.
  // Estimate by re-running monthly curve with new candidate available.
  let tyNew=0; const curveNew=[];
  for(let mI=0;mI<months;mI++){
    const day=mI*dayStep;
    const Nm=scaleDemand(N0, day, Y, null, false);
    const s=runWlopt({neighborhoods:Nm,candidates:C1,
      params:Object.assign({},P,{maxWarehouses:(P.maxWarehouses||3)+1}),mode:'optimize'});
    const daysInM=(mI===months-1)?365-day:dayStep;
    tyNew+=s.totalCost*daysInM;
    let maxU=0; (s.utilization||[]).forEach(function(u){maxU=Math.max(maxU,u.u);});
    curveNew.push({month:mI+1,day:day,avgDayCost:+s.totalCost.toFixed(0),
      maxUtil:+maxU.toFixed(3),open:s.openWarehouses.slice()});
  }
  totalYearNew=tyNew;
  const saved=Math.max(0,totalYearBase-totalYearNew);
  const avgDaySave=saved/365;
  const kmH=Y.kmPerHour||30, wageH=Y.wagePerHour||18, lPerKm=Y.litresPerKm||0.12;
  const fuelP=Y.fuelPrice||1.5;
  // convert delivery-$ savings back to km via $/km, then to time/labour/fuel
  const perKm=P.deliveryCostPerKm||2;
  const kmSaved=saved/perKm;
  const money={deliverySaved:+saved.toFixed(0), yearBase:+totalYearBase.toFixed(0),
    yearNew:+totalYearNew.toFixed(0), avgDaySave:+avgDaySave.toFixed(0),
    paybackDays: saved>0? +((newFix)/avgDaySave).toFixed(0): null};
  const timeHrs=+(kmSaved/kmH).toFixed(0);
  const labour=+((timeHrs*wageH)).toFixed(0);
  const fuel=+((kmSaved*lPerKm*fuelP)).toFixed(0);
  return {curve:curve,curveNew:curveNew,baseSolMonth0:baseSolMonth0,
    newSolEnd:newSolEnd,firstPressure:firstPressure,proposal:proposal,
    totalYearBase:totalYearBase,totalYearNew:totalYearNew,saved:saved,
    stats:{money:money,kmSaved:+kmSaved.toFixed(0),driveHrsSaved:timeHrs,
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
  L.push('New warehouse '+o.proposal.id+' @('+o.proposal.x+','+o.proposal.y+'), cap '+
    o.proposal.capacity+', fixed $'+o.proposal.fixedCost+'. '+o.proposal.note+'.');
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
function llmNarrate(payload, cb){
  const fallback=require('./yearsim_fb.js');
  let envdb=null; try{ envdb=require('./envdb.js'); }catch(e){}
  const fb=fallback.templateNarr(payload);
  if(!envdb){ cb(null,{text:fb.join('\n'),via:'template (no LLM key)'}); return; }
  const summary={pressure:payload.firstPressure,proposal:payload.proposal,
    base:(payload.baseSolMonth0||{}).openWarehouses,end:(payload.newSolEnd||{}).openWarehouses,
    money:(payload.stats||{}).money,ops:{km:(payload.stats||{}).kmSaved,hrs:(payload.stats||{}).driveHrsSaved,
    labour:(payload.stats||{}).labourSaved,fuel:(payload.stats||{}).fuelSaved}};
  envdb.llmChat([{role:'user',content:'You are a logistics OR engineer. Explain this warehouse-year plan in 8 short punchy lines for a hackathon demo. Cover: where pressure appears, where the new warehouse goes and why (geometric median), reconnections, money/time/labour/fuel saved, payback. Data: '+JSON.stringify(summary).slice(0,4000)}])
    .then(function(r){
      if(r&&r.ok&&r.text) cb(null,{text:r.text,via:'openrouter:'+(process.env.OPENROUTER_MODEL||process.env.LLM_MODEL||'gpt-4o-mini')});
      else if(r&&r.noKey) cb(null,{text:fb.join('\n'),via:'template (no LLM key)'});
      else cb(null,{text:fb.join('\n'),via:'template (llm unavailable)'});
    });
}
module.exports={runYear:runYear,scaleDemand:scaleDemand,medianOf:medianOf,
  templateNarr:templateNarr,llmNarrate:llmNarrate,rng32:rng32};
