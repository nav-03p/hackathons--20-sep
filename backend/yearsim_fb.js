// auto-extracted template narrator (fallback)
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

module.exports={templateNarr:templateNarr};
