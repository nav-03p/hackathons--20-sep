# 🌐 GRIDPOINT — Warehouse Location Optimization Platform
> **Hack-a-Matics 24-Hour Hackathon · Theme: VECTOR**

GRIDPOINT is a full-stack, location-agnostic warehouse placement and capacitated assignment optimization platform for e-commerce delivery networks. It finds the optimal warehouse locations and neighborhood service assignments to minimize demand-weighted delivery and infrastructure costs.

---

## 🏗 Architecture & Monorepo Layout

```
hackamathics/
├── backend/                  # Node.js REST API + persistent registries
│   ├── server.js             # HTTP API (all endpoints, zero npm deps runtime)
│   ├── envdb.js              # Auth, JWT, Supabase persistence, OpenRouter LLM
│   ├── yearsim.js            # 365-day demand growth simulation + Weiszfeld median
│   ├── shared.js             # Multi-tenant shared vs solo warehouse optimization
│   ├── fulfill.js            # Operational fulfillment, VRP dispatch & inventory
│   ├── whstore.js            # Persistent warehouse registry
│   └── supabase.sql          # DB schema (wlo_users, wlo_datasets, wlo_runs)
│
├── cpp/                      # High-performance C++17 optimization core
│   ├── src/main.cpp          # CLI dispatcher (JSON stdin -> solution stdout)
│   └── include/
│       ├── types.h           # Core domain structs (Neighborhood, Candidate, Solution)
│       ├── cost.h            # Cost models (Euclidean, Manhattan, Road factor)
│       ├── geo.h             # Weiszfeld geometric median algorithm
│       ├── s_clust.h         # Demand-weighted k-means & k-medoids (PAM)
│       ├── s_greedy.h        # Capacitated greedy assignment
│       ├── s_ls.h            # Local search (add/drop/swap) & simulated annealing
│       ├── s_exact.h         # Branch-and-bound exact MILP solver (proves global optimality)
│       ├── sim.h             # Monte Carlo demand noise simulation
│       └── fulfill.h         # Multi-depot vehicle routing (VRP) & wave dispatch
│
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind + Leaflet + Recharts
│   └── src/
│       ├── App.tsx           # Page router & global navigation
│       ├── pages/            # 14 specialized optimization and planning workspaces
│       │   ├── Dashboard.tsx            # KPIs, cost breakdown, warehouse utilization
│       │   ├── OptimizationWorkspace.tsx# Core optimizer + interactive map + B&B solver
│       │   ├── AlgorithmComparison.tsx  # Side-by-side: Exact vs SA vs LS vs K-Means vs Greedy
│       │   ├── DemandSimulation.tsx     # Monte Carlo uncertainty & distribution analysis
│       │   ├── SensitivityAnalysis.tsx  # Growth rate & fuel price sweeps
│       │   ├── Year.tsx                 # 365-day growth lab + AI narration
│       │   ├── MapExplorer.tsx          # Full geospatial visualization
│       │   ├── DataImport.tsx           # CSV upload + Bangalore seed dataset loader
│       │   ├── Fulfillment.tsx          # Order waves, VRP trips, inventory ledger
│       │   ├── Warehouses.tsx           # Warehouse registry management
│       │   └── Tenants.tsx              # Multi-tenant shared logistics network
│       └── lib/
│           ├── api.ts        # Typed fetch client
│           └── store.tsx     # Global application state provider
│
├── data/
│   └── sample.csv            # Sample dataset
├── tests/
│   ├── run.js                # 10 algorithmic verification tests
│   └── year_test.js          # 365-day year growth test
└── README.md
```

---

## 🚀 Quickstart

### Prerequisites
- **Node.js** >= 18
- **g++** >= 10 with C++17 support (MinGW on Windows, build-essential on Linux/macOS)

### 1. Compile C++ Optimization Core
```bash
# Windows (PowerShell / Git Bash)
cd cpp
g++ -std=c++17 -O2 -I include src/main.cpp -o wlopt.exe
cd ..

# Linux / macOS
cd cpp
g++ -std=c++17 -O2 -I include src/main.cpp -o wlopt
cd ..
```

