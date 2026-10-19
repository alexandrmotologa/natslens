import React, { useState } from 'react';
import { X, Server, Key, Shield, AlertCircle, CheckCircle2, Sparkles, Loader2 } from 'lucide-react';
import { ConnectionConfig } from '../../lib/types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: ConnectionConfig | null;
  onConnect: (cfg: ConnectionConfig) => Promise<void>;
  onStartDemo: () => Promise<void>;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onConnect,
  onStartDemo,
}) => {
  const [name, setName] = useState(currentConfig?.name || 'Local Cluster');
  const [url, setUrl] = useState(currentConfig?.url || 'nats://127.0.0.1:4222');
  const [authType, setAuthType] = useState<'none' | 'user' | 'token' | 'nkey' | 'creds'>('none');
  const [username, setUsername] = useState(currentConfig?.username || '');
  const [password, setPassword] = useState(currentConfig?.password || '');
  const [token, setToken] = useState(currentConfig?.token || '');
  const [nkey, setNkey] = useState(currentConfig?.nkey || '');
  const [credsFile, setCredsFile] = useState(currentConfig?.credsFile || '');
  const [insecureSkipVerify, setInsecureSkipVerify] = useState(currentConfig?.insecureSkipVerify || false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const cfg: ConnectionConfig = {
        id: `conn-${Date.now()}`,
        name: name || 'NATS Cluster',
        url: url.trim(),
        insecureSkipVerify,
      };

      if (authType === 'user') {
        cfg.username = username;
        cfg.password = password;
      } else if (authType === 'token') {
        cfg.token = token;
      } else if (authType === 'nkey') {
        cfg.nkey = nkey;
      } else if (authType === 'creds') {
        cfg.credsFile = credsFile;
      }

      await onConnect(cfg);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to establish connection to NATS');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRunDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await onStartDemo();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to launch demo server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-slate-700/80 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">NATS Cluster Connection</h2>
              <p className="text-xs text-slate-400">Connect to Core NATS and JetStream nodes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Connected successfully!</span>
            </div>
          )}

          {/* Quick Demo Sandbox Option */}
          <div className="p-3.5 bg-gradient-to-r from-teal-500/10 via-slate-800/60 to-indigo-500/10 border border-teal-500/30 rounded-lg flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs font-semibold text-slate-200">No local NATS instance?</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Launch an in-process JetStream sandbox with simulated live traffic
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunDemo}
              disabled={loading}
              className="px-3 py-1.5 bg-teal-500 text-slate-950 font-medium text-xs rounded-md hover:bg-teal-400 transition-colors shrink-0 shadow"
            >
              Start Demo
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Profile Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Local Cluster, Staging, Edge-01"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Server URL</label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="nats://127.0.0.1:4222"
              className="w-full px-3 py-2 bg-[#090D16] border border-slate-700 rounded-lg text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {/* Authentication Type Tabs */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Authentication</label>
            <div className="grid grid-cols-5 gap-1.5 p-1 bg-[#090D16] border border-slate-800 rounded-lg">
              {(['none', 'user', 'token', 'nkey', 'creds'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setAuthType(t)}
                  className={`py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                    authType === t
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t === 'none' ? 'Anonymous' : t}
                </button>
              ))}
            </div>
          </div>

          {authType === 'user' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-md text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-md text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>
          )}

          {authType === 'token' && (
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Auth Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="s3cr3t-t0k3n"
                className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-md text-xs font-mono text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          )}

          {authType === 'nkey' && (
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">NKey Seed (Starts with SO / SU)</label>
              <input
                type="password"
                value={nkey}
                onChange={(e) => setNkey(e.target.value)}
                placeholder="SU..."
                className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-md text-xs font-mono text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          )}

          {authType === 'creds' && (
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">User Credentials File Path</label>
              <input
                type="text"
                value={credsFile}
                onChange={(e) => setCredsFile(e.target.value)}
                placeholder="C:\Users\username\.nkeys\creds\synadia.creds"
                className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded-md text-xs font-mono text-white focus:outline-none focus:border-teal-500"
              />
            </div>
          )}

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={insecureSkipVerify}
                onChange={(e) => setInsecureSkipVerify(e.target.checked)}
                className="rounded border-slate-700 text-teal-500 focus:ring-teal-500/20 bg-slate-900"
              />
              <span>Skip TLS Certificate Verification (insecure)</span>
            </label>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-medium text-xs rounded-lg transition-all shadow-md shadow-teal-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Connecting...' : 'Connect to Cluster'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
