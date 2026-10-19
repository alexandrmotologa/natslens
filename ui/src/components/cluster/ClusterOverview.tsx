import React from 'react';
import {
  Server,
  Layers,
  Gauge,
  Database,
  SendHorizontal,
  HardDrive,
  Cpu,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ClusterStats } from '../../lib/types';
import { formatBytes, formatNumber } from '../../lib/utils';
import { NavTab } from '../layout/Sidebar';

interface ClusterOverviewProps {
  stats: ClusterStats | null;
  onNavigate: (tab: NavTab) => void;
  onOpenConnect: () => void;
}

export const ClusterOverview: React.FC<ClusterOverviewProps> = ({ stats, onNavigate, onOpenConnect }) => {
  if (!stats) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4">
          <Server className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Active NATS Connection</h3>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Connect to a local or remote NATS cluster, or run the embedded sandbox to start observing JetStream streams and consumers.
        </p>
        <button
          onClick={onOpenConnect}
          className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-medium text-sm rounded-lg shadow-lg shadow-teal-500/20 transition-all"
        >
          Connect to NATS
        </button>
      </div>
    );
  }

  const js = stats.jetstream;
  const memoryPercent = js && js.memoryMax > 0 ? (js.memoryUsed / js.memoryMax) * 100 : 0;
  const diskPercent = js && js.diskMax > 0 ? (js.diskUsed / js.diskMax) * 100 : 0;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Hero */}
      <div className="p-6 bg-gradient-to-r from-[#111827] via-[#0D1528] to-[#111827] border border-slate-800 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">{stats.serverName || stats.host}</h2>
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Online
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              ID: {stats.serverId} • Version {stats.version || 'v2.10'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('streams')}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            Explore Streams
          </button>
          <button
            onClick={() => onNavigate('consumers')}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            Consumer Lag
          </button>
          <button
            onClick={() => onNavigate('studio')}
            className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <SendHorizontal className="w-3.5 h-3.5" />
            Publish Test Msg
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streams Card */}
        <div
          onClick={() => onNavigate('streams')}
          className="p-5 bg-[#111827] border border-slate-800 hover:border-teal-500/40 rounded-xl transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Streams</span>
            <Layers className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{js?.streamsCount ?? 0}</div>
          <p className="text-xs text-slate-400 mt-1">JetStream stream partitions</p>
        </div>

        {/* Consumers Card */}
        <div
          onClick={() => onNavigate('consumers')}
          className="p-5 bg-[#111827] border border-slate-800 hover:border-amber-500/40 rounded-xl transition-all cursor-pointer group shadow-sm"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Consumers</span>
            <Gauge className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{js?.consumersCount ?? 0}</div>
          <p className="text-xs text-slate-400 mt-1">Pull and push workers</p>
        </div>

        {/* Messages In */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Messages In</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{formatNumber(stats.inMsgs)}</div>
          <p className="text-xs text-slate-400 mt-1">{formatBytes(stats.inBytes)} received</p>
        </div>

        {/* Messages Out */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Messages Out</span>
            <ArrowUpRight className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{formatNumber(stats.outMsgs)}</div>
          <p className="text-xs text-slate-400 mt-1">{formatBytes(stats.outBytes)} delivered</p>
        </div>
      </div>

      {/* JetStream Storage Allocation & Server Diagnostic Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* JetStream Storage Metrics */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-teal-400" />
              <h3 className="text-sm font-semibold text-white">JetStream Storage Limits</h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Storage Engine Active
            </span>
          </div>

          {/* Memory Storage Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-400" /> Memory Storage
              </span>
              <span className="font-mono text-slate-200">
                {formatBytes(js?.memoryUsed ?? 0)} / {js && js.memoryMax > 0 ? formatBytes(js.memoryMax) : 'Unlimited'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(memoryPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Disk / File Storage Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-teal-400" /> Disk / File Storage
              </span>
              <span className="font-mono text-slate-200">
                {formatBytes(js?.diskUsed ?? 0)} / {js && js.diskMax > 0 ? formatBytes(js.diskMax) : 'Unlimited'}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(diskPercent, 100)}%` }}
              />
            </div>
          </div>

          <div className="pt-2 grid grid-cols-2 gap-3 text-xs border-t border-slate-800/80">
            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Streams Partitioned</span>
              <span className="font-mono text-white font-semibold text-sm">{js?.streamsCount ?? 0}</span>
            </div>
            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-400 block text-[11px]">Durable Consumers</span>
              <span className="font-mono text-white font-semibold text-sm">{js?.consumersCount ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Server Node Details */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Server Node Diagnostics</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Connections: {stats.connections}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px] block">Server ID</span>
              <span className="font-mono text-slate-200 truncate block mt-0.5" title={stats.serverId}>
                {stats.serverId || '—'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px] block">Host & Port</span>
              <span className="font-mono text-slate-200 block mt-0.5">
                {stats.host}:{stats.port}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px] block">NATS Protocol</span>
              <span className="font-mono text-slate-200 block mt-0.5">
                Proto v{stats.proto}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px] block">Go Runtime</span>
              <span className="font-mono text-slate-200 block mt-0.5">
                {stats.goVersion || 'go1.23+'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px] block">Security / TLS</span>
              <span className="font-mono text-slate-200 block mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                {stats.tlsRequired ? 'TLS Enforced' : 'Plain / TLS Optional'}
              </span>
            </div>

            <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 text-[11px] block">Uptime</span>
              <span className="font-mono text-slate-200 block mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {stats.uptime || 'Active'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