### 2. Run Test Suite
```bash
node tests/run.js      # 10 algorithmic correctness tests (all pass)
node tests/year_test.js # 365-day year growth simulation test
```

### 3. Start Backend
```bash
node backend/server.js  # Runs on http://localhost:4000
```

### 4. Start Frontend
```bash
cd frontend
npm install
npm run dev             # Runs on http://localhost:5173
```

---

## 📍 Seed Data — Basavanagudi & Jayanagar, Bangalore

The platform comes pre-seeded with **16 real neighborhoods** and **6 candidate warehouse hubs** from South Bangalore:

| Area | Neighborhoods | Demand Profile |
|---|---|---|
| **Basavanagudi** | Gandhi Bazaar (420), DVG Road (310), Bull Temple Road (380), Tagore Park (190), Sajjan Rao Circle (260), NR Colony (230), Hanumanthanagar (175), VV Puram (345) | High retail density |
| **Jayanagar** | 4th Block (500), 7th Block (440), 9th Block (390), RV Road (280), 11th Main (320), Tilak Nagar (210), Jayanagar East (185), 3rd Block (295) | High residential density |
| **Candidate Hubs** | Basavanagudi Hub (900 cap), Jayanagar Dock (1100 cap), Gandhi Bazaar Depot (700 cap), DVG Road Point (650 cap), South Bangalore DC (1400 cap), 9th Block Node (800 cap) | Scaled capacity |

> **Location-Agnostic Design:** The schema uses a normalized coordinate interface `(id, name, x, y, demand, capacity, fixedCost)`. Any city's neighborhood data works without code changes.

One-click load is available via the **Data Import** page in the UI, or via `GET /api/bengaluru`.

---

## 📐 Mathematical Cost Model

$$\text{totalDeliveryCost} = \sum_{i,j} (\text{distance}_{ij} \times \text{orders}_i \times \text{costPerKmPerOrder} \times \text{vehicleMultiplier}) + \sum_j \text{fuelCost}_j$$

$$\text{totalInfraCost} = k \times \text{fixedSetupCostPerWarehouse}$$

$$\text{grandTotal} = \text{totalDeliveryCost} + \text{totalInfraCost}$$

### Optimization Algorithms Implemented
1. **Branch-and-Bound (Exact MILP)** — Provably finds the global optimum over discrete candidate locations with exact capacitated assignment DFS.
2. **Simulated Annealing** — 8,000-iteration stochastic metaheuristic avoiding local minima.
3. **Local Search** — Add/Drop/Swap neighborhood search.
4. **Demand-Weighted K-Means** — Fast clustering baseline with candidate snapping.
5. **Demand-Weighted K-Medoids (PAM)** — Medoid-based clustering baseline.
6. **Capacitated Greedy** — Demand-descending assignment with capacity and service radius enforcement.
7. **Weiszfeld Geometric Median** — Continuous optimal single-warehouse placement minimizing $\sum D_i \cdot d_i$.

---

## 🔌 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health status, C++ binary path, DB connection, LLM status |
| `/api/bengaluru` | GET | Real Basavanagudi & Jayanagar dataset |
| `/api/demo` | GET | Synthetic demo dataset (seeded) |
| `/api/optimize` | POST | Run optimization (`exact`, `annealing`, `localsearch`, `kmeans`, `greedy`) |
| `/api/sweep` | POST | Cost sweep for $k = 1 \dots N$ (infrastructure vs delivery trade-off) |
| `/api/compare` | POST | Side-by-side run of all 6 algorithms on the same dataset |
| `/api/simulate` | POST | Monte Carlo demand noise simulation ($E[C]$, P90, worst case) |
| `/api/sensitivity` | POST | Fuel price and demand growth sensitivity curves |
| `/api/median` | POST | Weiszfeld weighted geometric median vs centroid comparison |
| `/api/year` | POST | 365-day growth lab: detects capacity bottleneck, proposes new warehouse |
| `/api/narrate` | POST | AI narration of optimization results (OpenRouter / OpenAI) |
| `/api/fulfill` | POST | Vehicle routing, wave dispatch, and order fulfillment plan |
| `/api/tenants` | POST | Multi-tenant shared warehouse cost allocation |

