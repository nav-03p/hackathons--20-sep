#pragma once
#include "s_ls.h"
#include <functional>
namespace wlo {
// Exact assignment for fixed open set: DFS branch-and-bound (demand desc).
inline Solution exactAssign(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const std::vector<int>& open,
    const Params& p, const Matrices& mx, double incumb, bool& feas) {
    int n=(int)N.size();
    std::vector<int> order(n);
    for(int i=0;i<n;i++) order[i]=i;
    std::sort(order.begin(),order.end(),
        [&](int a,int b){return N[a].demand>N[b].demand;});
    std::vector<double> lb(n,INF);
    for(int k=0;k<n;k++){
        int i=order[k]; double b=INF;
        for(int j:open)
            if(mx.d[i][j]<=p.maxServiceRadius+1e-9) b=std::min(b,mx.c[i][j]);
        lb[k]=b;
    }
    std::vector<double> suf(n+1,0);
    for(int k=n-1;k>=0;k--) suf[k]=suf[k+1]+(lb[k]>=INF/2?1e12:lb[k]);
    double fixed=openFixedCost(M,open);
    std::vector<double> load(M.size(),0);
    std::vector<int> asn(n,-1), bestA(n,-1);
    double bestC=INF; feas=false;
    std::function<void(int,double)> dfs=[&](int k,double acc){
        double bound=acc+suf[k]+fixed;
        double lim=std::min(bestC,incumb);
        if(bound>=lim-1e-9) return;
        if(k==n){ bestC=acc; bestA=asn; feas=true; return; }
        int i=order[k];
        std::vector<int> opts=open;
        std::sort(opts.begin(),opts.end(),
            [&](int a,int b){return mx.c[i][a]<mx.c[i][b];});
        for(int j:opts){
            if(mx.d[i][j]>p.maxServiceRadius+1e-9) continue;
            if(load[j]+N[i].demand>M[j].capacity+1e-9) continue;
            load[j]+=N[i].demand; asn[k]=j;
            dfs(k+1,acc+mx.c[i][j]);
            load[j]-=N[i].demand; asn[k]=-1;
        }
    };
    dfs(0,0);
    Solution s; s.algorithmUsed="exact";
    for(int j:open) s.openWarehouses.push_back(M[j].id);
    if(!feas){
        for(auto& nn:N) s.unserved.push_back(nn.id);
        s.totalCost=INF; return s;
    }
    for(int k=0;k<n;k++){
        int i=order[k], j=bestA[k];
        s.assignments.push_back({N[i].id,M[j].id,mx.d[i][j],mx.c[i][j]});
    }
    score(s,N,M,p,mx);
    return s;
}
inline Solution solveExact(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const Params& p, const Matrices& mx) {
    auto t0=std::chrono::steady_clock::now();
    if (N.size()>14 || M.size()>10){
        Solution s=solveLocalSearch(N,M,p,mx);
        s.algorithmUsed="exact"; s.optimal=false;
        s.note="EXACT refused: n>14 or m>10 too large; local-search result, NOT optimal.";
        auto t1=std::chrono::steady_clock::now();
        s.runtimeMs=std::chrono::duration<double,std::milli>(t1-t0).count();
        return s;
    }
    int m=(int)M.size();
    Solution best; best.totalCost=INF; bool any=false;
    double incumb=INF;
    for(int k=p.minWarehouses;k<=std::min(p.maxWarehouses,m);k++){
        std::vector<int> comb(k);
        for(int i=0;i<k;i++) comb[i]=i;
        auto handle=[&]{
            if(!openFeasible(M,comb,p)) return;
            bool feas=false;
            Solution s=exactAssign(N,M,comb,p,mx,incumb,feas);
            if(feas && s.totalCost<incumb-1e-9){ incumb=s.totalCost; best=s; any=true; }
        };
        handle();
        while(true){
            int i=k-1;
            for(;i>=0 && comb[i]==m-k+i;i--){}
            if(i<0)break;
            comb[i]++;
            for(int l=i+1;l<k;l++) comb[l]=comb[l-1]+1;
            handle();
        }
    }
    auto t1=std::chrono::steady_clock::now();
    if(!any){
        best=Solution(); best.algorithmUsed="exact"; best.totalCost=INF;
        for(auto& nn:N) best.unserved.push_back(nn.id);
        best.note="EXACT: no feasible solution under constraints.";
        best.runtimeMs=std::chrono::duration<double,std::milli>(t1-t0).count();
        return best;
    }
    best.algorithmUsed="exact"; best.optimal=true;
    best.note="EXACT branch-and-bound: globally optimal for discrete candidates.";
    best.runtimeMs=std::chrono::duration<double,std::milli>(t1-t0).count();
    return best;
}
inline Solution solveAuto(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, const Params& p, const Matrices& mx) {
    if (N.size()<=14 && M.size()<=10) return solveExact(N,M,p,mx);
    if (N.size()<=60) return solveLocalSearch(N,M,p,mx);
    return solveAnnealing(N,M,p,mx);
}
inline Solution solveDispatch(const std::vector<Neighborhood>& N,
    const std::vector<Candidate>& M, Params p, const Matrices& mx) {
    if (p.algorithm=="greedy") return solveGreedy(N,M,p,mx);
    if (p.algorithm=="kmeans") return solveKMeans(N,M,p,mx);
    if (p.algorithm=="kmedoids") return solveKMedoids(N,M,p,mx);
    if (p.algorithm=="localsearch") return solveLocalSearch(N,M,p,mx);
    if (p.algorithm=="annealing") return solveAnnealing(N,M,p,mx);
    if (p.algorithm=="exact") return solveExact(N,M,p,mx);
    return solveAuto(N,M,p,mx);
}
} // namespace
