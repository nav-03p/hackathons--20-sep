#pragma once
#include "types.h"
#include <map>
#include <set>
#include <vector>
#include <string>
#include <algorithm>
#include <cmath>

// ============================================================================
// fulfill.h — OPERATIONAL fulfillment layer, stacked on the strategic layer.
//
//   types.h / s_*.h  solve PLANNING : "WHERE should we build warehouses?"
//                                    (monthly, demand aggregated per neighborhood)
//   fulfill.h        solves EXECUTION: "WHICH warehouse ships THIS order line,
//                                    WHEN does it dispatch, HOW is stock
//                                    rebalanced, WHAT should each site hold?"
//                                    (per order, per SKU, per vehicle)
//
// Three solvers, pure STL (JSON marshalling stays in src/main.cpp, mirroring
// s_greedy.h / s_ls.h / s_exact.h):
//   1. fulfillOrders()  generalized assignment of order lines to warehouses
//                       (stock / capacity / radius / deadline), split shipments,
//                       1-opt relocation improvement.
//   2. rebalanceStock() transportation problem per SKU (surplus -> deficit),
//                       Vogel's approximation.
//   3. planStorage()    fractional-knapsack capacity allocation per site
//                       (max value x served s.t. cubic capacity) + safety stock.
// ============================================================================

