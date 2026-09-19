export type Neighborhood = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  demand: number;
  assignedWarehouse?: string;
  deliveryCost?: number;
  distance?: number;
};

export type Warehouse = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  fixedCost: number;
  assignedDemand: number;
  utilization: number;
  neighborhoods: string[];
  isSelected: boolean;
  status: 'optimal' | 'warning' | 'overloaded';
};

export type OptimizationRun = {
  id: string;
  name: string;
  dataset: string;
  algorithm: string;
  warehouseCount: number;
  totalCost: number;
  deliveryCost: number;
  fixedCost: number;
  avgDistance: number;
  runtime: number;
  status: 'completed' | 'running' | 'failed';
  timestamp: string;
  constraintViolations: number;
};

export type Algorithm = {
  name: string;
  key: string;
  totalCost: number;
  deliveryCost: number;
  avgDistance: number;
  runtime: number;
  warehouseCount: number;
  violations: number;
  status: 'optimal' | 'feasible' | 'heuristic';
};

// 32 neighborhoods across a metropolitan area
export const neighborhoods: Neighborhood[] = [
  { id: 'n01', name: 'Downtown Core',       lat: 40.7580, lng: -73.9855, demand: 2840 },
  { id: 'n02', name: 'Midtown East',         lat: 40.7549, lng: -73.9740, demand: 1920 },
  { id: 'n03', name: 'Upper West Side',      lat: 40.7870, lng: -73.9754, demand: 1450 },
  { id: 'n04', name: 'Upper East Side',      lat: 40.7735, lng: -73.9565, demand: 1380 },
  { id: 'n05', name: 'Chelsea',              lat: 40.7465, lng: -74.0014, demand: 1100 },
  { id: 'n06', name: 'Greenwich Village',    lat: 40.7335, lng: -74.0027, demand: 980 },
  { id: 'n07', name: 'SoHo',                lat: 40.7233, lng: -74.0020, demand: 760 },
  { id: 'n08', name: 'Brooklyn Heights',     lat: 40.6960, lng: -73.9937, demand: 1240 },
  { id: 'n09', name: 'Williamsburg',         lat: 40.7081, lng: -73.9571, demand: 1560 },
  { id: 'n10', name: 'Park Slope',           lat: 40.6726, lng: -73.9773, demand: 890 },
  { id: 'n11', name: 'Astoria',              lat: 40.7721, lng: -73.9302, demand: 1120 },
  { id: 'n12', name: 'Long Island City',     lat: 40.7447, lng: -73.9485, demand: 1350 },
  { id: 'n13', name: 'Flushing',             lat: 40.7674, lng: -73.8330, demand: 1780 },
  { id: 'n14', name: 'Jamaica',              lat: 40.7017, lng: -73.7963, demand: 1430 },
  { id: 'n15', name: 'Forest Hills',         lat: 40.7181, lng: -73.8451, demand: 760 },
  { id: 'n16', name: 'Bronx Park',           lat: 40.8560, lng: -73.8756, demand: 1090 },
  { id: 'n17', name: 'Harlem',               lat: 40.8116, lng: -73.9465, demand: 1670 },
  { id: 'n18', name: 'Washington Heights',   lat: 40.8448, lng: -73.9393, demand: 1310 },
  { id: 'n19', name: 'Inwood',               lat: 40.8679, lng: -73.9213, demand: 640 },
  { id: 'n20', name: 'Staten Island North',  lat: 40.6370, lng: -74.1162, demand: 870 },
  { id: 'n21', name: 'Bay Ridge',            lat: 40.6351, lng: -74.0199, demand: 920 },
  { id: 'n22', name: 'Flatbush',             lat: 40.6501, lng: -73.9496, demand: 1480 },
  { id: 'n23', name: 'Crown Heights',        lat: 40.6692, lng: -73.9442, demand: 1190 },
  { id: 'n24', name: 'Sunset Park',          lat: 40.6479, lng: -74.0048, demand: 1020 },
  { id: 'n25', name: 'Greenpoint',           lat: 40.7302, lng: -73.9519, demand: 840 },
  { id: 'n26', name: 'Bushwick',             lat: 40.6944, lng: -73.9213, demand: 1140 },
  { id: 'n27', name: 'East New York',        lat: 40.6724, lng: -73.8868, demand: 1360 },
  { id: 'n28', name: 'Ridgewood',            lat: 40.7039, lng: -73.9038, demand: 780 },
  { id: 'n29', name: 'Jackson Heights',      lat: 40.7557, lng: -73.8830, demand: 1050 },
  { id: 'n30', name: 'Howard Beach',         lat: 40.6590, lng: -73.8440, demand: 590 },
  { id: 'n31', name: 'Rockaway',             lat: 40.5884, lng: -73.8206, demand: 480 },
  { id: 'n32', name: 'Maspeth',              lat: 40.7239, lng: -73.9106, demand: 710 },
];

