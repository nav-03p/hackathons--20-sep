#pragma once
#include "s_greedy.h"
#include <random>
#include <chrono>
#include <set>
namespace wlo {
inline Solution solveKMeans(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const Params& p, const Matrices& mx) {
    auto t0=std::chrono::steady_clock::now();
    int K = std::max(p.minWarehouses, std::min(p.maxWarehouses,(int)M.size()));
    std::mt19937 rng(p.randomSeed);
    std::vector<std::pair<double,double>> cent;
    std::uniform_int_distribution<size_t> uni(0,N.size()-1);
    cent.push_back({N[uni(rng)].x, N[uni(rng)].y});
    while((int)cent.size()<K){
        std::vector<double> d2(N.size(),INF);
        for(size_t i=0;i<N.size();i++)
            for(auto& c:cent){
                double d=euclid(N[i].x,N[i].y,c.first,c.second);
                d2[i]=std::min(d2[i],d*d);
            }
        std::vector<double> w(N.size()); double ws=0;
        for(size_t i=0;i<N.size();i++){ w[i]=d2[i]*N[i].demand; ws+=w[i]; }
        std::uniform_real_distribution<double> ur(0,ws>0?ws:1.0);
        double r=ur(rng); size_t pick=0;
        for(size_t i=0;i<N.size();i++){ r-=w[i]; if(r<=0){pick=i;break;} }
        cent.push_back({N[pick].x,N[pick].y});
    }
    std::vector<int> lab(N.size(),0);
    for(int it=0;it<100;it++){
        bool ch=false;
        for(size_t i=0;i<N.size();i++){
            int b=0; double bd=INF;
            for(int k=0;k<K;k++){
                double d=euclid(N[i].x,N[i].y,cent[k].first,cent[k].second);
                if(d<bd){bd=d;b=k;}
            }
            if(b!=lab[i]){lab[i]=b;ch=true;}
        }
        for(int k=0;k<K;k++){
            double sx=0,sy=0,sw=0;
            for(size_t i=0;i<N.size();i++) if(lab[i]==k){
                sx+=N[i].x*N[i].demand;sy+=N[i].y*N[i].demand;sw+=N[i].demand;}
            if(sw>0){cent[k]={sx/sw,sy/sw};}
        }
        if(!ch)break;
    }
    std::vector<int> open; std::set<int> used;
    for(int k=0;k<K;k++){
        int b=-1; double bd=INF;
        for(size_t j=0;j<M.size();j++){
            if(used.count((int)j))continue;
            double d=euclid(cent[k].first,cent[k].second,M[j].x,M[j].y);
            if(d<bd){bd=d;b=(int)j;}
        }
        if(b>=0){open.push_back(b);used.insert(b);}
    }
    Solution s=assignGreedy(N,M,open,p,mx,"kmeans");
    s.optimal=false;
    s.note="K-Means is CLUSTERING not optimization: ignores fixed costs/capacity/radius.";
    auto t1=std::chrono::steady_clock::now();
    s.runtimeMs=std::chrono::duration<double,std::milli>(t1-t0).count();
    return s;
}
inline Solution solveKMedoids(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const Params& p, const Matrices& mx) {
    auto t0=std::chrono::steady_clock::now();
    int K = std::max(p.minWarehouses, std::min(p.maxWarehouses,(int)M.size()));
    std::mt19937 rng(p.randomSeed);
    std::vector<int> med, perm(M.size());
    for(size_t i=0;i<perm.size();i++) perm[i]=(int)i;
    std::shuffle(perm.begin(),perm.end(),rng);
    for(int k=0;k<K && k<(int)perm.size();k++) med.push_back(perm[k]);
    auto pamCost=[&](const std::vector<int>& md)->double{
        double s=0;
        for(size_t i=0;i<N.size();i++){
            double b=INF;
            for(int j:md) b=std::min(b,mx.c[i][j]);
            s+=b;
        }
        return s;
    };
    double cur=pamCost(med);
    for(int sw=0;sw<50;sw++){
        bool imp=false;
        for(size_t a=0;a<med.size();a++) for(size_t j=0;j<M.size();j++){
            if(hasOpen(med,(int)j)) continue;
            auto t=med; t[a]=(int)j; double c=pamCost(t);
            if(c<cur-1e-9){med=t;cur=c;imp=true;}
        }
        if(!imp)break;
    }
    Solution s=assignGreedy(N,M,med,p,mx,"kmedoids");
    s.optimal=false;
    s.note="K-Medoids/PAM: centers on candidates, ignores fixed costs/capacity. Baseline.";
    auto t1=std::chrono::steady_clock::now();
    s.runtimeMs=std::chrono::duration<double,std::milli>(t1-t0).count();
    return s;
}
} // namespace
