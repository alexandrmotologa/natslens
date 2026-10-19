import React from 'react';
import { RefreshCw, Activity, Cpu, ArrowDownLeft, ArrowUpRight, Search } from 'lucide-react';
import { ClusterStats } from '../../lib/types';
import { formatBytes, formatNumber } from '../../lib/utils';
import { NavTab } from './Sidebar';

interface NavbarProps {
  currentTab: NavTab;
  stats: ClusterStats | null;
  onRefresh: () => void;
  isRefreshing: boolean;
  onPrimaryAction?: () => void;
  primaryActionLabel?: string;
  onOpenCommandPalette?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  stats,
  onRefresh,
  isRefreshing,
  onPrimaryAction,
  primaryActionLabel,
  onOpenCommandPalette,
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'cluster':
        return { title: 'Cluster Overview', sub: 'Server diagnostics, connections, and JetStream engine limits' };
      case 'topology':
        return { title: 'Visual Topology & Dataflow Graph', sub: 'Interactive map of publishers, ingress subjects, JetStream streams, consumers, and workers' };
      case 'streams':
        return { title: 'Stream & Subject Hierarchy Visualizer', sub: 'Inspect stream retention, storage allocation, and subject tree breakdown' };
      case 'consumers':
        return { title: 'Real-Time Consumer Lag & Redelivery Heatmap', sub: 'Monitor unacknowledged queues, redelivery ratios, and AckWait timeouts' };
      case 'kv':
        return { title: 'JetStream Key-Value Workbench', sub: 'Explore buckets, edit values, view revision history, and watch live mutations' };
      case 'dlq':
        return { title: 'Poison Pill Quarantine & DLQ Workbench', sub: 'Inspect failed messages, diagnose unparseable payloads, edit JSON in-place, and re-publish' };
      case 'schemas':
        return { title: 'Schema Registry & Live Payload Validator', sub: 'Define JSON Schema contracts, bind to wildcard subjects, and validate message payloads' };
      case 'traffic':
        return { title: 'Traffic Generator & Chaos Studio', sub: 'Inject synthetic loads, evaluate dynamic template variables, and simulate cluster faults' };
      case 'alerts':
        return { title: 'Alerts Engine & Prometheus Exporter', sub: 'Configure threshold rules for consumer lag and redeliveries with webhook notifications' };
      case 'objectstore':
        return { title: 'JetStream ObjectStore Explorer', sub: 'Manage chunked binary storage, schemas, configurations, and files' };
      case 'studio':
        return { title: 'Message Studio & Stream Replay Engine', sub: 'Publish test payloads with deduplication headers and replay historical streams' };
      case 'tap':
        return { title: 'Live Core NATS Tap & Request-Reply Probe', sub: 'Stream real-time subjects with wildcards and measure request-reply latencies' };
    }
  };

  const { title, sub } = getTabTitle();

  return (
    <header className="h-16 px-6 bg-[#0D1322]/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-base font-semibold text-white tracking-tight">{title}</h1>
        <p className="text-xs text-slate-400 hidden sm:block">{sub}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Command Palette Trigger */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#111827] hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors shadow-sm"
          >
            <Search className="w-3.5 h-3.5 text-teal-400" />
            <span>Search anything...</span>
            <kbd className="ml-1 px-1.5 py-0.5 bg-slate-900 border border-slate-700/80 rounded text-[10px] font-mono text-slate-300">
              Ctrl+K
            </kbd>
          </button>
        )}
        {/* Real-time Cluster Pill */}
        {stats && (
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              <span>{stats.connections} conn</span>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center gap-1 text-slate-400">
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>{formatNumber(stats.inMsgs)}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatNumber(stats.outMsgs)}</span>
            </div>
            {stats.memBytes > 0 && (
              <>
                <div className="h-3 w-px bg-slate-800" />
                <div className="flex items-center gap-1 text-slate-400">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span>{formatBytes(stats.memBytes)}</span>
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Current Data"
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
        </button>

        {onPrimaryAction && primaryActionLabel && (
          <button
            onClick={onPrimaryAction}
            className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors shadow-sm shadow-teal-500/20"
          >
            {primaryActionLabel}
          </button>
        )}
      </div>
    </header>
  );
};
