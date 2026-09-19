# 📦 Intelligent Warehouse Location Optimizer — “Where Should the Warehouse Go?”

Full-stack OR platform: **Node.js (logic/API, zero npm deps)** + **C++17 (all optimization math)** + static dashboard (Leaflet + Chart.js).

## Architecture

```
browser (Leaflet map + Chart.js + params UI)
   │  JSON over HTTP
Node.js backend/server.js  (NO npm install needed — stdlib only)
   │  spawns ./cpp/wlopt with problem JSON on stdin
C++ core  cpp/src/main.cpp + include/*.h   (ALL algorithms live here)
```

| Layer | Files | Libraries / algos |
|---|---|---|
| Geometry + cost engine | `cpp/include/types.h`, `cost.h`, `geo.h` | Euclidean `d=√(Δx²+Δy²)`, Manhattan, road `≈1.35×euclid`, demand-weighted `C=D·d·c`; Weiszfeld weighted geometric median vs centroid |
| Greedy | `s_greedy.h` | demand-desc feasible assignment; iterative max-saving open |
| Clustering baselines | `s_clust.h` | demand-weighted K-Means (+snap to candidates), K-Medoids/PAM |
| Metaheuristics | `s_ls.h` | add/drop/swap local search; simulated annealing |
| Exact | `s_exact.h` | branch-and-bound over subsets + exact capacitated assignment DFS; **only place `optimal=true`** |
| Uncertainty | `sim.h` | Monte Carlo `E[C]=ΣP(s)C(s)`, Normal demand noise, p90/worst; fuel & growth sweeps |
| API/logic | `backend/server.js` | **Node stdlib only** (`http`,`fs`,`child_process`): synthetic generator (seeded), `/api/*` routes, explainer, moving-average+trend forecast |
| Dashboard | `frontend/` | Leaflet map, Chart.js, CSV upload, compare/marginal/sim/sensitivity views |

## Quickstart (no installs!)

```bash
cd cpp && make            # builds ./wlopt (needs g++ only)
cd .. && node backend/server.js   # http://localhost:4000
# tests:
node tests/run.js
```

Docker: `docker compose up` (builds C++ inside container, serves same port).

## API (all POST JSON except noted)

| Route | Body → result |
|---|---|
| `GET /api/demo` | demo dataset |
| `/api/generate` | `{neighborhoods, candidates, seed, mode, capacity, fixedCost}` → dataset |
| `/api/optimize` | `{neighborhoods, candidates, params, marginal, explain}` → solution + `baselineSingle` + `savingsPct` |
| `/api/compare` | same → `{results:[6 algos]}` (exact included iff n≤14,m≤10) |
| `/api/simulate` | +`{scenarios, cv}` → `{expectedTotal,p90,worst,best,totals}` |
| `/api/sensitivity` | +`{fuelMultipliers, growthMultipliers}` → sweeps |
| `/api/median` | → `{median, weberCost, centroid, centroidCost}` |
| `/api/explain` | solution + `explanation[]` lines |
| `/api/forecast` | `{history:{id:[t…]}, horizon}` → moving-avg + trend forecasts |

`params`: `deliveryCostPerKm, maxServiceRadius, min/maxWarehouses, budget,
distanceMetric euclidean|manhattan|road, roadFactor, algorithm auto|greedy|kmeans|kmedoids|localsearch|annealing|exact, randomSeed, saIterations`.

CSV upload format: `type,id,x,y,demand_or_fixed,capacity` (`N,…` / `W,…` rows).

## 📈 New: 365-day growth lab (`/api/year` + `/api/narrate`)

Simulates **demand rising day-by-day for a full year**, finds **where pressure builds**,
auto-places a **new warehouse (W-NEW) at the day-365 demand-weighted geometric median**,
**reconnects** neighborhoods, and reports **money / time / labour / fuel saved** — with an
**LLM narrator**.