namespace wlo {

// ---------------------------------------------------------------- inputs ----

// One order LINE = one SKU inside an order (orders are grouped by orderId).
struct OrderLine {
    std::string orderId, productId, destId;
    double x = 0, y = 0;        // delivery destination (customer)
    double qty = 0;             // units requested
    double weightKg = 0;        // total line weight
    double volumeM3 = 0;        // total line volume
    double deadlineHr = 24.0;   // hours from now the customer must receive it
    double unitValue = 0;       // selling price per unit (margin-aware scoring)
    int    priority = 0;        // 0 normal | 1 express | 2 critical
};

// A fulfillment node: existing warehouse/dark-store with real stock on shelf.
struct FulfillWarehouse {
    std::string id;
    double x = 0, y = 0;
    double capacity = 1e18;         // units shippable in this planning window
    double storageM3 = 1e18;        // cubic storage capacity
    double throughputPerHr = 1e18;  // units pickable per hour (labour limit)
    double handlingCostPerUnit = 0; // $ per unit picked/packed
    double fixedOperatingCost = 0;  // $ per day if this site is used at all
    bool   open = true;
    std::map<std::string, double> stock; // productId -> units available
};

struct ProductInfo {
    std::string id;
    double unitValue = 0;   // $ per unit
    double volumeM3 = 0;    // m3 per unit (0 => use default)
    double weightKg = 0;
    double holdingCostPerUnitDay = 0;
};

// Expected demand per product, per warehouse service area (storage planning).
struct WhDemand {
    std::string warehouseId;
    std::map<std::string, double> demand;
};

struct FulfillParams {
    // money
    double deliveryCostPerKm   = 2.0;   // $ per km per unit shipped
    double shipmentFixedCost   = 8.0;   // $ paid once per shipment (splitting cost)
    double handlingCostPerUnit = 1.0;   // fallback $ per unit if a site has none
    double latePenaltyPerHr    = 5.0;   // $ per hour of late delivery
    double transferCostPerKmPerUnit = 0.5; // $ per unit per km to rebalance stock
    // time
    double kmPerHour      = 30.0;       // average vehicle speed
    double roadFactor     = 1.35;       // straight-line -> road distance
    double pickMinPerOrder = 6.0;       // fixed pick time per shipment (min)
    double packMinPerOrder = 3.0;       // fixed pack time per shipment (min)
    // service
    bool   allowLate   = true;          // false => hard-reject late lines
    double maxLateHr   = 48.0;          // reject anything later than this
    double maxServiceRadius = 1e18;     // km
    // structure
    int    maxSplitShipments = 1;       // max warehouses per order line
    std::string strategy = "balanced";  // cost | speed | balanced | green
    double speedWeight = 0;             // $/hr of transit; 0 => strategy default
    std::string distanceMetric = "road";// euclidean | manhattan | road
    int    improvementPasses = 3;       // 1-opt relocation sweeps
};

// --------------------------------------------------------------- helpers ----

inline double fulDist(double x1, double y1, double x2, double y2,
                      const std::string& metric, double roadFactor) {
    if (metric == "manhattan") return manhattan(x1, y1, x2, y2);
    if (metric == "road")      return euclid(x1, y1, x2, y2) * roadFactor;
    return euclid(x1, y1, x2, y2);
}

// Strategy -> how many $ an hour of transit is worth when ranking options.
// "cost" ignores time entirely; "speed" will pay a lot to cut ETA; "green"
// mildly penalises distance because fuel/CO2 scale with km.
inline double fulfillEtaWeight(const FulfillParams& P) {
    if (P.strategy == "cost")  return 0.0;
    if (P.speedWeight > 0)     return P.speedWeight;
    if (P.strategy == "speed") return 25.0;
    if (P.strategy == "green") return 6.0;
    return 10.0; // balanced
}

inline double fulfillScore(double cost, double etaHr, const FulfillParams& P) {
    return cost + fulfillEtaWeight(P) * etaHr;
}

// -------------------------------------------------------------- outputs ----

struct Allocation {
    std::string orderId, productId, destId, warehouseId;
    double qty = 0, distKm = 0, transitHr = 0, handlingHr = 0, etaHr = 0, lateHr = 0;
    double deliveryCost = 0, shipmentCost = 0, handlingCost = 0;
    double latePenalty = 0, totalCost = 0, score = 0;
    int    priority = 0;
    bool   split = false;   // true if the line was broken across warehouses
};

struct Unfulfilled { std::string orderId, productId, reason; double qty = 0; };

struct WhLoad {
    std::string id;
    double units = 0, capacity = 0, usedPct = 0, orders = 0;
    double stockUnits = 0, laborHr = 0;
};

struct ProductCoverage {
    std::string productId;
    double demandQty = 0, allocatedQty = 0, fillRate = 0;
};

struct FulfillTotals {
    double deliveryCost = 0, shipmentCost = 0, handlingCost = 0;
    double latePenalty = 0, totalCost = 0;
    double avgTransitHr = 0, avgEtaHr = 0;
    double onTimePct = 100.0, fillRate = 100.0;
    int    lines = 0, orders = 0, shipments = 0, splits = 0;
    int    consolidatedOrders = 0, lateLines = 0;
};

struct FulfillResult {
    std::vector<Allocation>      allocations;
    std::vector<Unfulfilled>     unfulfilled;
    std::vector<WhLoad>          loads;
    std::vector<ProductCoverage> coverage;
    FulfillTotals totals;
    int improvementMoves = 0;
    std::string algorithmUsed, note;
};

// Candidate evaluation: one (order line, warehouse) pair.
struct FulCand {
    int    j = -1;
    double dist = 0, transit = 0, handling = 0, eta = 0, late = 0, score = 1e100;
    bool   ok = false;
    std::string why;
};

inline FulCand fulEval(const OrderLine& L, double qty, size_t j,
                       const std::vector<FulfillWarehouse>& W,
                       const std::vector<double>& cap,
                       const std::vector<std::map<std::string,double> >& stock,
                       const FulfillParams& P)
{
    FulCand k; k.j = (int)j;
    const FulfillWarehouse& w = W[j];
    if (!w.open) { k.why = "site closed"; return k; }
    k.dist = fulDist(L.x, L.y, w.x, w.y, P.distanceMetric, P.roadFactor);
    if (k.dist > P.maxServiceRadius + 1e-9) { k.why = "outside service radius"; return k; }
    double avail = 0;
    if (stock[j].count(L.productId)) avail = stock[j].find(L.productId)->second;
    if (avail <= 1e-9) { k.why = "no stock of " + L.productId; return k; }
    if (cap[j] <= 1e-9) { k.why = "capacity exhausted"; return k; }

    k.transit = P.kmPerHour > 0 ? k.dist / P.kmPerHour : 0.0;
    double thru = (w.throughputPerHr > 0) ? w.throughputPerHr : 1e18;
    k.handling = (P.pickMinPerOrder + P.packMinPerOrder +
                  (thru < 1e17 ? (qty / thru) * 60.0 : 0.0)) / 60.0;
    k.eta  = k.transit + k.handling;
    k.late = std::max(0.0, k.eta - L.deadlineHr);
    if (!P.allowLate && k.late > 1e-9) { k.why = "deadline unreachable"; return k; }
    if (k.late > P.maxLateHr + 1e-9)   { k.why = "later than max late window"; return k; }

    double hand = (w.handlingCostPerUnit > 0) ? w.handlingCostPerUnit
                                              : P.handlingCostPerUnit;
    double cost = qty * k.dist * P.deliveryCostPerKm
                + P.shipmentFixedCost
                + qty * hand
                + (k.late > 0 ? P.latePenaltyPerHr * k.late : 0.0);
    // express/critical lines value time more than the strategy default says.
    double bias = (L.priority >= 2 ? 12.0 : (L.priority == 1 ? 5.0 : 0.0));
    k.score = fulfillScore(cost, k.eta, P) + bias * k.eta;
    k.ok = true; k.why = "ok";
    return k;
}

inline void fulApply(Allocation& A, const OrderLine& L, double qty, size_t j,
                     double dist, const std::vector<FulfillWarehouse>& W,
                     const FulfillParams& P, bool split)
{
    const FulfillWarehouse& w = W[j];
    double thru = (w.throughputPerHr > 0) ? w.throughputPerHr : 1e18;
    A.orderId = L.orderId; A.productId = L.productId; A.destId = L.destId;
    A.warehouseId = w.id; A.qty = qty; A.distKm = dist;
    A.transitHr  = P.kmPerHour > 0 ? dist / P.kmPerHour : 0.0;
    A.handlingHr = (P.pickMinPerOrder + P.packMinPerOrder +
                    (thru < 1e17 ? (qty / thru) * 60.0 : 0.0)) / 60.0;
    A.etaHr  = A.transitHr + A.handlingHr;
    A.lateHr = std::max(0.0, A.etaHr - L.deadlineHr);
    A.deliveryCost = qty * dist * P.deliveryCostPerKm;
    A.shipmentCost = P.shipmentFixedCost;
    double hand = (w.handlingCostPerUnit > 0) ? w.handlingCostPerUnit
                                              : P.handlingCostPerUnit;
    A.handlingCost = qty * hand;
    A.latePenalty  = A.lateHr > 0 ? P.latePenaltyPerHr * A.lateHr : 0.0;
    A.totalCost    = A.deliveryCost + A.shipmentCost + A.handlingCost + A.latePenalty;
    A.priority     = L.priority;
    A.split        = split;
    double bias = (L.priority >= 2 ? 12.0 : (L.priority == 1 ? 5.0 : 0.0));
    A.score = fulfillScore(A.totalCost, A.etaHr, P) + bias * A.etaHr;
}

// ============================================================================
// 1. ORDER ALLOCATION — which warehouse ships each order line?
// ============================================================================
// Generalised Assignment Problem (NP-hard): lines -> warehouses under stock,
// per-site capacity, service radius and deadline constraints. We solve it with
// a priority-aware greedy fill (so express/critical demand claims scarce stock
// first) followed by a bounded 1-opt relocation sweep.
inline FulfillResult fulfillOrders(const std::vector<OrderLine>& lines,
                                   const std::vector<FulfillWarehouse>& W,
                                   const FulfillParams& P)
{
    FulfillResult R;
    size_t nw = W.size();
    std::vector<std::map<std::string,double> > stock(nw);
    std::vector<double> cap(nw, 0.0);
    for (size_t j = 0; j < nw; ++j) { stock[j] = W[j].stock; cap[j] = W[j].capacity; }

    // 1. Sequence lines: critical/express first, then tightest deadline, then
    //    biggest demand.
    std::vector<size_t> seq(lines.size());
    for (size_t i = 0; i < lines.size(); ++i) seq[i] = i;
    std::sort(seq.begin(), seq.end(), [&](size_t a, size_t b) {
        if (lines[a].priority != lines[b].priority)
            return lines[a].priority > lines[b].priority;
        if (std::fabs(lines[a].deadlineHr - lines[b].deadlineHr) > 1e-9)
            return lines[a].deadlineHr < lines[b].deadlineHr;
        return lines[a].qty > lines[b].qty;
    });

    std::vector<int>    owner;    // line index per allocation
    std::vector<size_t> allocWh;  // warehouse index per allocation

    // 2. Greedy cheapest-feasible fill, splitting across at most
    //    maxSplitShipments sites when a single site cannot cover the line.
    for (size_t si = 0; si < seq.size(); ++si) {
        const OrderLine& L = lines[seq[si]];
        double need = L.qty;
        int used = 0;
        int maxSplits = std::max(1, P.maxSplitShipments);
        while (need > 1e-9 && used < maxSplits) {
            std::vector<FulCand> cands;
            cands.reserve(nw);
            for (size_t j = 0; j < nw; ++j)
                cands.push_back(fulEval(L, need, j, W, cap, stock, P));
            std::sort(cands.begin(), cands.end(),
                      [](const FulCand& a, const FulCand& b) {
                          if (a.ok != b.ok) return a.ok > b.ok;
                          return a.score < b.score;
                      });
            bool took = false;
            for (size_t ci = 0; ci < cands.size(); ++ci) {
                const FulCand& k = cands[ci];
                if (!k.ok) continue;
                size_t j = (size_t)k.j;
                double avail = stock[j].count(L.productId)
                             ? stock[j].find(L.productId)->second : 0.0;
                double take = std::min(need, std::min(avail, cap[j]));
                if (take <= 1e-9) continue;
                Allocation A;
                bool split = (used > 0) || (need - take > 1e-9);
                fulApply(A, L, take, j, k.dist, W, P, split);
                stock[j][L.productId] -= take;
                cap[j] -= take;
                R.allocations.push_back(A);
                owner.push_back((int)seq[si]);
                allocWh.push_back(j);
                need -= take; ++used; took = true;
                break; // re-rank candidates for the remaining quantity
            }
            if (!took) break;
        }
        if (need > 1e-9) {
            Unfulfilled U; U.orderId = L.orderId; U.productId = L.productId; U.qty = need;
            bool inRadius = false, anyStock = false, anyCap = false;
            for (size_t j = 0; j < nw; ++j) {
                if (!W[j].open) continue;
                double d = fulDist(L.x, L.y, W[j].x, W[j].y, P.distanceMetric, P.roadFactor);
                if (d <= P.maxServiceRadius + 1e-9) inRadius = true;
                double s = stock[j].count(L.productId)
                         ? stock[j].find(L.productId)->second : 0.0;
                if (s > 1e-9) anyStock = true;
                if (cap[j] > 1e-9) anyCap = true;
            }
            if (!anyStock)      U.reason = "out_of_stock";
            else if (!inRadius) U.reason = "no_warehouse_in_radius";
            else if (!anyCap)   U.reason = "capacity_full";
            else                U.reason = "split_limit_or_deadline";
            R.unfulfilled.push_back(U);
        }
    }

    // 3. Improvement sweep: relocate whole allocations when a different site
    //    scores better. This also merges an order back onto one dock, killing a
    //    shipment fixed cost each time it succeeds.
    bool runImprove = (R.allocations.size() * std::max<size_t>(1, nw) <= 200000);
    if (runImprove) {
        for (int pass = 0; pass < std::max(0, P.improvementPasses); ++pass) {
            bool moved = false;
            for (size_t a = 0; a < R.allocations.size(); ++a) {
                Allocation& A = R.allocations[a];
                const OrderLine& L = lines[owner[a]];
                size_t cur = allocWh[a];
                double best = A.score; size_t bestJ = cur;
                for (size_t j = 0; j < nw; ++j) {
                    if (j == cur) continue;
                    // shadow availability: give this allocation's own units back
                    std::vector<double> cap2 = cap;
                    std::vector<std::map<std::string,double> > st2 = stock;
                    cap2[cur] += A.qty;
                    st2[cur][L.productId] += A.qty;
                    FulCand k = fulEval(L, A.qty, j, W, cap2, st2, P);
                    if (!k.ok) continue;
                    if (k.score < best - 1e-9) { best = k.score; bestJ = j; }
                }
                if (bestJ != cur) {
                    cap[cur] += A.qty; stock[cur][L.productId] += A.qty;
                    cap[bestJ] -= A.qty; stock[bestJ][L.productId] -= A.qty;
                    double d = fulDist(L.x, L.y, W[bestJ].x, W[bestJ].y,
                                       P.distanceMetric, P.roadFactor);
                    fulApply(A, L, A.qty, bestJ, d, W, P, A.split);
                    allocWh[a] = bestJ; ++R.improvementMoves; moved = true;
                }
            }
            if (!moved) break;
        }
    }

    // 4. Roll-ups: totals, per-site load, per-SKU coverage.
    std::map<std::string, std::set<std::string> > whOrders, orderWhs;
    std::map<std::string, int> lineKeys;
    std::map<std::string, double> prodDemand, prodAlloc;
    for (size_t i = 0; i < lines.size(); ++i) {
        prodDemand[lines[i].productId] += lines[i].qty;
        lineKeys[lines[i].orderId + "|" + lines[i].productId] = 1;
    }
    double sumTransit = 0, sumEta = 0;
    for (size_t i = 0; i < R.allocations.size(); ++i) {
        const Allocation& A = R.allocations[i];
        R.totals.deliveryCost += A.deliveryCost;
        R.totals.shipmentCost += A.shipmentCost;
        R.totals.handlingCost += A.handlingCost;
        R.totals.latePenalty  += A.latePenalty;
        R.totals.totalCost    += A.totalCost;
        ++R.totals.shipments;
        if (A.split)         ++R.totals.splits;
        if (A.lateHr > 1e-9) ++R.totals.lateLines;
        sumTransit += A.transitHr; sumEta += A.etaHr;
        whOrders[A.warehouseId].insert(A.orderId);
        orderWhs[A.orderId].insert(A.warehouseId);
        prodAlloc[A.productId] += A.qty;
    }
    R.totals.lines  = (int)lineKeys.size();
    R.totals.orders = (int)orderWhs.size();
    for (std::map<std::string, std::set<std::string> >::iterator it = orderWhs.begin();
         it != orderWhs.end(); ++it)
        if (it->second.size() == 1) ++R.totals.consolidatedOrders;
    size_t n = R.allocations.size();
    if (n) {
        R.totals.avgTransitHr = sumTransit / (double)n;
        R.totals.avgEtaHr     = sumEta / (double)n;
        R.totals.onTimePct    = 100.0 * (1.0 - (double)R.totals.lateLines / (double)n);
    }
    double demTotal = 0, alcTotal = 0;
    for (std::map<std::string,double>::iterator it = prodDemand.begin(); it != prodDemand.end(); ++it) demTotal += it->second;
    for (std::map<std::string,double>::iterator it = prodAlloc.begin(); it != prodAlloc.end(); ++it) alcTotal += it->second;
    if (demTotal > 1e-9) R.totals.fillRate = 100.0 * alcTotal / demTotal;
    for (std::map<std::string,double>::iterator it = prodDemand.begin(); it != prodDemand.end(); ++it) {
        ProductCoverage c; c.productId = it->first; c.demandQty = it->second;
        c.allocatedQty = prodAlloc.count(it->first) ? prodAlloc.find(it->first)->second : 0.0;
        c.fillRate = (it->second > 1e-9) ? 100.0 * c.allocatedQty / it->second : 100.0;
        R.coverage.push_back(c);
    }
    for (size_t j = 0; j < nw; ++j) {
        WhLoad Ld; Ld.id = W[j].id; Ld.capacity = W[j].capacity;
        double u = 0, lab = 0;
        for (size_t i = 0; i < n; ++i) if (allocWh[i] == j) u += R.allocations[i].qty;
        if (W[j].throughputPerHr > 0 && W[j].throughputPerHr < 1e17)
            for (size_t i = 0; i < n; ++i)
                if (allocWh[i] == j) lab += R.allocations[i].qty / W[j].throughputPerHr;
        Ld.units = u; Ld.laborHr = lab;
        Ld.usedPct = (W[j].capacity > 0 && W[j].capacity < 1e17) ? 100.0 * u / W[j].capacity : 0.0;
        Ld.orders = (double)whOrders[W[j].id].size();
        double st = 0;
        for (std::map<std::string,double>::iterator it = stock[j].begin(); it != stock[j].end(); ++it) st += it->second;
        Ld.stockUnits = st;
        if (u > 0 || W[j].open) R.loads.push_back(Ld);
    }
    R.algorithmUsed = std::string("priority-greedy(express-first) + ") +
                      (runImprove ? "1-opt relocation" : "no-improve (large instance)");
    R.note = "Lines are ranked express/critical first, then by tightest deadline, so scarce stock goes "
             "to the customers who paid for speed. Every candidate site is scored on landed cost "
             "(units x km x rate + shipment fee + pick/pack) plus strategy-weighted ETA, and must pass "
             "stock, capacity, radius and deadline checks. Splitting an order costs another shipment fee, "
             "so it only happens when one site genuinely cannot cover the line.";
    return R;
}

// ============================================================================
// 2. STOCK REBALANCING — move SKUs from surplus sites to deficit sites
// ============================================================================
// Per SKU this is a Transportation Problem: minimise Σ units x distance x rate
// subject to supply (stock above expected demand) and demand (deficit). Solved
// with Vogel's approximation: repeatedly saturate the cheapest lane of the row
// or column with the largest regret (2nd-best minus best cost), which is what
// keeps the result within a few percent of the LP optimum in practice.
struct Move { std::string productId, from, to; double qty = 0, distKm = 0, cost = 0; };

struct RebalanceResult {
    std::vector<Move> moves;
    double totalCost = 0, movedUnits = 0, unmetDeficit = 0;
    int    productsRebalanced = 0;
    std::string algorithmUsed, note;
};

inline RebalanceResult rebalanceStock(const std::vector<FulfillWarehouse>& W,
                                      const std::vector<WhDemand>& D,
                                      const FulfillParams& P)
{
    RebalanceResult R;
    R.algorithmUsed = "Vogel-approximation transportation problem (per SKU)";
    size_t nw = W.size();
    std::map<std::string, std::map<std::string,double> > dem;
    for (size_t d = 0; d < D.size(); ++d) dem[D[d].warehouseId] = D[d].demand;

    std::set<std::string> prods;
    for (size_t j = 0; j < nw; ++j) {
        for (std::map<std::string,double>::const_iterator it = W[j].stock.begin(); it != W[j].stock.end(); ++it)
            if (it->second > 0) prods.insert(it->first);
        if (dem.count(W[j].id))
            for (std::map<std::string,double>::iterator it = dem[W[j].id].begin(); it != dem[W[j].id].end(); ++it)
                if (it->second > 0) prods.insert(it->first);
    }

    for (std::set<std::string>::iterator pit = prods.begin(); pit != prods.end(); ++pit) {
        const std::string pr = *pit;
        std::vector<size_t> srcW, snkW;
        std::vector<double> srcQ, snkQ;
        for (size_t j = 0; j < nw; ++j) {
            if (!W[j].open) continue;
            double s = W[j].stock.count(pr) ? W[j].stock.find(pr)->second : 0.0;
            double d = 0;
            if (dem.count(W[j].id) && dem[W[j].id].count(pr))
                d = dem[W[j].id].find(pr)->second;
            if (s - d > 1e-9)      { srcW.push_back(j); srcQ.push_back(s - d); }
            else if (d - s > 1e-9) { snkW.push_back(j); snkQ.push_back(d - s); }
        }
        if (snkW.empty()) continue;                       // nobody needs it: leave as is
        if (srcW.empty()) {                               // demand that no site can cover
            for (size_t k = 0; k < snkQ.size(); ++k) R.unmetDeficit += snkQ[k];
            continue;
        }

        size_t ns = srcW.size(), nd = snkW.size();
        std::vector<std::vector<double> > c(ns, std::vector<double>(nd, 1e100));
        for (size_t i = 0; i < ns; ++i)
            for (size_t k = 0; k < nd; ++k) {
                double dist = fulDist(W[srcW[i]].x, W[srcW[i]].y, W[snkW[k]].x, W[snkW[k]].y,
                                      P.distanceMetric, P.roadFactor);
                c[i][k] = dist * P.transferCostPerKmPerUnit;
            }

        std::vector<double> remS = srcQ, remD = snkQ;
        std::vector<char> rowDone(ns, 0), colDone(nd, 0);
        int guard = 0, maxIter = (int)(ns * nd) + (int)(ns + nd) + 8;
        while (guard++ < maxIter) {
            double bestPen = -1.0; int bestI = -1, bestK = -1;
            for (size_t i = 0; i < ns; ++i) {                     // row regret
                if (rowDone[i] || remS[i] <= 1e-9) continue;
                double b1 = 1e100, b2 = 1e100; int k1 = -1;
                for (size_t k = 0; k < nd; ++k) {
                    if (colDone[k] || remD[k] <= 1e-9) continue;
                    if (c[i][k] < b1) { b2 = b1; b1 = c[i][k]; k1 = (int)k; }
                    else if (c[i][k] < b2) b2 = c[i][k];
                }
                if (k1 < 0) continue;
                double pen = (b2 >= 1e99) ? 0.0 : (b2 - b1);
                if (pen > bestPen) { bestPen = pen; bestI = (int)i; bestK = k1; }
            }
            for (size_t k = 0; k < nd; ++k) {                     // column regret
                if (colDone[k] || remD[k] <= 1e-9) continue;
                double b1 = 1e100, b2 = 1e100; int i1 = -1;
                for (size_t i = 0; i < ns; ++i) {
                    if (rowDone[i] || remS[i] <= 1e-9) continue;
                    if (c[i][k] < b1) { b2 = b1; b1 = c[i][k]; i1 = (int)i; }
                    else if (c[i][k] < b2) b2 = c[i][k];
                }
                if (i1 < 0) continue;
                double pen = (b2 >= 1e99) ? 0.0 : (b2 - b1);
                if (pen > bestPen) { bestPen = pen; bestI = i1; bestK = (int)k; }
            }
            if (bestI < 0 || bestK < 0) break;
            double qty = std::min(remS[bestI], remD[bestK]);
            if (qty <= 1e-9) break;
            Move M;
            M.productId = pr;
            M.from = W[srcW[bestI]].id; M.to = W[snkW[bestK]].id;
            M.qty = qty;
            M.distKm = fulDist(W[srcW[bestI]].x, W[srcW[bestI]].y,
                               W[snkW[bestK]].x, W[snkW[bestK]].y,
                               P.distanceMetric, P.roadFactor);
            M.cost = c[bestI][bestK] * qty;
            R.moves.push_back(M);
            R.totalCost += M.cost; R.movedUnits += qty;
            remS[bestI] -= qty; remD[bestK] -= qty;
            if (remS[bestI] <= 1e-9) rowDone[bestI] = 1;
            if (remD[bestK] <= 1e-9) colDone[bestK] = 1;
        }
        for (size_t k = 0; k < nd; ++k) if (remD[k] > 1e-9) R.unmetDeficit += remD[k];
        ++R.productsRebalanced;
    }
    R.note = "Sources = stock above expected demand, sinks = stock below expected demand. "
             "Transfers are costed at $/unit/km and only the cheapest feasible lanes are used. "
             "Run the storage plan first to get the expected-demand targets this consumes.";
    return R;
}

// ============================================================================
// 3. STORAGE OPTIMIZATION — how much of each SKU should each site hold?
// ============================================================================
// Per site: maximise Σ unitValue x unitsServed subject to Σ units x m3 <= cube.
// Greedily filling the highest $/m3 SKU first IS the optimal solution of the
// fractional-knapsack LP relaxation, so the returned plan is provably optimal
// for the relaxation (and integral, since units are divisible in a plan).
// Alongside each level we report cycle stock, safety stock and the reorder point.
struct StorageLevel {
    std::string warehouseId, productId;
    double onHand = 0, expectedDemand = 0, recommended = 0, delta = 0;
    double cycleStock = 0, safetyStock = 0, reorderPoint = 0;
    double volumeUsed = 0, unitValue = 0, valueDensity = 0, holdingCost = 0;
    std::string action; // restock | hold | excess | capacity_limited
};

struct StorageResult {
    std::vector<StorageLevel> levels;
    double expectedDemand = 0, expectedServed = 0, coveragePct = 0;
    double volumeUsed = 0, volumeCapacity = 0, cubeUtilPct = 0, holdingCostTotal = 0;
    std::vector<std::string> underStocked, excess;
    std::string algorithmUsed, note;
};

inline StorageResult planStorage(const std::vector<FulfillWarehouse>& W,
                                 const std::vector<WhDemand>& D,
                                 const std::vector<ProductInfo>& products,
                                 double defaultVolumeM3 = 0.01)
{
    StorageResult R;
    R.algorithmUsed = "fractional knapsack by value density (LP-optimal) + safety stock";
    std::map<std::string, ProductInfo> pinfo;
    for (size_t i = 0; i < products.size(); ++i) pinfo[products[i].id] = products[i];
    std::map<std::string, std::map<std::string,double> > dem;
    for (size_t d = 0; d < D.size(); ++d) dem[D[d].warehouseId] = D[d].demand;

    for (size_t j = 0; j < W.size(); ++j) {
        const FulfillWarehouse& w = W[j];
        if (!w.open) continue;
        std::map<std::string,double> want;
        if (dem.count(w.id)) want = dem[w.id];
        for (std::map<std::string,double>::const_iterator it = w.stock.begin(); it != w.stock.end(); ++it)
            if (!want.count(it->first)) want[it->first] = 0.0;

        std::vector<std::pair<double,std::string> > rank;   // value density, SKU
        for (std::map<std::string,double>::iterator it = want.begin(); it != want.end(); ++it) {
            const std::string& pid = it->first;
            double vu  = pinfo.count(pid) ? pinfo[pid].unitValue : 0.0;
            double vol = (pinfo.count(pid) && pinfo[pid].volumeM3 > 0)
                       ? pinfo[pid].volumeM3 : defaultVolumeM3;
            double dens = (vol > 1e-12) ? vu / vol : vu * 1000.0;
            rank.push_back(std::make_pair(dens, pid));
        }
        std::sort(rank.begin(), rank.end(),
                  [](const std::pair<double,std::string>& a,
                     const std::pair<double,std::string>& b) { return a.first > b.first; });

        double remaining = w.storageM3;
        for (size_t r = 0; r < rank.size(); ++r) {
            const std::string pid = rank[r].second;
            double demand = want.count(pid) ? want[pid] : 0.0;
            double vol  = (pinfo.count(pid) && pinfo[pid].volumeM3 > 0)
                        ? pinfo[pid].volumeM3 : defaultVolumeM3;
            double vu   = pinfo.count(pid) ? pinfo[pid].unitValue : 0.0;
            double hold = pinfo.count(pid) ? pinfo[pid].holdingCostPerUnitDay : 0.0;
            double onHand = w.stock.count(pid) ? w.stock.find(pid)->second : 0.0;

            double fit = (vol > 1e-12) ? remaining / vol : demand;
            double rec = std::max(0.0, std::min(demand, fit));
            remaining -= rec * vol;

            StorageLevel L;
            L.warehouseId = w.id; L.productId = pid;
            L.onHand = onHand; L.expectedDemand = demand; L.recommended = rec;
            L.delta = rec - onHand;
            L.cycleStock  = demand;                      // one horizon of cover
            L.safetyStock = std::ceil(0.25 * demand);    // ~1.65 sigma at cv=15%
            L.reorderPoint = L.safetyStock + 0.3 * demand; // ~2 days cover
            L.volumeUsed = rec * vol; L.unitValue = vu;
            L.valueDensity = (vol > 1e-12) ? vu / vol : 0.0;
            L.holdingCost = hold * rec;
            if (rec + 1e-9 < demand)      L.action = "capacity_limited";
            else if (L.delta > 1e-9)      L.action = "restock";
            else if (L.delta < -1e-9)     L.action = "excess";
            else                          L.action = "hold";
            R.levels.push_back(L);
            R.volumeUsed += L.volumeUsed;
            R.expectedDemand += demand; R.expectedServed += rec;
            R.holdingCostTotal += L.holdingCost;
            if (L.action == "restock" || L.action == "capacity_limited")
                R.underStocked.push_back(w.id + ":" + pid);
            if (L.action == "excess") R.excess.push_back(w.id + ":" + pid);
        }
        R.volumeCapacity += w.storageM3;
    }
    if (R.expectedDemand > 1e-9) R.coveragePct = 100.0 * R.expectedServed / R.expectedDemand;
    if (R.volumeCapacity > 1e-12) R.cubeUtilPct = 100.0 * R.volumeUsed / R.volumeCapacity;
    R.note = "Each site fills its cubic capacity with the highest $/m3 SKUs first, which is the "
             "greedy optimum of the fractional-knapsack LP relaxation. SKUs marked capacity_limited "
             "cannot be covered at this site and are the candidates for a new site or a rebalance.";
    return R;
}

} // namespace wlo
