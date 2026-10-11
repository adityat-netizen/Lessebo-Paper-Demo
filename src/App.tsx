import React from 'react';
import { PlanningProvider, usePlanning } from './context/PlanningContext';
import { WaterProvider } from './context/WaterContext';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { Footer } from './components/layout/Footer';
import { ExecutiveDashboard } from './components/executive/ExecutiveDashboard';
import { SalesForecastView } from './components/forecast/SalesForecastView';
import { ProductionPlanningView } from './components/planning/ProductionPlanningView';
import { SequenceOptimizationView } from './components/sequence/SequenceOptimizationView';
import { ScenarioAnalysisView } from './components/scenario/ScenarioAnalysisView';
import { WaterTelemetryView } from './components/water/telemetry/WaterTelemetryView';
import { WaterAnomalyView } from './components/water/anomaly/WaterAnomalyView';
import { WaterIncidentView } from './components/water/incident/WaterIncidentView';

const MainContent: React.FC = () => {
  const { activeTab } = usePlanning();

  return (
    <main
      style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '24px',
        width: '100%',
        flex: 1,
      }}
    >
      {activeTab === 'executive' && <ExecutiveDashboard />}
      {activeTab === 'forecast' && <SalesForecastView />}
      {activeTab === 'planning' && <ProductionPlanningView />}
      {activeTab === 'sequencing' && <SequenceOptimizationView />}
      {activeTab === 'scenarios' && <ScenarioAnalysisView />}
      {activeTab === 'water-telemetry' && <WaterTelemetryView />}
      {activeTab === 'water-anomalies' && <WaterAnomalyView />}
      {activeTab === 'water-incidents' && <WaterIncidentView />}
    </main>
  );
};

export const App: React.FC = () => {
  return (
    <PlanningProvider>
      <WaterProvider>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--off-white-bg)' }}>
          <Header />
          <Navigation />
          <MainContent />
          <Footer />
        </div>
      </WaterProvider>
    </PlanningProvider>
  );
};

export default App;
