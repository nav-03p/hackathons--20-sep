#pragma once
#include "s_clust.h"
#include <random>
#include <chrono>
namespace wlo {
inline bool betterSol(const Solution& a,const Solution& b){
    double pa=a.unserved.empty()?0:1e9*(double)a.unserved.size();
    double pb=b.unserved.empty()?0:1e9*(double)b.unserved.size();
    if((a.totalCost+pa)!=(b.totalCost+pb)) return a.totalCost+pa<b.totalCost+pb;
    return a.openWarehouses.size()<b.openWarehouses.size();
}
inline std::vector<int> openIdx(const Solution& s,const std::vector<Candidate>& M){
    std::vector<int> o;
    for(auto& id:s.openWarehouses)
        for(size_t j=0;j<M.size();j++) if(M[j].id==id) o.push_back((int)j);
    return o;
}
inline Solution solveLocalSearch(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const Params& p, const Matrices& mx) {
    auto t0=std::chrono::steady_clock::now();
    Solution cur=solveGreedy(N,M,p,mx); cur.algorithmUsed="localsearch";
    std::vector<int> open=openIdx(cur,M);
    bool imp=true; int guard=0;
    while(imp && guard++<200){
        imp=false;
        for(size_t a=0;a<open.size() && !imp;a++)
            for(size_t j=0;j<M.size() && !imp;j++){
                if(hasOpen(open,(int)j))continue;
                auto t=open; t[a]=(int)j;
                if(!openFeasible(M,t,p))continue;
                Solution s=assignGreedy(N,M,t,p,mx,"localsearch");
                if(betterSol(s,cur)){cur=s;open=t;imp=true;}
            }
        if(!imp && (int)open.size()<p.maxWarehouses)
            for(size_t j=0;j<M.size() && !imp;j++){
                if(hasOpen(open,(int)j))continue;
                auto t=open; t.push_back((int)j);
                if(!openFeasible(M,t,p))continue;
                Solution s=assignGreedy(N,M,t,p,mx,"localsearch");
                if(betterSol(s,cur)){cur=s;open=t;imp=true;}
            }
        if(!imp && (int)open.size()>p.minWarehouses)
            for(size_t a=0;a<open.size() && !imp;a++){
                auto t=open; t.erase(t.begin()+a);
                if(!openFeasible(M,t,p))continue;
                Solution s=assignGreedy(N,M,t,p,mx,"localsearch");
                if(betterSol(s,cur)){cur=s;open=t;imp=true;}
            }
    }
    cur.algorithmUsed="localsearch"; cur.optimal=false;
    cur.note="Local search (add/drop/swap hill climb from greedy). True cost optimizer, heuristic.";
    auto t1=std::chrono::steady_clock::now();
    cur.runtimeMs=std::chrono::duration<double,std::milli>(t1-t0).count();
    return cur;
}
inline Solution solveAnnealing(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const Params& p, const Matrices& mx) {
    auto t0=std::chrono::steady_clock::now();
    std::mt19937 rng(p.randomSeed);
    Solution cur=solveGreedy(N,M,p,mx);
    std::vector<int> open=openIdx(cur,M);
    Solution best=cur;
    auto energy=[&](const Solution& s){
        return s.totalCost + (s.unserved.empty()?0:1e9*(double)s.unserved.size()); };
    double T=energy(cur)*0.05+1.0;
    std::uniform_real_distribution<double> ur(0,1);
    for(int it=0; it<p.saIterations; ++it){
        auto t=open; int mv=(int)(rng()%3);
        if(mv==0 && (int)t.size()<p.maxWarehouses){
            int j=(int)(rng()%M.size());
            if(!hasOpen(t,j)) t.push_back(j);
        } else if(mv==1 && (int)t.size()>p.minWarehouses && !t.empty()){
            t.erase(t.begin()+rng()%t.size());
        } else if(!t.empty()){
            int j=(int)(rng()%M.size());
            if(!hasOpen(t,j)) t[rng()%t.size()]=j;
        }
        if(t.empty()||!openFeasible(M,t,p)) continue;
        Solution s=assignGreedy(N,M,t,p,mx,"annealing");
        double dE=energy(s)-energy(cur);
        if(dE<0 || ur(rng)<std::exp(-dE/std::max(T,1e-9))){
            cur=s; open=t;
            if(energy(s)<energy(best)) best=s;
        }
        T*=0.995; if(T<1e-6) T=1e-6;
    }
    best.algorithmUsed="annealing"; best.optimal=false;
    best.note="Simulated annealing: escapes local optima via uphill moves. Heuristic.";
    auto t1=std::chrono::steady_clock::now();
    best.runtimeMs=std::chrono::duration<double,std::milli>(t1-t0).count();
    return best;
}
}
