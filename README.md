# 🌐 GRIDPOINT — Capacitated Warehouse Location & Network Optimization Platform
> **Hack-a-Matics Hackathon · Theme: VECTOR**

**GRIDPOINT** is a high-performance, location-agnostic warehouse placement, capacitated assignment, and logistics network optimization platform. It solves the **Capacitated Facility Location Problem (CFLP)** using rigorous mathematical optimization algorithms implemented in **C++17**, paired with a modern **React 19 + TypeScript + Vite + Tailwind CSS v4** analytical workspace and a zero-dependency **Node.js REST API**.

---

## 🎯 Problem Statement & Core Capabilities

E-commerce delivery networks face a fundamental trade-off: **delivery transit costs** (distance, vehicle fleet consumption, traffic congestion) versus **fixed infrastructure costs** (renting, staffing, and maintaining warehouse facilities).

GRIDPOINT models this continuous & discrete optimization problem end-to-end:

1. **Upload & Interactive Data Management**:
   - Upload custom neighborhood datasets via CSV or JSON, or load the pre-configured **Bengaluru seed dataset** (16 neighborhoods across Basavanagudi & Jayanagar + 6 candidate hubs).
   - Location-agnostic coordinate system: works seamlessly on any geographic coordinates (Lat/Lng or Cartesian grids).
2. **Interactive Geospatial Visualization**:
   - Real-time map rendering with dynamic bubble scaling representing daily order volume.
   - Live assignment vectors connecting demand nodes to active warehouse hubs.
   - Interactive service radius rings and capacity utilization meters.
3. **User-Selectable Hub Count ($k$) & Exact/Heuristic Solvers**:
   - Bounded $k_{\min} \le k \le k_{\max}$ search or single $k$ specification.
   - Provably exact global optimum via **Branch-and-Bound (MILP)** and fast scalable metaheuristics (**Simulated Annealing**, **Local Search**, **Demand-Weighted K-Means/K-Medoids**, **Capacitated Greedy**).
4. **Capacitated Assignment & Service Radius Enforcement**:
   - Strict adherence to maximum warehouse throughput limits ($C_{\max}$).
   - Maximum allowable delivery service radius ($R_{\max}$) with unserved demand anomaly detection and violation flagging.
5. **Multi-Component Delivery & Infrastructure Cost Accounting**:
   - Comprehensive cost model accounting for mileage, orders, vehicle profiles, fuel prices, and fixed setup amortizations.
6. **Side-by-Side Baseline vs. Optimized Comparison**:
   - Real-time delta comparison against a single central hub baseline showing percentage cost savings, transit mileage reductions, and CO₂ mitigation.

---

## 🌟 Advanced & Bonus Features

- **Multi-Vehicle Fleet Profiles**:
  - Select between **Two-Wheeler / Electric Bike** (40 orders, \$0.60/km), **Electric Cargo Van** (250 orders, \$1.20/km), **Standard Diesel Van** (500 orders, \$1.60/km), and **Heavy 14ft Truck** (1,200 orders, \$2.80/km).
- **Fuel Price & Efficiency Modeling**:
  - Live landed transit rate calculations:
    $$\text{Landed Cost / km} = \text{Base Cost / km} + \left(\frac{\text{Fuel Price (\$ / L)}}{\text{Fuel Efficiency (km / L)}}\right)$$
- **Traffic-Dependent Delivery Time Multipliers**:
  - Pluggable traffic & circuity models: *Off-Peak / Night ($0.85\times$)*, *Standard Daylight ($1.0\times$)*, *Morning Rush ($1.50\times$)*, *Evening Peak ($1.75\times$)*, and *Monsoon Congestion ($2.00\times$)*.
- **Demand Growth Scenario Simulation**:
  - Interactive demand slider (-50% to +200%) enabling instant stress-testing and re-optimization across forecast horizons.
- **Infrastructure vs. Delivery Cost Trade-Off Curve ($k=1 \dots N$ Sweep)**:
  - Generates the $U$-shaped total cost curve $\text{TotalCost}(k) = \text{DeliveryCost}(k) + k \times \text{FixedCost}$ to mathematically identify the optimal number of warehouses $k^*$.
- **Weiszfeld Continuous Geometric Median**:
  - Computes the unconstrained Fermat-Weber continuous optimal coordinate $(\hat{x}, \hat{y})$ minimizing $\sum D_i \cdot d_i$ and snaps to the closest feasible candidate dock.

