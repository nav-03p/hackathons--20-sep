You are a senior **Frontend Architect, Product Designer, UX Engineer, and Data-Visualization Specialist**.

Build a polished, production-quality frontend for my hackathon project:

# “Where Should the Warehouse Go?”

### An Intelligent Warehouse Location & Logistics Optimization Platform

The frontend should feel like a professional **logistics command center**, not a basic CRUD dashboard. It must communicate complex optimization results through a beautiful, intuitive, interactive interface.

---

# 1. Design Direction

Create a modern, premium SaaS interface inspired by:

* Linear
* Vercel
* Stripe
* Palantir Foundry
* Modern logistics control rooms
* Advanced data-analytics dashboards

## Visual Style

* Dark-first interface with an optional light mode.
* Sophisticated black, charcoal, and off-white color palette.
* Use one accent color for important actions and optimization results.
* Clean typography with strong visual hierarchy.
* Subtle borders and glass-like surfaces where appropriate.
* Minimal gradients.
* Smooth micro-interactions.
* Professional charts and map visualizations.
* No unnecessary neon effects or excessive animations.
* Avoid generic admin-dashboard aesthetics.

Use a consistent spacing system, responsive grid, accessible contrast, and polished empty/loading/error states.

---

# 2. Technology Requirements

Use:

* React or Next.js
* TypeScript
* Tailwind CSS
* shadcn/ui or an equivalent accessible component system
* Lucide icons
* Framer Motion for subtle animations
* React Query or an equivalent data-fetching library
* React Hook Form + Zod for form validation
* Recharts or another suitable charting library
* Mapbox GL or Leaflet for interactive maps

Structure the code into reusable components and feature-based modules.

Do not hardcode the entire interface into one component.

If the backend is unavailable, create a typed mock API layer with realistic demo data. Keep the API interface replaceable with a real backend later.

---

# 3. Application Structure

Create the following pages:

## A. Landing Page

Create a compelling hackathon-quality landing page with:

### Hero Section

Headline:

> “Find the Optimal Location for Every Delivery.”

Supporting text:

> “Optimize warehouse placement, reduce delivery costs, and simulate real-world logistics constraints using mathematical optimization.”

Include:

* “Launch Optimizer” CTA
* “Explore Demo” CTA
* Animated logistics network visualization
* Animated warehouse and neighborhood nodes
* Delivery routes connecting locations
* Key metrics such as:

  * Delivery cost reduction
  * Average delivery distance
  * Number of optimized locations

Do not fabricate real-world performance claims. Clearly label demo metrics as simulated.

### Feature Sections

Showcase:

1. Multi-warehouse optimization
2. Capacity-aware allocation
3. Demand-weighted delivery costs
4. Road-network distance support
5. Demand uncertainty simulation
6. Explainable optimization

### Mathematical Foundation Section

Visually explain:

* Weighted distance
* Facility location optimization
* Warehouse-to-neighborhood assignment
* Capacity constraints
* Demand simulation

Use readable mathematical notation and concise explanations.

### Final CTA

“Build a smarter logistics network.”

---

# 4. Main Application Layout

Create a responsive application shell with:

## Sidebar Navigation

Include:

* Overview
* Optimization Workspace
* Map Explorer
* Demand Simulation
* Algorithm Comparison
* Sensitivity Analysis
* Scenarios
* Data Import
* Optimization History
* Documentation
* Settings

## Top Navigation

Include:

* Current project selector
* Dataset selector
* Current optimization status
* Search
* Notifications
* Theme toggle
* User profile menu

On mobile, convert the sidebar into a drawer.

---

# 5. Overview Dashboard

Create a high-quality logistics overview dashboard.

## KPI Cards

Display:

* Total delivery cost
* Fixed warehouse cost
* Overall optimization cost
* Average delivery distance
* Active warehouses
* Total demand
* Average warehouse utilization
* Number of served neighborhoods

Each card should include:

* Main value
* Unit
* Comparison with the selected baseline
* Small trend indicator
* Tooltip explaining the metric

Do not display fake improvements as real results. Clearly mark mock values as “Demo data.”

## Main Dashboard Sections

### A. Optimization Summary

Show:

* Current optimization status
* Selected algorithm
* Last execution time
* Number of neighborhoods
* Number of candidate warehouses
* Constraint status

### B. Logistics Map Preview

Display:

* Neighborhood points
* Demand intensity
* Selected warehouse locations
* Assignment lines
* Warehouse service areas
* Route-distance indicators
* Map legend

### C. Cost Breakdown

Create a chart showing:

* Delivery cost
* Warehouse fixed cost
* Fuel cost
* Penalty cost
* Total cost

### D. Warehouse Utilization

Show warehouse capacity usage using:

* Progress bars
* Bar charts
* Capacity warnings
* Overloaded-warehouse alerts

### E. Recent Optimization Runs

Create a table containing:

* Run ID
* Dataset
* Algorithm
* Warehouse count
* Total cost
* Runtime
* Status
* Timestamp
* View-results action

