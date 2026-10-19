import React from 'react';
import {
  Activity,
  Layers,
  Gauge,
  Database,
  FolderArchive,
  SendHorizontal,
  Radio,
  Server,
  Sparkles,
  PlugZap,
  Share2,
  AlertOctagon,
  FileCode2,
  Flame,
  BellRing,
} from 'lucide-react';
import { ClusterStats, ConnectionConfig } from '../../lib/types';

export type NavTab =
  | 'cluster'
  | 'topology'
  | 'streams'
  | 'consumers'
  | 'kv'
  | 'dlq'
  | 'schemas'
  | 'traffic'
  | 'alerts'
  | 'objectstore'
  | 'studio'
  | 'tap';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  stats: ClusterStats | null;
  config: ConnectionConfig | null;
  isConnected: boolean;
  onOpenConnectModal: () => void;
  onStartDemo: () => void;
  isDemoLoading: boolean;
  dlqCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  stats,
  config,
  isConnected,
  onOpenConnectModal,
  onStartDemo,
  isDemoLoading,
  dlqCount,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: number; badgeColor?: string }[] = [
    { id: 'cluster', label: 'Cluster Overview', icon: Activity },
    { id: 'topology', label: 'Topology Graph', icon: Share2 },
    {
      id: 'streams',
      label: 'Streams & Subjects',
      icon: Layers,
      badge: stats?.jetstream?.streamsCount,
    },
    {
      id: 'consumers',
      label: 'Consumer Lag & Heatmap',
      icon: Gauge,
      badge: stats?.jetstream?.consumersCount,
    },
    { id: 'kv', label: 'Key-Value Workbench', icon: Database },
    {
      id: 'dlq',
      label: 'Poison Pill / DLQ',
      icon: AlertOctagon,
      badge: dlqCount,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    { id: 'schemas', label: 'Schema Registry', icon: FileCode2 },
    { id: 'traffic', label: 'Traffic & Chaos Studio', icon: Flame },
    { id: 'alerts', label: 'Alerts & Metrics', icon: BellRing },
    { id: 'objectstore', label: 'ObjectStore Explorer', icon: FolderArchive },
    { id: 'studio', label: 'Message Studio & Replay', icon: SendHorizontal },
    { id: 'tap', label: 'Live Tap & Probe', icon: Radio },
  ];

  return (
    <aside className="w-64 bg-[#0D1322] border-r border-slate-800/80 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#27AEE4] to-indigo-600 flex items-center justify-center shadow-lg shadow-teal-500/10 font-mono font-bold text-white text-base">
            NL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white tracking-tight text-base">NATSLens</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded">
                v0.1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">JetStream Observability</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 tracking-wider uppercase">
          Studio Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-teal-500/10 text-teal-300 border border-teal-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    isActive ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Embedded Demo Banner (if not connected or wanting to spin sandbox) */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        <button
          onClick={onStartDemo}
          disabled={isDemoLoading}
          className="w-full mb-3 flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-teal-500/20 to-indigo-500/20 hover:from-teal-500/30 hover:to-indigo-500/30 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-medium transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
          <span>{isDemoLoading ? 'Booting Sandbox...' : 'Run Embedded Sandbox'}</span>
        </button>

        {/* Connection Widget */}
        <div className="bg-[#111827] rounded-lg p-2.5 border border-slate-800">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-xs font-medium text-slate-200">
                {isConnected ? (config?.name || 'Connected') : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={onOpenConnectModal}
              title="Change Connection"
              className="text-xs text-slate-400 hover:text-teal-300 p-1 rounded hover:bg-slate-800 transition-colors"
            >
              <PlugZap className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] font-mono text-slate-400 truncate">
            {config?.url || 'No cluster active'}
          </p>

          {stats && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <Server className="w-3 h-3 text-slate-400" />
                {stats.version ? `v${stats.version}` : 'NATS'}
              </span>
              <span className="text-emerald-400">JetStream Active</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
