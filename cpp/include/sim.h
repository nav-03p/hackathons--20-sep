// Monte Carlo demand simulation + sensitivity (Poisson/Normal scenarios)
#pragma once
#include "s_exact.h"
#include <random>
namespace wlo {
struct SimOut { double expTotal=0, p90=0, worst=0, best=0, avgFixed=0; std::vector<double> totals;
    // histogram: first = bin centre cost, second = probability density (count/S)
    std::vector<std::pair<double,double>> distribution; };

// One stochastic draw of every neighborhood's demand.
// dist: normal | lognormal | uniform | poisson. growthMult scales the mean.
inline double drawDemand(std::mt19937& rng, double mean, double cv, const std::string& dist){
    double m = std::max(1.0, mean);
    if(dist=="lognormal"){
        double sigma2=std::log(1.0+cv*cv);
        std::lognormal_distribution<double> ld(std::log(m)-sigma2/2.0, std::sqrt(sigma2));
        return std::max(1.0, std::round(ld(rng)));
    }
    if(dist=="uniform"){
        std::uniform_real_distribution<double> ud(m*(1.0-cv), m*(1.0+cv));
        return std::max(1.0, std::round(ud(rng)));
    }
    if(dist=="poisson"){
        std::poisson_distribution<long long> pd(m);
        return std::max(1.0, (double)pd(rng));
    }
    // default: normal ~ N(m, cv*m), floored at 1
    std::normal_distribution<double> nd(m, std::max(1.0, m*cv));
    return std::max(1.0, std::round(nd(rng)));
}

inline SimOut simulate(const std::vector<Neighborhood>& N0,
    const std::vector<Candidate>& M, Params p, int S, double cv, int seed,
    const std::string& dist="normal", double growthMult=1.0) {
    std::mt19937 rng(seed);
    SimOut o;
    for(int s=0;s<S;s++){
        auto N=N0;
        for(auto& n:N){
            // mean demand scaled by growth multiplier, then stochastic noise
            n.demand=drawDemand(rng, n.demand*growthMult, cv, dist);
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
    // histogram of the cost distribution (~40 bins or 1 per sample, whichever is smaller)
    {
        int bins=(int)std::min<size_t>(40, o.totals.size());
        double lo=o.totals.front(), hi=o.totals.back();
        double w=(hi>lo)?(hi-lo)/bins:1.0;
        std::vector<int> counts(bins,0);
        for(double v:o.totals){
            int b=(hi>lo)?(int)((v-lo)/w):0;
            if(b>=bins) b=bins-1;
            counts[b]++;
        }
        for(int b=0;b<bins;b++){
            double centre=(hi>lo)?lo+(b+0.5)*w:lo;
            o.distribution.push_back({centre,(double)counts[b]/o.totals.size()});
        }
    }
    return o;
}
} // namespace
