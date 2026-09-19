// Validation tests: run C++ core on 8 required evaluation scenarios.
const { runWlopt, genData } = require('../backend/server.js');
function assert(c,m){ if(!c){ console.error('FAIL:',m); process.exitCode=1; } }
function P(o){ return Object.assign({deliveryCostPerKm:2,maxServiceRadius:1e9,
  minWarehouses:1,maxWarehouses:3,distanceMetric:'euclidean',roadFactor:1.35,
  algorithm:'auto',randomSeed:42,saIterations:3000}, o||{}); }
function mk(nb,cd,params,extra){
  return Object.assign({neighborhoods:nb,candidates:cd,params:params},extra||{});
}
(function(){
  // 1. uniform demand, single warehouse (roomy capacity => feasible)
  let d=genData({neighborhoods:10,candidates:4,seed:1,mode:'uniform',capacity:4000});
  d.candidates.forEach(function(c){c.capacity=4000;});
  let s=runWlopt(mk(d.neighborhoods,d.candidates,P({minWarehouses:1,maxWarehouses:1,algorithm:'exact',maxServiceRadius:1e9})));
  assert(s.optimal, 'T1 exact optimal'); assert(s.unserved.length===0,'T1 served');
  console.log('T1 ok total='+Math.round(s.totalCost));
  // 2. concentrated demand pulls median
  let N=[{id:'A',x:0,y:0,demand:1000},{id:'B',x:100,y:0,demand:10},{id:'C',x:0,y:100,demand:10}];
  let med=runWlopt({neighborhoods:N,candidates:[{id:'W1',x:50,y:50,fixedCost:0,capacity:1e9}],params:P(),mode:'median'});
  assert(med.median.x<30&&med.median.y<30,'T2 median near heavy node '+JSON.stringify(med.median));
  assert(med.weberCost<=med.centroidCost+1e-6,'T2 median beats centroid');
  console.log('T2 ok median=',med.median);
  // 3. capacity forces multi-warehouse (total demand 1200, each cap 500)
  N=[{id:'N1',x:0,y:0,demand:400},{id:'N2',x:1,y:0,demand:400},{id:'N3',x:99,y:0,demand:400}];
  C=[{id:'W1',x:0,y:0,fixedCost:100,capacity:800},{id:'W2',x:99,y:0,fixedCost:100,capacity:800},
     {id:'W3',x:50,y:0,fixedCost:100,capacity:800}];
  s=runWlopt(mk(N,C,P({minWarehouses:1,maxWarehouses:3,algorithm:'exact',maxServiceRadius:200})));
  assert(s.unserved.length===0,'T3 all served, unserved='+s.unserved);
  assert(s.optimal,'T3 optimal');
  console.log('T3 ok open='+s.openWarehouses);
  // 4. strict radius -> unserved (correct: solver reports infeasible coverage)
  let s4=runWlopt(mk(N,C,P({minWarehouses:1,maxWarehouses:2,algorithm:'exact',maxServiceRadius:0.5})));
  assert(s4.unserved.length>0,'T4 unserved expected');
  console.log('T4 ok unserved='+s4.unserved.length);
  // 5. demand growth shifts solution (compare open sets or cost jump)
  let d5=genData({neighborhoods:14,candidates:5,seed:5,mode:'mixed',capacity:4000});
  let sA=runWlopt(mk(d5.neighborhoods,d5.candidates,P({algorithm:'localsearch'})));
  let N2=d5.neighborhoods.map(function(n){return {id:n.id,x:n.x,y:n.y,
    demand: n.x>60&&n.y<45? n.demand*3 : n.demand};});
  let sB=runWlopt(mk(N2,d5.candidates,P({algorithm:'localsearch'})));
  assert(sB.totalCost>sA.totalCost,'T5 growth raises cost');
  console.log('T5 ok',Math.round(sA.totalCost),'->',Math.round(sB.totalCost));
  // 6. fuel sweep monotonic
  let sens=runWlopt(mk(d5.neighborhoods,d5.candidates,P({algorithm:'greedy'}),
    {mode:'sensitivity',fuelMultipliers:[0.5,1,2],growthMultipliers:[1]}));
  assert(sens.fuelSweep[0].total<=sens.fuelSweep[2].total,'T6 fuel monotonic');
  console.log('T6 ok');
  // 7. road vs euclidean
  let e=runWlopt(mk(d5.neighborhoods,d5.candidates,P({algorithm:'greedy',distanceMetric:'euclidean'})));
  let r=runWlopt(mk(d5.neighborhoods,d5.candidates,P({algorithm:'greedy',distanceMetric:'road',roadFactor:1.35})));
  assert(r.deliveryCost>e.deliveryCost,'T7 road costs more');
  console.log('T7 ok');
  // 8. scalability: 200 neighborhoods
  let big=genData({neighborhoods:200,candidates:12,seed:9,mode:'mixed'});
  let t0=Date.now();
  let sb=runWlopt(mk(big.neighborhoods,big.candidates,P({algorithm:'annealing',saIterations:1500})));
  console.log('T8 ok n=200 ms='+(Date.now()-t0)+' total='+Math.round(sb.totalCost));
  // compare includes exact on small
  let cmp=runWlopt(mk(d.neighborhoods.slice(0,8),d.candidates.slice(0,4),
    P({minWarehouses:1,maxWarehouses:2}),{mode:'compare'}));
  assert(cmp.results.length>=5,'T9 compare count');
  console.log('T9 compare ok:',cmp.results.map(function(x){return x.algorithmUsed+':'+Math.round(x.totalCost);}).join(' '));
  // simulate
  let sm=runWlopt(mk(d5.neighborhoods,d5.candidates,P({algorithm:'greedy'}),
    {mode:'simulate',scenarios:50,cv:0.25}));
  assert(sm.expectedTotal>0&&sm.totals.length===50,'T10 sim');
  console.log('T10 sim ok E='+Math.round(sm.expectedTotal));
  console.log('ALL TESTS DONE (exit '+(process.exitCode||0)+')');
})();
