// T11: 365-day year lab — pressure, proposal, reconnect, savings + narration
(function(){
  const y=require('../backend/yearsim.js');
  const srv=require('../backend/server.js');
  const d=srv.genData({neighborhoods:10,candidates:4,seed:7,mode:'mixed',capacity:900,fixedCost:1500});
  const P={deliveryCostPerKm:2,maxServiceRadius:200,minWarehouses:1,maxWarehouses:2,algorithm:'localsearch',randomSeed:42};
  const o=y.runYear(d.neighborhoods,d.candidates,P,
    {months:12,dailyGrowthPct:0.15,hotspotMult:1.6,utilThreshold:0.85},srv.runWlopt);
  o.year={dailyGrowthPct:0.15,hotspotMult:1.6};
  const narr=y.templateNarr(o);
  const okA = o.curve.length===12 && o.proposal && o.proposal.id==='W-NEW';
  const okB = o.saved>0 && o.newSolEnd.openWarehouses.indexOf('W-NEW')>=0;
  const okC = narr && narr.length>=5;
  if(!(okA&&okB&&okC)){ console.error('FAIL: T11 year lab',okA,okB,okC); process.exitCode=1; }
  else console.log('T11 year ok: pressure M'+(o.firstPressure?o.firstPressure.month:'-')+
    ' new@('+o.proposal.x+','+o.proposal.y+') saved $'+Math.round(o.saved)+
    ' ('+Math.round(o.totalYearBase)+'->'+Math.round(o.totalYearNew)+')');
})();
