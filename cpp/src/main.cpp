// wlopt — C++ optimization core. Problem JSON on stdin (or file arg),
// solution JSON on stdout. Pure STL + nlohmann/json (vendored).
#include "../include/json.hpp"
#include "../include/geo.h"
#include "../include/sim.h"
#include "../include/fulfill.h"
#include <iostream>
#include <fstream>
#include <sstream>
using json = nlohmann::json;
using namespace wlo;

static json solToJson(const Solution& s){
    json j;
    j["openWarehouses"]=s.openWarehouses;
    j["assignments"]=json::array();
    for(auto& a:s.assignments)
        j["assignments"].push_back({{"neighborhoodId",a.neighborhoodId},
            {"warehouseId",a.warehouseId},{"distance",a.distance},{"cost",a.cost}});
    j["unserved"]=s.unserved;
    j["deliveryCost"]=s.deliveryCost; j["fixedCost"]=s.fixedCost;
    j["totalCost"]=s.totalCost; j["avgDistance"]=s.avgDistance;
    j["loads"]=json::array();
    for(auto& l:s.loads) j["loads"].push_back({{"id",l.first},{"load",l.second}});
    j["utilization"]=json::array();
    for(auto& u:s.utilization) j["utilization"].push_back({{"id",u.first},{"u",u.second}});
    j["capacityViolations"]=s.capacityViolations;
    j["radiusViolations"]=s.radiusViolations;
    j["runtimeMs"]=s.runtimeMs; j["algorithmUsed"]=s.algorithmUsed;
    j["optimal"]=s.optimal; j["note"]=s.note;
    return j;
}
// ---- fulfillment layer JSON marshalling (fulfill.h owns the algorithms) ----
static json fulResultToJson(const FulfillResult& R){
    json j;
    j["allocations"]=json::array();
    for(auto& a:R.allocations)
        j["allocations"].push_back({
            {"orderId",a.orderId},{"productId",a.productId},{"destId",a.destId},
            {"warehouseId",a.warehouseId},{"qty",a.qty},{"distKm",a.distKm},
            {"transitHr",a.transitHr},{"handlingHr",a.handlingHr},{"etaHr",a.etaHr},
            {"lateHr",a.lateHr},{"deliveryCost",a.deliveryCost},
            {"shipmentCost",a.shipmentCost},{"handlingCost",a.handlingCost},
            {"latePenalty",a.latePenalty},{"totalCost",a.totalCost},{"score",a.score},
            {"priority",a.priority},{"split",a.split}});
    j["unfulfilled"]=json::array();
    for(auto& u:R.unfulfilled)
        j["unfulfilled"].push_back({{"orderId",u.orderId},{"productId",u.productId},
            {"qty",u.qty},{"reason",u.reason}});
    j["loads"]=json::array();
    for(auto& l:R.loads)
        j["loads"].push_back({{"id",l.id},{"units",l.units},{"capacity",l.capacity},
            {"usedPct",l.usedPct},{"orders",l.orders},{"stockUnits",l.stockUnits},
            {"laborHr",l.laborHr}});
    j["coverage"]=json::array();
    for(auto& c:R.coverage)
        j["coverage"].push_back({{"productId",c.productId},{"demandQty",c.demandQty},
            {"allocatedQty",c.allocatedQty},{"fillRate",c.fillRate}});
    j["totals"]={{"deliveryCost",R.totals.deliveryCost},
        {"shipmentCost",R.totals.shipmentCost},{"handlingCost",R.totals.handlingCost},
        {"latePenalty",R.totals.latePenalty},{"totalCost",R.totals.totalCost},
        {"avgTransitHr",R.totals.avgTransitHr},{"avgEtaHr",R.totals.avgEtaHr},
        {"onTimePct",R.totals.onTimePct},{"fillRate",R.totals.fillRate},
        {"lines",R.totals.lines},{"orders",R.totals.orders},
        {"shipments",R.totals.shipments},{"splits",R.totals.splits},
        {"consolidatedOrders",R.totals.consolidatedOrders},
        {"lateLines",R.totals.lateLines}};
    j["improvementMoves"]=R.improvementMoves;
    j["algorithmUsed"]=R.algorithmUsed; j["note"]=R.note;
    return j;
}
static std::map<std::string,double> numMap(const json& o){
    std::map<std::string,double> m;
    if(o.is_object())
        for(auto it=o.begin(); it!=o.end(); ++it)
            if(it.value().is_number()) m[it.key()]=it.value().get<double>();
    return m;
}

