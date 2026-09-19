#pragma once
#include "types.h"
#include <numeric>
namespace wlo {
// Weiszfeld algorithm for weighted geometric median (Fermat-Weber):
//   min_{x,y} sum_i D_i * sqrt((x-xi)^2+(y-yi)^2)
// Geometric median > mean because it minimizes sum of DISTANCES (robust to
// outliers, true delivery-cost minimizer), while mean minimizes sum of SQUARED
// distances. With demand weights, high-demand nodes pull the median toward them
// proportionally to demand, not demand^2.
inline std::pair<double,double> weightedGeometricMedian(
    const std::vector<Neighborhood>& N, int maxIter=1000, double tol=1e-9) {
    if (N.empty()) return {0,0};
    double sx=0, sy=0, sw=0;
    for (auto& n: N){ sx+=n.x*n.demand; sy+=n.y*n.demand; sw+=n.demand; }
    double x = sw>0? sx/sw : N[0].x, y = sw>0? sy/sw : N[0].y; // demand centroid start
    for (int it=0; it<maxIter; ++it){
        double numx=0, numy=0, den=0; bool coincident=false;
        for (auto& n: N){
            double d = euclid(x,y,n.x,n.y);
            if (d < 1e-12){ coincident=true; break; } // at a demand point: subgradient case
            double w = n.demand / d;
            numx += w*n.x; numy += w*n.y; den += w;
        }
        if (coincident || den==0) break;
        double nx=numx/den, ny=numy/den;
        if (euclid(x,y,nx,ny) < tol){ x=nx; y=ny; break; }
        x=nx; y=ny;
    }
    return {x,y};
}
inline double weberCost(const std::vector<Neighborhood>& N, double x, double y, double c=1.0){
    double s=0; for(auto& n:N) s+=n.demand*euclid(x,y,n.x,n.y)*c; return s;
}
} // namespace wlo