---

## 🏗 Architecture & Tech Stack

```
hackamathics/
├── backend/                  # Node.js HTTP REST API (zero npm runtime dependencies)
│   ├── server.js             # High-concurrency REST endpoints
│   ├── envdb.js              # Supabase persistence & OpenRouter LLM integration
│   ├── yearsim.js            # 365-day demand expansion & Weiszfeld engine
│   ├── shared.js             # Multi-tenant logistics network allocator
│   ├── fulfill.js            # Vehicle routing problem (VRP) & dispatch engine
│   └── whstore.js            # Persistent warehouse hub registry
│
├── cpp/                      # High-performance C++17 optimization core
│   ├── src/main.cpp          # CLI dispatcher (JSON stdio interface)
│   └── include/
│       ├── types.h           # Domain models (Neighborhood, Candidate, Solution)
│       ├── cost.h            # Distance metrics (Euclidean, Manhattan, Road 1.35x)
│       ├── geo.h             # Weiszfeld geometric median solver
│       ├── s_clust.h         # Demand-weighted K-Means & K-Medoids (PAM)
│       ├── s_greedy.h        # Capacitated greedy assignment
│       ├── s_ls.h            # Local Search (Add/Drop/Swap) & Simulated Annealing
│       ├── s_exact.h         # Branch-and-bound MILP exact solver
│       ├── sim.h             # Monte Carlo demand noise simulation
│       └── fulfill.h         # Multi-depot VRP dispatch & wave planning
│
├── frontend/                 # React 19 + TypeScript + Vite + Tailwind CSS v4
│   └── src/
│       ├── App.tsx           # App routing & navigation shell
│       ├── components/       # ErrorBoundary, UI components, Sidebar, TopNav
│       ├── pages/            # 14 specialized analytical dashboards
│       │   ├── Dashboard.tsx            # Executive KPI cockpit
│       │   ├── OptimizationWorkspace.tsx# Core optimizer, map canvas, k-sweep & Weiszfeld
│       │   ├── AlgorithmComparison.tsx  # Side-by-side solver benchmark
│       │   ├── DemandSimulation.tsx     # Monte Carlo uncertainty simulation
│       │   ├── SensitivityAnalysis.tsx  # Fuel and growth rate elasticity sweeps
│       │   ├── ScenarioManager.tsx      # Scenario manager & persistence
│       │   ├── Year.tsx                 # 365-day year growth lab + AI narration
│       │   ├── MapExplorer.tsx          # Geospatial explorer
│       │   ├── DataImport.tsx           # CSV upload + Bangalore seed loader
│       │   ├── Fulfillment.tsx          # VRP trip & inventory planner
│       │   ├── Warehouses.tsx           # Warehouse candidate registry
│       │   └── Tenants.tsx              # Multi-tenant cost-sharing optimization
│       └── lib/
│           ├── api.ts        # Typed API client
│           └── store.tsx     # Global reactive state provider
│
├── data/
│   └── sample.csv            # Sample CSV dataset
├── scripts/
│   └── dev.js                # Single-command concurrent dev server
├── tests/
│   ├── run.js                # Algorithmic correctness verification suite
│   └── year_test.js          # 365-day lifecycle growth simulation test
└── README.md
```

---

## 📐 Mathematical Formulation

### 1. Capacitated Facility Location Problem (CFLP)

Let $I = \{1, \dots, n\}$ be the set of demand neighborhoods and $J = \{1, \dots, m\}$ be the set of candidate warehouse locations.

$$\min \sum_{j \in J} f_j y_j + \sum_{i \in I} \sum_{j \in J} c_{ij} x_{ij}$$

**Subject to:**
1. **Demand Satisfaction**: $\sum_{j \in J} x_{ij} = 1 \quad \forall i \in I$
2. **Capacity Constraints**: $\sum_{i \in I} D_i x_{ij} \le C_j y_j \quad \forall j \in J$
3. **Service Radius Constraint**: $d_{ij} x_{ij} \le R_{\max} \quad \forall i \in I, j \in J$
4. **Hub Count Bounds**: $k_{\min} \le \sum_{j \in J} y_j \le k_{\max}$
5. **Integrity**: $y_j \in \{0, 1\}, \quad x_{ij} \in \{0, 1\}$