static FulfillParams parseFulfillParams(const json& J){
    json FJ=J.value("params",json::object());
    FulfillParams P;
    P.deliveryCostPerKm=FJ.value("deliveryCostPerKm",2.0);
    P.shipmentFixedCost=FJ.value("shipmentFixedCost",8.0);
    P.handlingCostPerUnit=FJ.value("handlingCostPerUnit",1.0);
    P.latePenaltyPerHr=FJ.value("latePenaltyPerHr",5.0);
    P.transferCostPerKmPerUnit=FJ.value("transferCostPerKmPerUnit",0.5);
    P.kmPerHour=FJ.value("kmPerHour",30.0);
    P.roadFactor=FJ.value("roadFactor",1.35);
    P.pickMinPerOrder=FJ.value("pickMinPerOrder",6.0);
    P.packMinPerOrder=FJ.value("packMinPerOrder",3.0);
    P.allowLate=FJ.value("allowLate",true);
    P.maxLateHr=FJ.value("maxLateHr",48.0);
    P.maxServiceRadius=FJ.value("maxServiceRadius",1e18);
    P.maxSplitShipments=FJ.value("maxSplitShipments",1);
    P.strategy=FJ.value("strategy",std::string("balanced"));
    P.speedWeight=FJ.value("speedWeight",0.0);
    P.distanceMetric=FJ.value("distanceMetric",std::string("road"));
    P.improvementPasses=FJ.value("improvementPasses",3);
    return P;
}
static std::vector<FulfillWarehouse> parseFulfillWarehouses(const json& J){
    std::vector<FulfillWarehouse> FW;
    for(auto& w:J.value("warehouses",json::array())){
        FulfillWarehouse fw;
        fw.id=w.value("id",std::string(""));
        fw.x=w.value("x",0.0); fw.y=w.value("y",0.0);
        fw.capacity=w.value("capacity",1e18);
        fw.storageM3=w.value("storageM3",1e18);
        fw.throughputPerHr=w.value("throughputPerHr",1e18);
        fw.handlingCostPerUnit=w.value("handlingCostPerUnit",0.0);
        fw.fixedOperatingCost=w.value("fixedOperatingCost",0.0);
        fw.open=w.value("open",true);
        if(w.find("stock")!=w.end()) fw.stock=numMap(w["stock"]);
        FW.push_back(fw);
    }
    return FW;
}
static std::vector<OrderLine> parseOrders(const json& J){
    std::vector<OrderLine> OL;
    for(auto& o:J.value("orders",json::array())){
        OrderLine L;
        L.orderId=o.value("orderId",o.value("id",std::string("")));
        L.productId=o.value("productId",std::string(""));
        L.destId=o.value("destId",o.value("customerId",std::string("")));
        L.x=o.value("x",0.0); L.y=o.value("y",0.0);
        L.qty=o.value("qty",1.0);
        L.weightKg=o.value("weightKg",0.0);
        L.volumeM3=o.value("volumeM3",0.0);
        L.deadlineHr=o.value("deadlineHr",24.0);
        L.unitValue=o.value("unitValue",0.0);
        L.priority=o.value("priority",0);
        OL.push_back(L);
    }
    return OL;
}
static std::vector<ProductInfo> parseProducts(const json& J){
    std::vector<ProductInfo> PI;
    for(auto& p:J.value("products",json::array())){
        ProductInfo q;
        q.id=p.value("id",std::string(""));
        q.unitValue=p.value("unitValue",0.0);
        q.volumeM3=p.value("volumeM3",0.0);
        q.weightKg=p.value("weightKg",0.0);
        q.holdingCostPerUnitDay=p.value("holdingCostPerUnitDay",0.0);
        PI.push_back(q);
    }
    return PI;
}
// demand is either [{"warehouseId":"W1","demand":{"P1":10}}] or {"W1":{"P1":10}}
static std::vector<WhDemand> parseDemand(const json& J){
    std::vector<WhDemand> WD;
    json dj=J.value("demand",json::array());
    if(dj.is_array()){
        for(auto& d:dj){
            WhDemand wd;
            wd.warehouseId=d.value("warehouseId",d.value("id",std::string("")));
            if(d.find("demand")!=d.end()) wd.demand=numMap(d["demand"]);
            WD.push_back(wd);
        }
    } else if(dj.is_object()){
        for(auto it=dj.begin(); it!=dj.end(); ++it){
            WhDemand wd; wd.warehouseId=it.key(); wd.demand=numMap(it.value());
            WD.push_back(wd);
        }
    }
    return WD;
}

