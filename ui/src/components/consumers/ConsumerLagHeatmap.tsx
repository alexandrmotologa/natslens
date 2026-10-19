import React from 'react';
import { Gauge, AlertTriangle, CheckCircle2, ShieldAlert, Clock } from 'lucide-react';
import { ConsumerSummary } from '../../lib/types';
import { formatNumber } from '../../lib/utils';

interface ConsumerLagHeatmapProps {
  consumers: ConsumerSummary[];
  onSelectConsumer: (consumer: ConsumerSummary) => void;
}

export const ConsumerLagHeatmap: React.FC<ConsumerLagHeatmapProps> = ({
  consumers,
  onSelectConsumer,
}) => {
  const healthy = consumers.filter((c) => c.healthStatus === 'healthy');
  const warning = consumers.filter((c) => c.healthStatus === 'warning');
  const critical = consumers.filter((c) => c.healthStatus === 'critical');

  const totalRedeliveries = consumers.reduce((acc, c) => acc + c.numRedelivered, 0);
  const totalPending = consumers.reduce((acc, c) => acc + c.numPending, 0);

  return (
    <div className="space-y-6">
      {/* KPI Severity Distribution Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Healthy Card */}
        <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-400">
              Healthy Consumers
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{healthy.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Normal ack throughput</p>
        </div>

        {/* Warning Card */}
        <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-400">
              Warning (Lagging)
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{warning.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Elevated pending or redeliveries</p>
        </div>

        {/* Critical Card */}
        <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-rose-400">
              Critical (AckWait Timeout)
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{critical.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">Stalled or poison messages detected</p>
        </div>

        {/* Total Cluster Redeliveries */}
        <div className="p-4 bg-[#111827] border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-teal-400">
              Total Redeliveries
            </span>
            <Clock className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{formatNumber(totalRedeliveries)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across {formatNumber(totalPending)} pending lag</p>
        </div>
      </div>

      {/* Critical Alerts Banner if any */}
      {critical.length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h4 className="text-sm font-semibold text-rose-300">
              AckWait Timeout Alert: {critical.length} Consumer(s) Stalled
            </h4>
          </div>
          <p className="text-xs text-rose-300/80 mb-3">
            The following consumers have exceeded the configured AckWait timeout and are encountering repeated message redeliveries. Inspect worker health or poison payloads:
          </p>
          <div className="flex flex-wrap gap-2">
            {critical.map((c) => (
              <button
                key={`${c.streamName}-${c.name}`}
                onClick={() => onSelectConsumer(c)}
                className="px-3 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 rounded-lg text-xs font-mono text-rose-200 flex items-center gap-2 transition-colors"
              >
                <span>{c.name} ({c.streamName})</span>
                <span className="px-1.5 py-0.2 bg-rose-500/20 rounded text-[10px]">
                  {c.numRedelivered} redeliveries
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Visual Heatmap Grid */}
      <div className="p-5 bg-[#111827] border border-slate-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-400" />
              Real-Time Consumer Health Heatmap Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Color intensity represents redelivery ratio and unacknowledged in-flight duration
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Healthy</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-400">Warning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-400">Critical</span>
            </div>
          </div>
        </div>

        {consumers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No consumers registered in any active stream.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {consumers.map((c) => {
              const bgClass =
                c.healthStatus === 'healthy'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60'
                  : c.healthStatus === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:border-amber-500/60'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-300 hover:border-rose-500/70 animate-pulse';

              return (
                <div
                  key={`${c.streamName}-${c.name}`}
                  onClick={() => onSelectConsumer(c)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${bgClass}`}
                  title={`${c.name} (${c.streamName})\nPending: ${c.numPending}\nIn-Flight: ${c.numAckPending}\nRedelivered: ${c.numRedelivered}\nAckWait: ${c.ackWaitSeconds}s`}
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block truncate">
                      {c.streamName}
                    </span>
                    <h5 className="font-mono font-bold text-xs truncate text-white mt-0.5">
                      {c.name}
                    </h5>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Lag:</span>
                      <span className="text-slate-200">{formatNumber(c.numPending)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">In-Flight:</span>
                      <span className="text-slate-200">{c.numAckPending}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Redeliv:</span>
                      <span className={c.numRedelivered > 0 ? 'font-bold text-rose-400' : 'text-slate-400'}>
                        {c.numRedelivered}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