| Step | What happens | Where |
|---|---|---|
| 1. Grow | `demand(day)=base·(1+g)^day·seasonality(weekly+annual)·noise` (hotspot region grows `hotspotMult`× faster) | `backend/yearsim.js scaleDemand` |
| 2. Re-optimize | C++ `wlopt` re-runs each month → `$day` cost curve, peak utilization, unserved, avg km | `runYear` → `runWlopt` |
| 3. Pressure | first month with `maxUtil ≥ utilThreshold` (default 85%) / unserved>0 → `{month, day, maxUtil}` | `firstPressure` |
| 4. New warehouse | `W-NEW` @ Weiszfeld median of day-365 demand, cap ≈35% of total, fixed `$newFixedCost` | `proposal` |
| 5. Reconnect | year-end re-optimize with `W-NEW` added (maxWarehouses+1); whole-year counterfactual base vs new | `newSolEnd`, `curveNew` |
| 6. Savings | `saved=Σ base−Σ new`; km=`saved/$/km`; drive-h=`km/kmPerHour`; labour=`h×wage`; fuel=`km×L/km×$/L`; payback=`fixed/avgDaySave` | `stats` |
| 7. LLM | `/api/narrate` sends summary to OpenAI-compatible chat (`OPENAI_API_KEY`/`LLM_BASE`/`LLM_MODEL`), falls back to template | `llmNarrate` |

```bash
# run it (server on :4000):
curl -X POST localhost:4000/api/year -H 'Content-Type: application/json' -d '{
 "neighborhoods":[...],"candidates":[...],
 "params":{"maxServiceRadius":200,"maxWarehouses":2,"algorithm":"greedy"},
 "year":{"dailyGrowthPct":0.15,"hotspotMult":1.6,"utilThreshold":0.85}}' | python3 -m json.tool
# LLM story (needs OPENAI_API_KEY, else template):
curl -X POST localhost:4000/api/narrate -H 'Content-Type: application/json' \
  -d '{"yearResult": <paste /api/year output>}'
# env for real LLM:
OPENAI_API_KEY=sk-... LLM_MODEL=gpt-4o-mini node backend/server.js
```
Dashboard: **📈 365-day growth lab** panel — set growth/hotspot/util/wage/fuel → `▶ Run` draws base-vs-new $/day + utilization curves, KPI cards (saved $/year, payback days), pressure + reconnect report, and plots W-NEW on the map; `🤖 LLM explains` narrates it.

## Math (what/why, 1 line each)

- **Demand-weighted cost** `Cij=Di·dij·c` — delivery bill scales with orders × km.
- **Geometric median** `min ΣD·d` (Weiszfeld) beats centroid (`min ΣD·d²`) — median minimizes true cost & resists outliers.
- **CFLP MILP** `min ΣF·y+ΣΣD·C·x` s.t. assign-once / open-only / capacity / radius / count / budget — the model every solver targets.
- **Greedy** = fast myopic baseline; **K-Means/Medoids** = clustering (variance/distance), ignore fixed costs — baselines only.
- **Local search / annealing** = true cost optimizers, heuristic (local opt / stochastic, no proof).
- **Exact B&B** = subset enumeration + capacitated-assignment DFS with lower-bound pruning — globally optimal *for discrete candidates*; refuses n>14/m>10 honestly.
- **Monte Carlo** `E[C]=ΣP(s)C(s)` + p90/worst — expected vs tail cost under Normal demand noise.

## Evaluation (tests/run.js — all 8 required scenarios + compare + sim)

T1 uniform 1-wh exact · T2 concentrated median · T3 capacity multi-wh · T4 strict radius unserved ·
T5 regional growth cost↑ · T6 fuel monotonic · T7 road>euclid · T8 n=200 annealing fast · T9 compare · T10 Monte Carlo. `node tests/run.js` → exit 0.

## Demo script (2 min)

1. Open `:4000` → Load demo → Optimize → read KPIs + explanation.
2. Compare algorithms → exact row (small demo) proves optimum; k-means loses (clustering≠optimization).
3. Monte Carlo → quote E[C] vs p90; Sensitivity → fuel×2 / growth×2 curves.
4. Toggle maxWarehouses 1→4 with marginal chart → “2nd warehouse saves $X, 4th saves ~$0 — stop at 3.”
