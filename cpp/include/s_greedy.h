#pragma once
#include "cost.h"
#include <random>
#include <chrono>
#include <numeric>
namespace wlo {
inline Solution assignGreedy(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const std::vector<int>& open,
    const Params& p, const Matrices& mx, const std::string& algo) {
    Solution s; s.algorithmUsed = algo;
    for (int j: open) s.openWarehouses.push_back(M[j].id);
    std::vector<double> load(M.size(), 0.0);
    std::vector<int> order(N.size());
    for (size_t i=0;i<order.size();i++) order[i]=(int)i;
    std::sort(order.begin(), order.end(),
        [&](int a,int b){return N[a].demand>N[b].demand;});
    for (int i: order) {
        int best=-1; double bc=INF;
        for (int j: open) {
            if (mx.d[i][j] > p.maxServiceRadius + 1e-9) continue;
            if (load[j] + N[i].demand > M[j].capacity + 1e-9) continue;
            if (mx.c[i][j] < bc){ bc=mx.c[i][j]; best=j; }
        }
        if (best<0){ s.unserved.push_back(N[i].id); continue; }
        load[best]+=N[i].demand;
        s.assignments.push_back({N[i].id, M[best].id, mx.d[i][best], mx.c[i][best]});
    }
    score(s,N,M,p,mx);
    return s;
}
inline double openFixedCost(const std::vector<Candidate>& M, const std::vector<int>& open){
    double f=0; for(int j:open) f+=M[j].fixedCost; return f;
}
inline bool openFeasible(const std::vector<Candidate>& M, const std::vector<int>& open, const Params& p){
    if ((int)open.size()<p.minWarehouses) return false;
    if ((int)open.size()>p.maxWarehouses) return false;
    if (openFixedCost(M,open) > p.budget + 1e-9) return false;
    return true;
}
inline bool hasOpen(const std::vector<int>& o,int j){
    for(int v:o) if(v==j) return true; return false;
}
inline Solution solveGreedy(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const Params& p, const Matrices& mx) {
    auto t0=std::chrono::steady_clock::now();
    std::vector<int> open;
    for (int k=0;k<p.maxWarehouses;k++){
        int bj=-1; double bb=INF;
        for (size_t j=0;j<M.size();j++){
            if(hasOpen(open,(int)j)) continue;
            auto trial=open; trial.push_back((int)j);
            if((int)trial.size()>p.maxWarehouses) continue;
            if(openFixedCost(M,trial)>p.budget+1e-9) continue;
            Solution s=assignGreedy(N,M,trial,p,mx,"greedy");
            double pen = s.unserved.empty()?0:1e9*(double)s.unserved.size();
            if (s.totalCost+pen < bb){ bb=s.totalCost+pen; bj=(int)j; }
        }
        if (bj<0) break;
        open.push_back(bj);
    }
    while ((int)open.size()<p.minWarehouses){
        int bj=-1; double bf=INF;
        for(size_t j=0;j<M.size();j++){
            if(hasOpen(open,(int)j)) continue;
            if(M[j].fixedCost<bf){bf=M[j].fixedCost;bj=(int)j;}
        }
        if(bj<0)break; open.push_back(bj);
    }
    Solution best=assignGreedy(N,M,open,p,mx,"greedy");
    best.optimal=false;
    best.note="Greedy: opens max-saving warehouse each step. Fast, local optima possible.";
    auto t1=std::chrono::steady_clock::now();
    best.runtimeMs=std::chrono::duration<double,std::milli>(t1-t0).count();
    return best;
}
} // namespace
