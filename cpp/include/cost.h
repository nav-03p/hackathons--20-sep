#pragma once
#include "types.h"

namespace wlo {

// ---- distance matrix D[i][j] between neighborhood i and candidate j ----
inline double dist(const Neighborhood& a, const Candidate& b, const Params& p) {
    double d = (p.distanceMetric=="manhattan")
        ? manhattan(a.x,a.y,b.x,b.y) : euclid(a.x,a.y,b.x,b.y);
    if (p.distanceMetric=="road") d *= p.roadFactor; // road ≈ euclidean × circuity factor
    return d;
}

// delivery cost of serving ALL of neighborhood i from candidate j
inline double deliveryCost(const Neighborhood& a, const Candidate& b, const Params& p) {
    return a.demand * dist(a,b,p) * p.deliveryCostPerKm;
}

// Build full cost + distance matrices
struct Matrices { std::vector<std::vector<double>> d, c; };
inline Matrices buildMatrices(const std::vector<Neighborhood>& N,
                              const std::vector<Candidate>& M, const Params& p) {
    Matrices m; m.d.assign(N.size(), std::vector<double>(M.size(),0));
    m.c.assign(N.size(), std::vector<double>(M.size(),0));
    for (size_t i=0;i<N.size();i++) for (size_t j=0;j<M.size();j++){
        m.d[i][j]=dist(N[i],M[j],p); m.c[i][j]=N[i].demand*m.d[i][j]*p.deliveryCostPerKm;
    }
    return m;
}

// Score a solution (fills costs). capacity/radius violations counted.
inline void score(Solution& s, const std::vector<Neighborhood>& N,
                  const std::vector<Candidate>& M, const Params& p,
                  const Matrices& mx) {
    s.deliveryCost=0; s.fixedCost=0; s.avgDistance=0;
    s.capacityViolations=0; s.radiusViolations=0;
    std::vector<double> load(M.size(),0);
    std::vector<int> idxM(M.size(),0);
    for (size_t j=0;j<M.size();j++) idxM[j]=(int)j;
    auto findJ=[&](const std::string& id)->int{
        for(size_t j=0;j<M.size();j++) if(M[j].id==id) return (int)j; return -1; };
    auto findI=[&](const std::string& id)->int{
        for(size_t i=0;i<N.size();i++) if(N[i].id==id) return (int)i; return -1; };
    double dsum=0; int cnt=0;
    for (auto& a: s.assignments){ int i=findI(a.neighborhoodId), j=findJ(a.warehouseId);
        if(i<0||j<0) continue; a.distance=mx.d[i][j]; a.cost=mx.c[i][j];
        s.deliveryCost+=a.cost; dsum+=a.distance; cnt++; load[j]+=N[i].demand;
        if (mx.d[i][j] > p.maxServiceRadius + 1e-9) s.radiusViolations++;
    }
    for (auto& wid: s.openWarehouses){ int j=findJ(wid);
        if(j>=0){ s.fixedCost+=M[j].fixedCost; if(load[j] > M[j].capacity+1e-9) s.capacityViolations++; } }
    s.avgDistance = cnt? dsum/cnt : 0;
    s.totalCost = s.deliveryCost + s.fixedCost;
    s.loads.clear(); s.utilization.clear();
    for (auto& wid: s.openWarehouses){ int j=findJ(wid);
        if(j>=0){ s.loads.push_back({wid, load[j]});
            s.utilization.push_back({wid, M[j].capacity>0? load[j]/M[j].capacity : 0}); } }
}

} // namespace wlo