int main(int argc, char** argv){
    std::ios::sync_with_stdio(false);
    std::string input;
    if(argc>1){
        std::ifstream f(argv[1]);
        std::stringstream ss; ss<<f.rdbuf(); input=ss.str();
    } else {
        std::stringstream ss; ss<<std::cin.rdbuf(); input=ss.str();
    }
    try{
        json J=json::parse(input);
        std::vector<Neighborhood> N; std::vector<Candidate> M; Params p;
        for(auto& n:J.value("neighborhoods",json::array()))
            N.push_back({n.value("id",""),n.value("x",0.0),
                n.value("y",0.0),n.value("demand",0.0)});
        for(auto& m:J.value("candidates",json::array()))
            M.push_back({m.value("id",""),m.value("x",0.0),m.value("y",0.0),
                m.value("fixedCost",0.0),m.value("capacity",1e18)});
        json P=J.value("params",json::object());
        p.deliveryCostPerKm=P.value("deliveryCostPerKm",2.0);
        p.maxServiceRadius=P.value("maxServiceRadius",1e18);
        p.minWarehouses=P.value("minWarehouses",1);
        p.maxWarehouses=P.value("maxWarehouses",3);
        p.budget=P.value("budget",1e18);
        p.distanceMetric=P.value("distanceMetric","euclidean");
        p.roadFactor=P.value("roadFactor",1.35);
        p.algorithm=P.value("algorithm","auto");
        p.randomSeed=P.value("randomSeed",42);
        p.saIterations=P.value("saIterations",8000);
        std::string mode=J.value("mode","optimize");
        Matrices mx=buildMatrices(N,M,p);
        json out;
        if(mode=="median"){
            auto med=weightedGeometricMedian(N);
            out["median"]={{"x",med.first},{"y",med.second}};
            out["weberCost"]=weberCost(N,med.first,med.second,p.deliveryCostPerKm);
            double cx=0,cy=0,sw=0;
            for(auto& n:N){cx+=n.x*n.demand;cy+=n.y*n.demand;sw+=n.demand;}
            if(sw>0){cx/=sw;cy/=sw;}
            out["centroid"]={{"x",cx},{"y",cy}};
            out["centroidCost"]=weberCost(N,cx,cy,p.deliveryCostPerKm);
            std::cout<<out.dump()<<std::endl; return 0;
        }
        if(mode=="compare"){
            std::vector<std::string> algos={"greedy","kmeans","kmedoids",
                "localsearch","annealing"};
            if(N.size()<=14 && M.size()<=10) algos.push_back("exact");
            out["results"]=json::array();
            for(auto& a:algos){
                Params q=p; q.algorithm=a;
                Solution s=solveDispatch(N,M,q,mx);
                out["results"].push_back(solToJson(s));
            }
            std::cout<<out.dump()<<std::endl; return 0;
        }
        if(mode=="simulate"){
            // accept both naming conventions: scenarios|samples, cv|variability
            int S=J.value("scenarios",J.value("samples",200));
            if(S<1) S=1; if(S>5000) S=5000;
            double cv=J.value("cv",0.25);
            std::string dist=J.value("dist",std::string("normal"));
            // demand growth: growthPct given in % (e.g. 15 => +15%)
            double growthMult=J.value("growthMult",
                1.0+J.value("growthPct",0.0)/100.0);
            SimOut r=simulate(N,M,p,S,cv,p.randomSeed,dist,growthMult);
            out["expectedTotal"]=r.expTotal; out["p90"]=r.p90;
            out["worst"]=r.worst; out["best"]=r.best;
            out["avgFixed"]=r.avgFixed; out["totals"]=r.totals;
            out["distribution"]=json::array();
            for(auto& d:r.distribution)
                out["distribution"].push_back({{"cost",d.first},{"density",d.second}});
            out["samples"]=S; out["dist"]=dist; out["cv"]=cv;
            out["growthMult"]=growthMult;
            out["formula"]="E[C]=sum_s P(s)*C_s (Monte Carlo, "+dist+" demand noise, growth x"+
                std::to_string(growthMult).substr(0,4)+")";
            out["note"]="Monte Carlo over "+std::to_string(S)+" scenarios with "+dist+
                " demand noise (CV "+std::to_string((int)(cv*100))+"%) and demand growth x"+
                std::to_string(growthMult).substr(0,4)+".";
            std::cout<<out.dump()<<std::endl; return 0;
        }
        if(mode=="sensitivity"){
            std::vector<double> fuels=J.value("fuelMultipliers",
                std::vector<double>{0.5,1.0,1.5,2.0});
            out["fuelSweep"]=json::array();
            for(double f:fuels){
                Params q=p; q.deliveryCostPerKm=p.deliveryCostPerKm*f;
                Matrices m2=buildMatrices(N,M,q);
                Solution s=solveDispatch(N,M,q,m2);
                out["fuelSweep"].push_back({{"mult",f},{"total",s.totalCost},
                    {"delivery",s.deliveryCost},{"fixed",s.fixedCost},
                    {"open",s.openWarehouses},{"algo",s.algorithmUsed}});
            }
            std::vector<double> grows=J.value("growthMultipliers",
                std::vector<double>{1.0,1.25,1.5,2.0});
            out["demandGrowth"]=json::array();
            for(double g:grows){
                auto N2=N;
                for(auto& n:N2) n.demand*=g;
                Matrices m2=buildMatrices(N2,M,p);
                Solution s=solveDispatch(N2,M,p,m2);
                out["demandGrowth"].push_back({{"mult",g},{"total",s.totalCost},
                    {"open",s.openWarehouses},{"algo",s.algorithmUsed}});
            }
            std::cout<<out.dump()<<std::endl; return 0;
        }
        // ---------- operational fulfillment layer (fulfill.h) ----------
        if(mode=="fulfill"){
            FulfillResult r=fulfillOrders(parseOrders(J),parseFulfillWarehouses(J),
                                          parseFulfillParams(J));
            std::cout<<fulResultToJson(r).dump()<<std::endl; return 0;
        }
        if(mode=="rebalance"){
            RebalanceResult r=rebalanceStock(parseFulfillWarehouses(J),parseDemand(J),
                                             parseFulfillParams(J));
            json o;
            o["moves"]=json::array();
            for(auto& m:r.moves)
                o["moves"].push_back({{"productId",m.productId},{"from",m.from},
                    {"to",m.to},{"qty",m.qty},{"distKm",m.distKm},{"cost",m.cost}});
            o["totalCost"]=r.totalCost; o["movedUnits"]=r.movedUnits;
            o["unmetDeficit"]=r.unmetDeficit;
            o["productsRebalanced"]=r.productsRebalanced;
            o["algorithmUsed"]=r.algorithmUsed; o["note"]=r.note;
            std::cout<<o.dump()<<std::endl; return 0;
        }
        if(mode=="storeopt"){
            StorageResult r=planStorage(parseFulfillWarehouses(J),parseDemand(J),
                                        parseProducts(J),J.value("defaultVolumeM3",0.01));
            json o;
            o["levels"]=json::array();
            for(auto& l:r.levels)
                o["levels"].push_back({{"warehouseId",l.warehouseId},
                    {"productId",l.productId},{"onHand",l.onHand},
                    {"expectedDemand",l.expectedDemand},{"recommended",l.recommended},
                    {"delta",l.delta},{"cycleStock",l.cycleStock},
                    {"safetyStock",l.safetyStock},{"reorderPoint",l.reorderPoint},
                    {"volumeUsed",l.volumeUsed},{"unitValue",l.unitValue},
                    {"valueDensity",l.valueDensity},{"holdingCost",l.holdingCost},
                    {"action",l.action}});
            o["expectedDemand"]=r.expectedDemand; o["expectedServed"]=r.expectedServed;
            o["coveragePct"]=r.coveragePct; o["volumeUsed"]=r.volumeUsed;
            o["volumeCapacity"]=r.volumeCapacity; o["cubeUtilPct"]=r.cubeUtilPct;
            o["holdingCostTotal"]=r.holdingCostTotal;
            o["underStocked"]=r.underStocked; o["excess"]=r.excess;
            o["algorithmUsed"]=r.algorithmUsed; o["note"]=r.note;
            std::cout<<o.dump()<<std::endl; return 0;
        }
        Solution s=solveDispatch(N,M,p,mx);
        out=solToJson(s);
        if(J.value("marginal",false)){
            out["marginal"]=json::array();
            for(int k=p.minWarehouses;k<=p.maxWarehouses;k++){
                Params q=p; q.minWarehouses=k; q.maxWarehouses=k;
                Solution sk=solveDispatch(N,M,q,mx);
                out["marginal"].push_back({{"k",k},{"total",sk.totalCost},
                    {"delivery",sk.deliveryCost},{"fixed",sk.fixedCost},
                    {"open",sk.openWarehouses}});
            }
        }
        if(N.size()<=25 && M.size()<=12){
            out["costMatrix"]=json::array();
            for(size_t i=0;i<N.size();i++){
                json row=json::array();
                for(size_t j=0;j<M.size();j++) row.push_back(mx.c[i][j]);
                out["costMatrix"].push_back(row);
            }
        }
        std::cout<<out.dump()<<std::endl; return 0;
    } catch(std::exception& e){
        std::cerr<<"wlopt error: "<<e.what()<<std::endl; return 1;
    }
}
