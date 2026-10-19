import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { ConnectionModal } from './components/layout/ConnectionModal';
import { ClusterOverview } from './components/cluster/ClusterOverview';
import { StreamList } from './components/streams/StreamList';
import { StreamDetail } from './components/streams/StreamDetail';
import { CreateStreamModal } from './components/streams/CreateStreamModal';
import { ConsumerList } from './components/consumers/ConsumerList';
import { CreateConsumerModal } from './components/consumers/CreateConsumerModal';
import { KVWorkbench } from './components/kv/KVWorkbench';
import { ObjectStoreExplorer } from './components/objectstore/ObjectStoreExplorer';
import { MessageStudio } from './components/studio/MessageStudio';
import { CoreNatsTap } from './components/studio/CoreNatsTap';
import { TopologyGraph } from './components/topology/TopologyGraph';
import { DLQWorkbench } from './components/dlq/DLQWorkbench';
import { SchemaRegistry } from './components/schemas/SchemaRegistry';
import { TrafficStudio } from './components/traffic/TrafficStudio';
import { AlertsWorkbench } from './components/alerts/AlertsWorkbench';
import { CommandPalette } from './components/layout/CommandPalette';

import {
  ClusterStats,
  ConnectionConfig,
  StreamSummary,
  StreamDetail as IStreamDetail,
  ConsumerSummary,
  KVBucketSummary,
} from './lib/types';
import {
  fetchClusterStats,
  fetchConnectionConfig,
  fetchStreams,
  fetchStream,
  createStream,
  createConsumer,
  connectCluster,
  startDemoCluster,
  fetchConsumers,
  fetchKVBuckets,
  fetchDLQMessages,
} from './lib/api';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('cluster');
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [config, setConfig] = useState<ConnectionConfig | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [streams, setStreams] = useState<StreamSummary[]>([]);
  const [consumers, setConsumers] = useState<ConsumerSummary[]>([]);
  const [kvBuckets, setKvBuckets] = useState<KVBucketSummary[]>([]);
  const [dlqCount, setDlqCount] = useState<number>(0);
  const [selectedStreamDetail, setSelectedStreamDetail] = useState<IStreamDetail | null>(null);

  // Modals
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isCreateStreamModalOpen, setIsCreateStreamModalOpen] = useState(false);
  const [isCreateConsumerModalOpen, setIsCreateConsumerModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  // Global Ctrl+K / Cmd+K Command Palette Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Poll cluster data every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshDataSilently();
    }, 4000);
    return () => clearInterval(interval);
  }, [currentTab, selectedStreamDetail]);

  const loadInitialData = async () => {
    try {
      const cfg = await fetchConnectionConfig();
      if (cfg && cfg.url) {
        setConfig(cfg);
      }
    } catch {
      // not yet configured
    }
    await refreshAllData();
  };

  const refreshAllData = async () => {
    setIsRefreshing(true);
    try {
      const s = await fetchClusterStats();
      setStats(s);
      setIsConnected(true);

      const strList = await fetchStreams();
      setStreams(strList);

      // Collect consumers across all streams
      let allConsumers: ConsumerSummary[] = [];
      for (const st of strList) {
        try {
          const cons = await fetchConsumers(st.name);
          allConsumers = allConsumers.concat(cons);
        } catch {
          // ignore
        }
      }
      setConsumers(allConsumers);

      // Load KV buckets for palette and workbench
      try {
        const buckets = await fetchKVBuckets();
        setKvBuckets(buckets);
      } catch {
        // ignore
      }

      // Load DLQ message count for badge
      try {
        const dlqMsgs = await fetchDLQMessages();
        setDlqCount(dlqMsgs.length);
      } catch {
        // ignore
      }

      if (selectedStreamDetail) {
        try {
          const refreshedDetail = await fetchStream(selectedStreamDetail.name);
          setSelectedStreamDetail(refreshedDetail);
        } catch {
          setSelectedStreamDetail(null);
        }
      }
    } catch (err) {
      setIsConnected(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshDataSilently = async () => {
    try {
      const s = await fetchClusterStats();
      setStats(s);
      setIsConnected(true);

      const strList = await fetchStreams();
      setStreams(strList);

      let allConsumers: ConsumerSummary[] = [];
      for (const st of strList) {
        try {
          const cons = await fetchConsumers(st.name);
          allConsumers = allConsumers.concat(cons);
        } catch {
          // ignore
        }
      }
      setConsumers(allConsumers);

      try {
        const buckets = await fetchKVBuckets();
        setKvBuckets(buckets);
      } catch {
        // ignore
      }

      try {
        const dlqMsgs = await fetchDLQMessages();
        setDlqCount(dlqMsgs.length);
      } catch {
        // ignore
      }

      if (selectedStreamDetail) {
        try {
          const refreshedDetail = await fetchStream(selectedStreamDetail.name);
          setSelectedStreamDetail(refreshedDetail);
        } catch {
          // stream might be deleted
        }
      }
    } catch {
      // ignore
    }
  };

  const handleConnect = async (cfg: ConnectionConfig) => {
    const res = await connectCluster(cfg);
    setConfig(res.config);
    if (res.stats) setStats(res.stats);
    setIsConnected(true);
    await refreshAllData();
  };

  const handleStartDemo = async () => {
    setIsDemoLoading(true);
    try {
      const res = await startDemoCluster();
      setIsConnected(true);
      if (res.stats) setStats(res.stats);
      await refreshAllData();
    } catch (err) {
      alert('Failed to boot demo cluster: ' + err);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleSelectStream = async (name: string) => {
    try {
      const detail = await fetchStream(name);
      setSelectedStreamDetail(detail);
    } catch (err) {
      alert('Failed to load stream details: ' + err);
    }
  };

  const handleCreateStream = async (req: any) => {
    const created = await createStream(req);
    await refreshAllData();
    setSelectedStreamDetail(created);
  };

  const handleCreateConsumer = async (req: any) => {
    await createConsumer(req);
    await refreshAllData();
  };

  return (
    <div className="flex h-screen bg-[#090D16] text-slate-100 overflow-hidden">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSelectedStreamDetail(null);
        }}
        stats={stats}
        config={config}
        isConnected={isConnected}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onStartDemo={handleStartDemo}
        isDemoLoading={isDemoLoading}
        dlqCount={dlqCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Navbar
          currentTab={currentTab}
          stats={stats}
          onRefresh={refreshAllData}
          isRefreshing={isRefreshing}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          primaryActionLabel={
            currentTab === 'streams' && !selectedStreamDetail
              ? '+ New Stream'
              : currentTab === 'consumers'
              ? '+ New Consumer'
              : undefined
          }
          onPrimaryAction={
            currentTab === 'streams' && !selectedStreamDetail
              ? () => setIsCreateStreamModalOpen(true)
              : currentTab === 'consumers'
              ? () => setIsCreateConsumerModalOpen(true)
              : undefined
          }
        />

        <main className="flex-1 pb-16">
          {currentTab === 'cluster' && (
            <ClusterOverview
              stats={stats}
              onNavigate={(tab) => {
                setCurrentTab(tab);
                setSelectedStreamDetail(null);
              }}
              onOpenConnect={() => setIsConnectModalOpen(true)}
            />
          )}

          {currentTab === 'topology' && (
            <TopologyGraph
              onSelectStream={handleSelectStream}
              onSelectConsumer={() => setCurrentTab('consumers')}
            />
          )}

          {currentTab === 'streams' && (
            selectedStreamDetail ? (
              <StreamDetail
                stream={selectedStreamDetail}
                onBack={() => setSelectedStreamDetail(null)}
                onRefresh={refreshAllData}
                onSelectConsumer={() => setCurrentTab('consumers')}
              />
            ) : (
              <StreamList
                streams={streams}
                onSelectStream={handleSelectStream}
                onOpenCreateModal={() => setIsCreateStreamModalOpen(true)}
              />
            )
          )}

          {currentTab === 'consumers' && (
            <ConsumerList
              consumers={consumers}
              streams={streams}
              onRefresh={refreshAllData}
              onOpenCreateModal={() => setIsCreateConsumerModalOpen(true)}
            />
          )}

          {currentTab === 'kv' && (
            <KVWorkbench onRefreshStats={refreshAllData} />
          )}

          {currentTab === 'dlq' && (
            <DLQWorkbench />
          )}

          {currentTab === 'schemas' && (
            <SchemaRegistry />
          )}

          {currentTab === 'traffic' && (
            <TrafficStudio />
          )}

          {currentTab === 'alerts' && (
            <AlertsWorkbench />
          )}

          {currentTab === 'objectstore' && (
            <ObjectStoreExplorer />
          )}

          {currentTab === 'studio' && (
            <MessageStudio streams={streams} />
          )}

          {currentTab === 'tap' && (
            <CoreNatsTap />
          )}
        </main>
      </div>

      {/* Global Modals */}
      <ConnectionModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        currentConfig={config}
        onConnect={handleConnect}
        onStartDemo={handleStartDemo}
      />

      <CreateStreamModal
        isOpen={isCreateStreamModalOpen}
        onClose={() => setIsCreateStreamModalOpen(false)}
        onSubmit={handleCreateStream}
      />

      <CreateConsumerModal
        isOpen={isCreateConsumerModalOpen}
        onClose={() => setIsCreateConsumerModalOpen(false)}
        streams={streams}
        onSubmit={handleCreateConsumer}
      />

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => {
          setCurrentTab(tab);
          setSelectedStreamDetail(null);
        }}
        streams={streams}
        kvBuckets={kvBuckets}
        consumers={consumers}
        onSelectStream={handleSelectStream}
        onSelectKVBucket={() => {
          setCurrentTab('kv');
        }}
      />
    </div>
  );
};

export default App;
