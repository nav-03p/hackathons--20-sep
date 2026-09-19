import React, { useState, Component, type ErrorInfo, type ReactNode } from 'react';
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
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UI Error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-6 bg-[#0a0a0f] text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-semibold text-white mb-1">Component Error</h2>
          <p className="text-xs text-[#6b6b80] max-w-md mb-4">{this.state.error?.message || 'An unexpected error occurred while rendering this page.'}</p>
          <Button variant="primary" size="sm" onClick={() => this.setState({ hasError: false, error: null })}>
            <RefreshCw size={13} /> Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { loaded, loadBengaluru } = useStore();

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
  };

  if (page === 'landing') {
    return (
      <ErrorBoundary>
        <LandingPage onNavigate={navigate} />
      </ErrorBoundary>
    );
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
          <ErrorBoundary>
            <AppPage page={page} navigate={navigate} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