---

## 🤖 AI Assistance & Tool Disclosure

In compliance with hackathon rules, the following AI tools and open-source libraries were used in the creation of GRIDPOINT:

| Component | Tool / Library Used | Purpose |
|---|---|---|
| **Code Generation & Architecture** | Claude Code (Anthropic) | Full-stack scaffolding, API integration, test orchestration |
| **LLM Narration** | OpenRouter (`openrouter/auto`) / OpenAI (`gpt-4o-mini`) | Natural language explanations of optimization runs and growth forecasts |
| **Database & Auth** | Supabase (PostgreSQL REST API) | Run history, dataset persistence, user accounts |
| **UI Components** | Tailwind CSS v4, Lucide React, Recharts | Data visualization, charts, responsive layouts |
| **Geospatial & Maps** | Custom SVG Map Canvas + Leaflet | Location-agnostic visual network representation |
| **JSON Parser** | `nlohmann/json` single-header | C++ JSON serialization/deserialization |

---

## 🎬 2-3 Minute Demo Video Outline / Script

### **[0:00 - 0:30] Introduction & Problem Setup**
- *"Hi everyone, this is **GRIDPOINT**, a Warehouse Location Optimization platform built for Hack-a-Matics under the theme VECTOR."*
- **Problem:** E-commerce networks must decide where to open warehouses and which neighborhoods to serve to minimize total delivery and fixed setup costs, subject to capacity and radius constraints.
- **Show Dashboard:** Overview showing total cost, delivery vs fixed breakdown, and warehouse utilization.

### **[0:30 - 1:15] Core Optimizer & Bangalore Seed Data**
- Navigate to **Data Import** → Click *"Load Bangalore (Basavanagudi & Jayanagar)"*.
- Explain: *"Here we load 16 real neighborhoods from Basavanagudi and Jayanagar with their daily order volumes, plus 6 candidate warehouse hubs."*
- Switch to **Optimization Workspace** → Select **Exact (Branch & Bound)**.
- Set max service radius to 60 km, warehouse capacity to 800 orders.
- Click **Run Optimization** (<10ms execution via compiled C++ binary).
- **Show map:** Highlight open warehouses (blue circles), service radius dashed rings, assignment lines, and capacity utilization bars. Point out any unserved areas flagged if radius is exceeded.

### **[1:15 - 1:45] Algorithm Comparison & Baseline**
- Navigate to **Algorithm Comparison**.
- Click **Run All** → side-by-side results table for all 6 solvers:
  - **Branch & Bound:** Provably optimal ($44,435)
  - **Simulated Annealing & Local Search:** Match the optimum within 0.1%
  - **K-Means / Greedy:** Show higher cost, demonstrating why geometric clustering is not enough and cost optimization is necessary.
- Highlight the **baseline single-warehouse comparison** showing 18-35% cost reduction from multi-warehouse optimization.

### **[1:45 - 2:20] Advanced Modules: 365-Day Growth Lab & AI Narration**
- Navigate to **365-Day Year Lab** → Click **Run Year Simulation**.
- Show the demand curve rising over 12 months.
- Point out the **bottleneck detection**: at Month 2, utilization hits 85%.
- Show the **auto-proposed new warehouse** placed at the **Weiszfeld weighted geometric median** of year-end demand.
- Show KPI: **$1.77M saved** over the year by proactively adding capacity.
- Click **AI Narrator** → Show the live OpenRouter LLM narration explaining the business case in plain English.

### **[2:20 - 2:45] Fulfillment & Multi-Tenant Features**
- Briefly show **Fulfillment**: order waves, vehicle trips with stop sequences, and inventory ledger.
- Briefly show **Tenants**: shared warehouse cost-splitting where two companies pool capacity to reduce fixed overhead.

### **[2:45 - 3:00] Conclusion**
- *"GRIDPOINT brings mathematical rigor — exact MILP, Weiszfeld medians, and simulated annealing — wrapped in an interactive, location-agnostic web application. Thank you!"*