Where:
- $f_j$: Fixed setup cost of opening warehouse $j$.
- $D_i$: Daily order demand at neighborhood $i$.
- $C_j$: Maximum order throughput capacity of warehouse $j$.
- $c_{ij} = D_i \cdot d_{ij} \cdot \rho_{\text{vehicle}} \cdot \gamma_{\text{traffic}}$: Variable delivery cost from warehouse $j$ to neighborhood $i$.
- $d_{ij}$: Distance between $i$ and $j$ under Euclidean, Manhattan, or Circuity Road Metric ($1.35\times$).

---

## 📍 Seed Dataset — South Bangalore

The platform includes seed data representing **16 key neighborhoods** and **6 candidate hubs** in Bengaluru:

| Area | Neighborhoods | Demand Profile |
|---|---|---|
| **Basavanagudi** | Gandhi Bazaar (420), DVG Road (310), Bull Temple Road (380), Tagore Park (190), Sajjan Rao Circle (260), NR Colony (230), Hanumanthanagar (175), VV Puram (345) | High commercial & retail density |
| **Jayanagar** | 4th Block (500), 7th Block (440), 9th Block (390), RV Road (280), 11th Main (320), Tilak Nagar (210), Jayanagar East (185), 3rd Block (295) | High residential density |
| **Candidate Hubs** | Basavanagudi Hub (Cap: 900), Jayanagar Dock (Cap: 1100), Gandhi Bazaar Depot (Cap: 700), DVG Road Point (Cap: 650), South Bangalore DC (Cap: 1400), 9th Block Node (Cap: 800) | Strategic arterial hubs |

*The schema is fully location-agnostic and supports any arbitrary city, region, or abstract coordinate system.*

---

## ⚡ Quickstart & Local Setup

### 1. Prerequisites
- **Node.js** >= 18
- **g++** >= 10 with C++17 support (MinGW on Windows, `build-essential` on Linux / macOS)

### 2. Compile C++ Optimization Core
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

### 3. Run Algorithmic Tests
```bash
npm test
```
*Executes all 11 unit & integration tests validating Branch-and-Bound, Weiszfeld median, capacity enforcement, radius violations, and Monte Carlo simulation.*

### 4. Single-Command Concurrent Dev Server
```bash
npm run dev
```
*Simultaneously launches:*
- **Backend API**: `http://localhost:4000`
- **Frontend App**: `http://localhost:5173`

---

## 🔌 API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check, C++ engine binary path, Supabase connection, LLM status |
| `/api/bengaluru`| GET | Seed Basavanagudi & Jayanagar dataset |
| `/api/demo` | GET | Synthetic seeded benchmark dataset |
| `/api/optimize` | POST | Execute optimization solver (`exact`, `annealing`, `localsearch`, `kmeans`, `greedy`, `median`) |
| `/api/sweep` | POST | Compute infrastructure vs. delivery cost curve across $k = 1 \dots N$ |
| `/api/compare` | POST | Benchmark all 6 algorithms side-by-side on the identical dataset |
| `/api/simulate` | POST | Monte Carlo demand noise simulation ($E[C]$, P90, worst case) |
| `/api/sensitivity` | POST | Fuel price and demand growth elasticity sweeps |
| `/api/median` | POST | Continuous Weiszfeld Fermat-Weber geometric median point |
| `/api/year` | POST | 365-day growth simulation detecting capacity bottlenecks and recommending new hubs |
| `/api/narrate` | POST | AI natural language executive briefing (OpenRouter / OpenAI) |
| `/api/fulfill` | POST | Operational multi-depot vehicle routing and wave dispatch plan |
| `/api/tenants` | POST | Multi-tenant shared logistics network cost allocation |

---

## 🚢 Cloud Deployment Guide

### Backend (Railway / Render / Fly.io)
1. Point to the repository root.
2. Build command:
   ```bash
   cd cpp && g++ -std=c++17 -O2 -I include src/main.cpp -o wlopt && cd ..
   ```
3. Start command:
   ```bash
   node backend/server.js
   ```
4. Environment variables: `PORT=4000`, `SUPABASE_PROJECT_ID`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `OPENROUTER_API_KEY`.

### Frontend (Vercel / Netlify)
1. Root directory: `frontend`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variable: `VITE_API_BASE_URL=https://your-backend-domain.com`
