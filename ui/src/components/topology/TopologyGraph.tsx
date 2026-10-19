import React, { useState, useEffect } from 'react';
import {
  Share2,
  RefreshCw,
  Layers,
  Gauge,
  Radio,
  Server,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { TopologyData, TopologyNode } from '../../lib/types';
import { fetchTopology } from '../../lib/api';

interface TopologyGraphProps {
  onSelectStream?: (name: string) => void;
  onSelectConsumer?: (name: string) => void;
}

export const TopologyGraph: React.FC<TopologyGraphProps> = ({
  onSelectStream,
  onSelectConsumer,
}) => {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const topo = await fetchTopology();
      setData(topo);
    } catch (err: any) {
      setError(err.message || 'Failed to load topology graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 6000);
    return () => clearInterval(interval);
  }, []);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'ingress': return Radio;
      case 'subject': return Zap;
      case 'stream': return Layers;
      case 'consumer': return Gauge;
      case 'worker': return Users;
      default: return Server;
    }
  };

  const getNodeColor = (type: string, status: string) => {
    if (status === 'critical') return 'border-rose-500/80 bg-rose-950/30 text-rose-300';
    if (status === 'warning') return 'border-amber-500/80 bg-amber-950/30 text-amber-300';

    switch (type) {
      case 'ingress': return 'border-cyan-500/50 bg-cyan-950/20 text-cyan-300';
      case 'subject': return 'border-blue-500/50 bg-blue-950/20 text-blue-300';
      case 'stream': return 'border-teal-500/60 bg-teal-950/30 text-teal-300';
      case 'consumer': return 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300';
      case 'worker': return 'border-indigo-500/50 bg-indigo-950/20 text-indigo-300';
      default: return 'border-slate-700 bg-slate-900 text-slate-300';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="w-6 h-6 text-teal-400" />
            <h1 className="text-xl font-bold text-white tracking-wide">Topology & Data Flow Graph</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end visualization of ingress publishers, subject filters, JetStream storage buffers, consumers, and worker delivery paths.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-1.5 bg-[#111827] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Graph Stage */}
      <div className="bg-[#0B101D] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden min-h-[500px]">
        {/* Stage Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        {loading && !data ? (
          <div className="h-96 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
          </div>
        ) : !data || data.nodes.length === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-slate-400 text-xs">
            <Share2 className="w-10 h-10 text-slate-600 mb-3" />
            <span>No active streams or topology entities detected in this cluster.</span>
          </div>
        ) : (
          <div className="space-y-10 relative z-10">
            {/* Visual Flow Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
              {/* Column 1: Publishers & Ingress */}
              <div className="space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-semibold px-2 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>1. Ingress & Subjects</span>
                </div>
                <div className="space-y-3">
                  {data.nodes
                    .filter((n) => n.type === 'ingress' || n.type === 'subject')
                    .map((node) => {
                      const Icon = getNodeIcon(node.type);
                      const isSelected = selectedNode?.id === node.id;
                      return (
                        <div
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative shadow-sm ${getNodeColor(
                            node.type,
                            node.status
                          )} ${isSelected ? 'ring-2 ring-teal-400 scale-[1.02]' : 'hover:scale-[1.01]'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <h4 className="text-xs font-mono font-bold truncate">{node.label}</h4>
                              {node.subtext && (
                                <p className="text-[10px] opacity-75 truncate mt-0.5">{node.subtext}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Column 2: JetStream Streams */}
              <div className="space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-wider text-teal-400 font-semibold px-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>2. JetStream Storage</span>
                </div>
                <div className="space-y-3">
                  {data.nodes
                    .filter((n) => n.type === 'stream')
                    .map((node) => {
                      const Icon = getNodeIcon(node.type);
                      const isSelected = selectedNode?.id === node.id;
                      return (
                        <div
                          key={node.id}
                          onClick={() => {
                            setSelectedNode(node);
                            if (onSelectStream) onSelectStream(node.label);
                          }}
                          className={`p-4 rounded-xl border transition-all cursor-pointer relative shadow-md ${getNodeColor(
                            node.type,
                            node.status
                          )} ${isSelected ? 'ring-2 ring-teal-400 scale-[1.02]' : 'hover:scale-[1.01]'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className="w-4 h-4 shrink-0 text-teal-400" />
                              <div className="min-w-0">
                                <h4 className="text-xs font-mono font-bold truncate text-white">{node.label}</h4>
                                <p className="text-[10px] opacity-75 truncate mt-0.5">{node.subtext}</p>
                              </div>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Column 3: Consumers */}
              <div className="space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold px-2 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5" />
                  <span>3. Consumers & Lag</span>
                </div>
                <div className="space-y-3">
                  {data.nodes
                    .filter((n) => n.type === 'consumer')
                    .map((node) => {
                      const Icon = getNodeIcon(node.type);
                      const isSelected = selectedNode?.id === node.id;
                      return (
                        <div
                          key={node.id}
                          onClick={() => {
                            setSelectedNode(node);
                            if (onSelectConsumer) onSelectConsumer(node.label);
                          }}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative shadow-sm ${getNodeColor(
                            node.type,
                            node.status
                          )} ${isSelected ? 'ring-2 ring-teal-400 scale-[1.02]' : 'hover:scale-[1.01]'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-xs font-mono font-bold truncate">{node.label}</h4>
                                {node.status === 'critical' && (
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                )}
                              </div>
                              <p className="text-[10px] opacity-75 truncate mt-0.5">{node.subtext}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {data.nodes.filter((n) => n.type === 'consumer').length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-xl">
                      No active consumers attached.
                    </div>
                  )}
                </div>
              </div>

              {/* Column 4: Worker Subscribers */}
              <div className="space-y-4">
                <div className="text-[11px] font-mono uppercase tracking-wider text-indigo-400 font-semibold px-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>4. Worker Execution</span>
                </div>
                <div className="space-y-3">
                  {data.nodes
                    .filter((n) => n.type === 'worker')
                    .map((node) => {
                      const Icon = getNodeIcon(node.type);
                      const isSelected = selectedNode?.id === node.id;
                      return (
                        <div
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer relative shadow-sm ${getNodeColor(
                            node.type,
                            node.status
                          )} ${isSelected ? 'ring-2 ring-teal-400 scale-[1.02]' : 'hover:scale-[1.01]'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <h4 className="text-xs font-mono font-bold truncate">{node.label}</h4>
                              <p className="text-[10px] opacity-75 truncate mt-0.5">{node.subtext}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Selected Node Inspector Drawer */}
            {selectedNode && (
              <div className="p-4 bg-[#0F172A] border border-slate-700/80 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
                    {selectedNode.type[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono text-sm">{selectedNode.label}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 text-teal-400 border border-slate-700">
                        {selectedNode.type}
                      </span>
                    </div>
                    <span className="text-slate-400 text-xs">{selectedNode.subtext}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {selectedNode.type === 'stream' && onSelectStream && (
                    <button
                      onClick={() => onSelectStream(selectedNode.label)}
                      className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs"
                    >
                      Open Stream Studio
                    </button>
                  )}
                  {selectedNode.type === 'consumer' && onSelectConsumer && (
                    <button
                      onClick={() => onSelectConsumer(selectedNode.label)}
                      className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-lg text-xs"
                    >
                      Inspect Consumer Lag
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-slate-400 hover:text-white font-mono px-2"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
