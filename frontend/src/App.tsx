import { useState } from 'react';
import { Sidebar, type Page } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { LandingPage } from '@/pages/LandingPage';
import { Dashboard } from '@/pages/Dashboard';
import { OptimizationWorkspace } from '@/pages/OptimizationWorkspace';
import { MapExplorer } from '@/pages/MapExplorer';
import { DemandSimulation } from '@/pages/DemandSimulation';
import { AlgorithmComparison } from '@/pages/AlgorithmComparison';
import { SensitivityAnalysis } from '@/pages/SensitivityAnalysis';
import { ScenarioManager } from '@/pages/ScenarioManager';
import { DataImport } from '@/pages/DataImport';
import { Fulfillment } from '@/pages/Fulfillment';
import { Warehouses } from '@/pages/Warehouses';
import { OptimizationHistory } from '@/pages/OptimizationHistory';
import { Documentation } from '@/pages/Documentation';
import { Settings } from '@/pages/Settings';
import { Tenants } from '@/pages/Tenants';
import { Year } from '@/pages/Year';
import { cn } from '@/lib/utils';
import { useStore } from '@/lib/store';

function AppPage({ page, navigate }: { page: Page; navigate: (p: Page) => void }) {
  switch (page) {
    case 'dashboard':    return <Dashboard onNavigate={navigate} />;
    case 'workspace':    return <OptimizationWorkspace />;
    case 'fulfill':      return <Fulfillment />;
    case 'warehouses':   return <Warehouses />;
    case 'map':          return <MapExplorer />;
    case 'demand':       return <DemandSimulation />;
    case 'algorithms':   return <AlgorithmComparison />;
    case 'sensitivity':  return <SensitivityAnalysis />;
    case 'scenarios':    return <ScenarioManager />;
    case 'import':       return <DataImport />;
    case 'history':      return <OptimizationHistory />;
    case 'docs':         return <Documentation />;
    case 'settings':     return <Settings />;
    case 'tenants':      return <Tenants />;
    case 'year':         return <Year />;
    default:             return <Dashboard onNavigate={navigate} />;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>(() => localStorage.getItem('wlo_token') ? 'map' : 'landing');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loaded, loadSynthetic, token } = useStore();

  const navigate = async (p: Page) => {
    // localStorage is updated synchronously by login/signup, while React state
    // updates on the following render. Reading both lets the auth modal open
    // Map Explorer immediately after a successful submission.
    const authenticated = !!token || !!localStorage.getItem('wlo_token');
    if (p !== 'landing' && !authenticated) {
      setPage('landing');
      return;
    }
    setPage(p);
    setSidebarOpen(false);
    // Every workspace page is immediately usable, even before a user signs in.
    if (p !== 'landing' && p !== 'docs' && p !== 'settings' && !loaded) {
      try { await loadSynthetic(56, 56); } catch { /* the page reports backend errors if unavailable */ }
    }
  };

  if (page === 'landing') {
    return <LandingPage onNavigate={navigate} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop always visible, mobile slide-in */}
      <div className={cn(
        'fixed md:relative z-40 h-full transition-transform duration-200',
        'md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <Sidebar
          current={page}
          onNavigate={navigate}
          onClose={() => setSidebarOpen(false)}
          mobile={sidebarOpen}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav onMenuOpen={() => setSidebarOpen(true)} currentPage={page} onLogout={() => setPage('landing')} />
        <main className="flex-1 overflow-hidden">
          <AppPage page={page} navigate={navigate} />
        </main>
      </div>
    </div>
  );
}