---

# 6. Optimization Workspace

This is the core page of the application.

Design it as a professional optimization control center.

## Layout

Use a three-part responsive layout:

### Left Panel — Configuration

Create configurable sections for:

## Dataset

* Select dataset
* Upload CSV
* Number of neighborhoods
* Total demand
* Candidate warehouse count

## Warehouse Configuration

* Minimum warehouses
* Maximum warehouses
* Warehouse capacity
* Fixed opening cost
* Optional warehouse-specific capacities

## Delivery Configuration

* Cost per kilometer
* Fuel-cost multiplier
* Maximum service radius
* Distance method:

  * Euclidean
  * Road network
  * Precomputed distance matrix

## Optimization Configuration

* Algorithm selector:

  * Greedy
  * K-Means baseline
  * K-Medoids
  * Local Search
  * Mixed-Integer Linear Programming
  * Simulated Annealing
* Optimization time limit
* Objective-weight controls
* Random seed
* Enable demand uncertainty

Use sliders, number inputs, switches, tooltips, and validation messages.

### Center Panel — Interactive Map

Display:

* All neighborhoods
* Demand-weighted markers
* Candidate warehouse locations
* Selected warehouses
* Assignment lines
* Service-radius circles
* Warehouse capacity indicators
* Map clustering for dense datasets
* Zoom and pan controls
* Map style switcher
* Toggle layers

Interactions:

* Click a neighborhood to inspect demand and assigned warehouse.
* Click a warehouse to inspect capacity, utilization, and served neighborhoods.
* Select a candidate warehouse manually.
* Toggle delivery connections.
* Filter by warehouse.
* Highlight high-demand locations.
* Compare current and baseline assignments.

### Right Panel — Optimization Results

Show:

* Optimization status
* Total cost
* Cost reduction compared with baseline
* Average delivery distance
* Opened warehouses
* Served neighborhoods
* Constraint violations
* Runtime
* Solver status

Include:

* “Run Optimization” button
* “Cancel Run” button
* “Reset Configuration” button
* “Save Scenario” button
* “Export Results” button

Display optimization progress without pretending that a calculation is running when it is not.

---

# 7. Optimization Results Page

Create a detailed results page after an optimization run.

## Results Header

Display:

* Run name
* Dataset
* Algorithm
* Solver status
* Execution duration
* Timestamp
* Export controls

## Summary Cards

Show:

* Total cost
* Delivery cost
* Fixed cost
* Average distance
* Number of warehouses
* Capacity utilization
* Unserved demand

## Results Tabs

### Tab 1: Warehouse Allocation

Table columns:

* Warehouse ID
* Location
* Fixed cost
* Capacity
* Assigned demand
* Utilization
* Number of neighborhoods
* Status

### Tab 2: Neighborhood Assignments

Table columns:

* Neighborhood
* Coordinates
* Demand
* Assigned warehouse
* Distance
* Delivery cost
* Service-radius status

Add search, sorting, filtering, and pagination.

### Tab 3: Cost Analysis

Show:

* Delivery-cost breakdown
* Fixed-cost breakdown
* Cost by warehouse
* Cost by neighborhood
* Baseline versus optimized cost

### Tab 4: Constraint Validation

Show a clear validation report:

* Capacity constraints
* Service-radius constraints
* Assignment constraints
* Warehouse-count constraints
* Budget constraints

Use clear status indicators such as Valid, Warning, and Violation.

### Tab 5: Explainability

For each selected warehouse, explain:

* Why it was selected
* Which neighborhoods it serves
* Its contribution to total cost
* Capacity utilization
* Impact of removing or relocating it

Use explanations generated from actual backend results. Do not invent optimization reasoning.

---

# 8. Map Explorer

Create a full-screen geospatial analysis page.

Features:

* Interactive map
* Demand heatmap
* Warehouse markers
* Candidate-location markers
* Assignment lines
* Service-radius overlays
* Route-distance visualization
* Cluster visualization
* Neighborhood search
* Warehouse filtering
* Layer controls
* Map legend
* Side inspection panel

Allow users to compare:

* Baseline layout
* Optimized layout
* Alternative scenario

Include a map fallback when map services are unavailable.

---

# 9. Demand Simulation Page

Create a page for exploring uncertain future demand.

## Controls

* Demand-growth percentage
* Simulation count
* Demand-distribution selector
* Random seed
* Scenario selector
* Peak-demand multiplier

## Visualizations

Display:

* Demand distribution
* Neighborhood demand forecast
* Demand-growth heatmap
* Expected total cost
* Cost-distribution chart
* Worst-case cost
* High-percentile cost
* Warehouse overload probability

Clearly distinguish simulated projections from real historical data.

Include:

* “Run Simulation”
* “Compare Scenarios”
* “Export Simulation”

---

# 10. Algorithm Comparison Page

Create a comparison interface for optimization methods.

Compare:

* Greedy
* K-Means
* K-Medoids
* Local Search
* MILP
* Simulated Annealing

## Comparison Table

Columns:

* Algorithm
* Total cost
* Delivery cost
* Average distance
* Runtime
* Number of warehouses
* Constraint violations
* Solution status

## Charts

Include:

* Cost versus runtime
* Algorithm cost comparison
* Scalability by dataset size
* Average distance comparison
* Constraint-violation comparison

Do not call an algorithm “optimal” unless the backend provides evidence of optimality.

---

# 11. Sensitivity Analysis Page

Allow users to change parameters and observe how the solution changes.

Parameters:

* Delivery cost per kilometer
* Fixed warehouse cost
* Demand volume
* Warehouse capacity
* Maximum service radius
* Fuel-cost multiplier
* Number of warehouses

Visualize:

* Total cost versus parameter value
* Warehouse-count changes
* Assignment changes
* Cost sensitivity
* Capacity bottlenecks
* Break-even points

Include a comparison between the original configuration and the modified configuration.

---

# 12. Scenario Management

Allow users to:

* Create a scenario
* Name a scenario
* Duplicate a scenario
* Edit parameters
* Run optimization
* Compare scenarios
* Save results
* Delete scenarios

Example scenarios:

* Baseline demand
* Demand growth
* High fuel prices
* Limited warehouse capacity
* Strict service radius
* Multiple warehouses

Display scenarios in cards or a table with status and summary metrics.

---

# 13. Data Import Page

Create a data-import workflow with:

1. Upload CSV
2. Preview records
3. Validate columns
4. Display validation errors
5. Preview locations on a map
6. Confirm import
7. Show import summary

Expected neighborhood columns:

* `neighborhood_id`
* `name`
* `latitude`
* `longitude`
* `demand`

Support optional candidate-warehouse columns.

Include downloadable sample CSV templates.

Never silently accept invalid coordinates or negative demand.

---

# 14. Documentation Page

Create an interactive documentation area explaining:

## Mathematical Concepts

* Weighted distance
* Weighted geometric median
* Facility Location Problem
* Capacitated Facility Location Problem
* Mixed-Integer Linear Programming
* Clustering versus optimization
* Graph-based shortest paths
* Monte Carlo simulation
* Sensitivity analysis

## User-Friendly Explanations

For every concept, show:

* What it means
* Why it is used
* A simple example
* Its impact on warehouse decisions

Include mathematical formulas in a readable format.

---

# 15. UX Requirements

Implement:

* Skeleton loaders
* Empty states
* Error states
* Toast notifications
* Confirmation dialogs
* Form validation
* Accessible keyboard navigation
* Responsive layouts
* Tooltips for technical terms
* Undo or reset actions where appropriate
* Clear disabled states
* Optimistic UI only where safe
* Proper error handling for failed API requests

Do not overwhelm users with mathematical jargon. Use progressive disclosure: simple summaries first, technical details on demand.

---

# 16. API Integration Design

Create a typed API service layer with interfaces for:

* Dataset upload
* Dataset validation
* Dataset retrieval
* Optimization execution
* Optimization-status polling
* Optimization-result retrieval
* Demand simulation
* Algorithm comparison
* Sensitivity analysis
* Scenario management
* Exporting results

Use mock responses initially, but make the architecture ready for a real FastAPI backend.

Never expose secret API keys in frontend code.

---

# 17. Performance Requirements

* Use pagination for large tables.
* Use memoization for expensive visualizations.
* Avoid unnecessary map re-renders.
* Use clustering for large numbers of map markers.
* Lazy-load heavy chart and map components.
* Debounce search and filter inputs.
* Handle datasets containing thousands of neighborhoods.
* Display meaningful progress and timeout states.

---

# 18. Demo Mode

Create a fully functional demo mode using synthetic data.

The demo should include:

* At least 30 neighborhoods
* Demand-weighted locations
* Candidate warehouse locations
* Multiple warehouse configurations
* Baseline and optimized results
* Simulated algorithm comparisons
* Interactive maps
* Sensitivity-analysis examples

Clearly label all demo outputs as simulated.

---

# 19. Quality Standards

The final frontend must be:

* Visually polished
* Responsive
* Modular
* Accessible
* Type-safe
* Easy to extend
* Consistent in design
* Ready for backend integration

Avoid:

* Fake AI claims
* Fake optimization results presented as real
* Nonfunctional buttons
* Excessive placeholder text
* Unexplained technical metrics
* Hardcoded business logic inside UI components
* Overloaded pages
* Unnecessary animations

## Final Deliverable

Generate the complete frontend application with:

* All pages
* Reusable UI components
* Responsive layouts
* Interactive mock data
* Typed API service layer
* Charts and map integration
* Form validation
* Loading and error states
* Demo mode
* README
* Setup instructions

Prioritize a **beautiful user experience, mathematically meaningful visualizations, and a convincing hackathon demonstration** over superficial features.
