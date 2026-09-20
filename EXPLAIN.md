### How the delivery recommendation is calculated (exactly)

It is **NOT AI.** It is a deterministic, per-warehouse cost formula in C++
(`cpp/include/fulfill.h`, function `fulEval`) combined with a hard feasibility
filter. Same inputs -> same answer every time (good for ops).

For every (order-line, warehouse) pair the engine does:

  1. Feasibility (hard filters, in order):
     - site closed?            -> reject  (reason: "site closed")
     - road_km > radius(60km)? -> reject  (reason: "outside N km service radius")
     - stock_available = 0?    -> reject  (reason: "out of stock (on hand .., reserved ..)")
     - stock_available < qty?  -> reject  (reason: "short: only X of Y available")
     - !allowLate && ETA > due?-> reject  (reason: "cannot meet due time")
     Survivors are "feasible".

  2. Cost (landed cost per line):
     distance   = straight_line_km * roadFactor   (roadFactor default 1.35)
     transit_hr = distance / kmPerHour            (kmPerHour default 28)
     handling   = pick_min + pack_min + qty/throughput      (6 + 3 min + processing)
     eta_hr     = transit_hr + handling
     late_hr    = max(0, eta_hr - due_hr)           // only if late and allowLate
     delivery   = distance * deliveryCostPerKm     (default $2.00 / km)
     shipment   = shipmentFixedCost                (default $9 / shipment)
     handling_c = qty * handlingCostPerUnit        (per-warehouse rate)
     late_pen   = late_hr * latePenaltyPerHr       (default $12 / hr)

     total = delivery + shipment + handling_c + late_pen

  3. Strategy weight (turns time into money) is added to total:
     - balanced : 1 hr of ETA ~ $10   -> score += (eta_hr * 10)     (default)
     - speed    : 1 hr of ETA ~ $25   -> score += (eta_hr * 25)
     - cost     : 1 hr of ETA ~ $0    -> score += (eta_hr * 0)
     express   : +$5 / hr  ;  critical : +$12 / hr  (urgency bias toward nearer docks)

  4. Pick = lowest total score among feasible docks = the "OPTIMAL" tag.
     Ties break on lower ETA. Infeasible docks are listed with the exact
     rejection reason in "Why this dock".

  5. After picking the dock, Node.js:
     - chooses the dispatch wave: express/critical -> earliest safe wave; standard -> latest safe wave;
     - packs stops into vans (best-fit by capacity),
     - routes each trip nearest-neighbour + 2-opt (dock->stops->dock loop),
     - computes the real routed ETA you see on the map.

  Availability shown on the warehouse/customer map is live per run:
     available = on_hand - reserved        (incoming_by_due is shown as "+N")

### Static vs dynamic

| Component              | Static or live?            |
|------------------------|----------------------------|
| The cost formula       | Static (C++: distance, transit, handling, late, shipment, strategy weight) |
| Inputs                 | Dynamic - warehouses + stock + waves fetched from Supabase `wlo_warehouses` (or `data/warehouses.json`); orders, stock, inbound replenishments come from the live plan |
| Recommendation         | Recomputed fresh on every "Run plan" / "Optimize area for me" |
| Map / ETA dates        | Rendered live (ETA hours -> today's date at display time) |
| Warehouses themselves  | Dynamic - stored in Supabase `wlo_warehouses`; the Warehouses page edits them and they persist |

### Bangalore 40-site / 560-customer dataset (namit@gmail.com)

The Namit account (`password 12345678`) loads a 40-warehouse, 560-customer
scenario seeded by `seedBangalore40(seed=501)` in `backend/whstore.js`.
Warehouses are written into Supabase `wlo_warehouses` (or
`data/warehouses.json` when Supabase is unconfigured) so edits persist and the
map re-runs against the current registry.
