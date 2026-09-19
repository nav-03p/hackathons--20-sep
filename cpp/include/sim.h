// Monte Carlo demand simulation + sensitivity (Poisson/Normal scenarios)
#pragma once
#include "s_exact.h"
#include <random>
namespace wlo {
struct SimOut { double expTotal=0, p90=0, worst=0, best=0, avgFixed=0; std::vector<double> totals; };
inline SimOut simulate(const std::vector<Neighborhood>& N0,
    const std::vector<Candidate>& M, Params p, int S, double cv, int seed) {
    std::mt19937 rng(seed);
    SimOut o;
    for(int s=0;s<S;s++){
        auto N=N0;
        for(auto& n:N){
            // Normal perturbation ~ N(demand, cv*demand), floor at 1
            std::normal_distribution<double> nd(n.demand, std::max(1.0,n.demand*cv));
            // Poisson-style discreteness for small demand via rounding
            double v = std::max(1.0, std::round(nd(rng)));
            n.demand=v;
        }
        Matrices mx=buildMatrices(N,M,p);
        Solution sol=solveDispatch(N,M,p,mx);
        o.totals.push_back(sol.totalCost);
        o.avgFixed+=sol.fixedCost;
    }
    if(o.totals.empty()) return o;
    std::sort(o.totals.begin(),o.totals.end());
    double sum=0; for(double v:o.totals) sum+=v;
    o.expTotal=sum/o.totals.size();
    o.best=o.totals.front(); o.worst=o.totals.back();
    o.p90=o.totals[(size_t)(0.9*(o.totals.size()-1))];
    o.avgFixed/=o.totals.size();
    return o;
}
} // namespace