export const warehouses: Warehouse[] = [
  {
    id: 'w01', name: 'Midtown Hub',
    lat: 40.7549, lng: -73.9840, capacity: 8000, fixedCost: 42000,
    assignedDemand: 6240, utilization: 0.78,
    neighborhoods: ['n01','n02','n03','n04','n05','n17'],
    isSelected: true, status: 'optimal'
  },
  {
    id: 'w02', name: 'Brooklyn Gateway',
    lat: 40.6826, lng: -73.9754, capacity: 6000, fixedCost: 35000,
    assignedDemand: 5830, utilization: 0.97,
    neighborhoods: ['n08','n10','n21','n22','n23','n24'],
    isSelected: true, status: 'warning'
  },
  {
    id: 'w03', name: 'Queens Logistics Center',
    lat: 40.7447, lng: -73.8870, capacity: 7000, fixedCost: 38000,
    assignedDemand: 5990, utilization: 0.856,
    neighborhoods: ['n11','n12','n13','n14','n15','n29','n32'],
    isSelected: true, status: 'optimal'
  },
  {
    id: 'w04', name: 'North Bronx Depot',
    lat: 40.8560, lng: -73.9200, capacity: 4500, fixedCost: 28000,
    assignedDemand: 3040, utilization: 0.676,
    neighborhoods: ['n16','n18','n19'],
    isSelected: true, status: 'optimal'
  },
  {
    id: 'w05', name: 'East Brooklyn Node',
    lat: 40.6840, lng: -73.8900, capacity: 5000, fixedCost: 31000,
    assignedDemand: 4280, utilization: 0.856,
    neighborhoods: ['n26','n27','n28','n30'],
    isSelected: true, status: 'optimal'
  },
];

export const optimizationRuns: OptimizationRun[] = [
  {
    id: 'run-001', name: 'Baseline MILP Run',
    dataset: 'NYC Metro v2', algorithm: 'MILP',
    warehouseCount: 5, totalCost: 412850, deliveryCost: 238850,
    fixedCost: 174000, avgDistance: 4.2,
    runtime: 18.4, status: 'completed',
    timestamp: '2026-09-19T10:23:00Z', constraintViolations: 0,
  },
  {
    id: 'run-002', name: 'Local Search Heuristic',
    dataset: 'NYC Metro v2', algorithm: 'Local Search',
    warehouseCount: 5, totalCost: 431200, deliveryCost: 257200,
    fixedCost: 174000, avgDistance: 4.7,
    runtime: 3.1, status: 'completed',
    timestamp: '2026-09-19T09:45:00Z', constraintViolations: 0,
  },
  {
    id: 'run-003', name: 'Greedy Baseline',
    dataset: 'NYC Metro v2', algorithm: 'Greedy',
    warehouseCount: 6, totalCost: 489400, deliveryCost: 315400,
    fixedCost: 174000, avgDistance: 5.8,
    runtime: 0.3, status: 'completed',
    timestamp: '2026-09-19T09:12:00Z', constraintViolations: 1,
  },
  {
    id: 'run-004', name: 'Simulated Annealing',
    dataset: 'NYC Metro v2', algorithm: 'Simulated Annealing',
    warehouseCount: 5, totalCost: 419700, deliveryCost: 245700,
    fixedCost: 174000, avgDistance: 4.4,
    runtime: 9.7, status: 'completed',
    timestamp: '2026-09-18T16:30:00Z', constraintViolations: 0,
  },
  {
    id: 'run-005', name: 'K-Medoids Run',
    dataset: 'NYC Metro v1', algorithm: 'K-Medoids',
    warehouseCount: 5, totalCost: 456100, deliveryCost: 282100,
    fixedCost: 174000, avgDistance: 5.2,
    runtime: 1.8, status: 'completed',
    timestamp: '2026-09-18T14:20:00Z', constraintViolations: 2,
  },
];

export const algorithms: Algorithm[] = [
  { name: 'MILP',               key: 'milp',   totalCost: 412850, deliveryCost: 238850, avgDistance: 4.2, runtime: 18.4, warehouseCount: 5, violations: 0, status: 'optimal' },
  { name: 'Simulated Annealing',key: 'sa',     totalCost: 419700, deliveryCost: 245700, avgDistance: 4.4, runtime: 9.7,  warehouseCount: 5, violations: 0, status: 'feasible' },
  { name: 'Local Search',       key: 'ls',     totalCost: 431200, deliveryCost: 257200, avgDistance: 4.7, runtime: 3.1,  warehouseCount: 5, violations: 0, status: 'heuristic' },
  { name: 'K-Medoids',          key: 'km',     totalCost: 456100, deliveryCost: 282100, avgDistance: 5.2, runtime: 1.8,  warehouseCount: 5, violations: 2, status: 'heuristic' },
  { name: 'K-Means Baseline',   key: 'kmeans', totalCost: 471300, deliveryCost: 297300, avgDistance: 5.6, runtime: 0.9,  warehouseCount: 5, violations: 3, status: 'heuristic' },
  { name: 'Greedy',             key: 'greedy', totalCost: 489400, deliveryCost: 315400, avgDistance: 5.8, runtime: 0.3,  warehouseCount: 6, violations: 1, status: 'heuristic' },
];

export const costBreakdown = [
  { name: 'Delivery', value: 238850, color: '#3b82f6' },
  { name: 'Fixed',    value: 174000, color: '#6366f1' },
  { name: 'Fuel',     value: 31200,  color: '#8b5cf6' },
  { name: 'Penalty',  value: 0,      color: '#ef4444' },
];

export const sensitivityData = Array.from({ length: 20 }, (_, i) => {
  const costPerKm = 0.5 + i * 0.1;
  return {
    costPerKm: costPerKm.toFixed(1),
    totalCost: Math.round(280000 + costPerKm * 128000 + Math.random() * 4000),
    warehouses: costPerKm < 1.0 ? 4 : costPerKm < 1.5 ? 5 : 6,
  };
});

export const demandForecast = neighborhoods.slice(0, 12).map(n => ({
  name: n.name.split(' ')[0],
  baseline: n.demand,
  growth10: Math.round(n.demand * 1.1),
  growth25: Math.round(n.demand * 1.25),
}));
