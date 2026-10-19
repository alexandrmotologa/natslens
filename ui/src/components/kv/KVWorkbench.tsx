import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Plus,
  Search,
  History,
  Trash2,
  Radio,
  FileCode,
  Check,
  AlertCircle,
  Clock,
  HardDrive,
  Save,
  Loader2,
  Download,
  Upload,
} from 'lucide-react';
import { KVBucketSummary, KVEntry } from '../../lib/types';
import {
  fetchKVBuckets,
  fetchKVKeys,
  putKVEntry,
  deleteKVKey,
  purgeKVKey,
  deleteKVBucket,
  exportKVBucket,
  importKVBucket,
} from '../../lib/api';
import { formatBytes, formatNumber, formatDate } from '../../lib/utils';
import { CreateKVModal } from './CreateKVModal';
import { KVRevisionHistory } from './KVRevisionHistory';
import { KVWatchFeed } from './KVWatchFeed';

interface KVWorkbenchProps {
  onRefreshStats: () => void;
}

export const KVWorkbench: React.FC<KVWorkbenchProps> = ({ onRefreshStats }) => {
  const [buckets, setBuckets] = useState<KVBucketSummary[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [keys, setKeys] = useState<KVEntry[]>([]);
  const [selectedKey, setSelectedKey] = useState<KVEntry | null>(null);
  const [keySearch, setKeySearch] = useState('');
  const [editValue, setEditValue] = useState('');
  const [isEditingNew, setIsEditingNew] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');

  const [activeTab, setActiveTab] = useState<'explorer' | 'watch'>('explorer');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadBuckets();
  }, []);

  useEffect(() => {
    if (selectedBucket) {
      loadKeys(selectedBucket);
    } else {
      setKeys([]);
      setSelectedKey(null);
    }
  }, [selectedBucket]);

  const loadBuckets = async () => {
    setLoading(true);
    try {
      const bList = await fetchKVBuckets();
      setBuckets(bList);
      if (bList.length > 0 && !selectedBucket) {
        setSelectedBucket(bList[0].bucket);
      }
    } catch (err) {
      console.error('Failed to load KV buckets', err);
    } finally {
      setLoading(false);
    }
  };

  const loadKeys = async (bucketName: string, prefix = '') => {
    setLoading(true);
    try {
      const kList = await fetchKVKeys(bucketName, prefix);
      setKeys(kList);
      if (kList.length > 0) {
        setSelectedKey(kList[0]);
        setEditValue(kList[0].value);
        setIsEditingNew(false);
      } else {
        setSelectedKey(null);
        setEditValue('');
      }
    } catch (err) {
      console.error('Failed to load keys', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKey = (entry: KVEntry) => {
    setSelectedKey(entry);
    setEditValue(entry.value);
    setIsEditingNew(false);
    setError(null);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(editValue);
      setEditValue(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch {
      setError('Value is not valid JSON');
    }
  };

  const handleSave = async () => {
    const keyToSave = isEditingNew ? newKeyName.trim() : selectedKey?.key;
    if (!keyToSave) {
      setError('Key name is required');
      return;
    }

    setSaveLoading(true);
    setError(null);
    try {
      const res = await putKVEntry(selectedBucket, keyToSave, editValue);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      await loadKeys(selectedBucket);
      const updated = keys.find((k) => k.key === keyToSave);
      if (updated) {
        setSelectedKey(updated);
      }
      setIsEditingNew(false);
      onRefreshStats();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save key value');
      }
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedKey) return;
    if (!window.confirm(`Delete key ${selectedKey.key} (creates deletion tombstone)?`)) return;
    try {
      await deleteKVKey(selectedBucket, selectedKey.key);
      await loadKeys(selectedBucket);
      onRefreshStats();
    } catch (err) {
      alert('Delete failed: ' + err);
    }
  };

  const handlePurge = async () => {
    if (!selectedKey) return;
    if (!window.confirm(`Purge all revision history for key ${selectedKey.key}?`)) return;
    try {
      await purgeKVKey(selectedBucket, selectedKey.key);
      await loadKeys(selectedBucket);
      onRefreshStats();
    } catch (err) {
      alert('Purge failed: ' + err);
    }
  };

  const handleDeleteBucket = async () => {
    if (!selectedBucket) return;
    if (!window.confirm(`Completely drop KV bucket ${selectedBucket} and all contained keys?`)) return;
    try {
      await deleteKVBucket(selectedBucket);
      await loadBuckets();
      onRefreshStats();
    } catch (err) {
      alert('Failed to delete bucket: ' + err);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  const handleExport = async () => {
    if (!selectedBucket) return;
    setExportLoading(true);
    try {
      const data = await exportKVBucket(selectedBucket);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `natslens-kv-${selectedBucket}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Export failed: ' + (err.message || err));
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.bucket || !Array.isArray(parsed.entries)) {
        throw new Error('Invalid KV snapshot file format (requires "bucket" and "entries")');
      }
      const res = await importKVBucket(parsed.bucket, parsed);
      alert(`Successfully imported ${res.importedKeys} keys into bucket ${parsed.bucket}`);
      await loadBuckets();
      setSelectedBucket(parsed.bucket);
      await loadKeys(parsed.bucket);
      onRefreshStats();
    } catch (err: any) {
      alert('Import failed: ' + (err.message || err));
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const currentBucketMeta = buckets.find((b) => b.bucket === selectedBucket);
  const filteredKeys = keys.filter((k) =>
    k.key.toLowerCase().includes(keySearch.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Bucket Selector & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={selectedBucket}
                onChange={(e) => setSelectedBucket(e.target.value)}
                className="bg-[#111827] border border-slate-700 rounded-lg px-3 py-1.5 text-base font-bold font-mono text-white focus:outline-none focus:border-teal-500"
              >
                {buckets.map((b) => (
                  <option key={b.bucket} value={b.bucket}>
                    {b.bucket}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg text-xs transition-colors"
                title="Create New Bucket"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {currentBucketMeta?.description && (
              <p className="text-xs text-slate-400 mt-0.5">{currentBucketMeta.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab buttons */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs">
            <button
              onClick={() => setActiveTab('explorer')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                activeTab === 'explorer'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Key Explorer
            </button>
            <button
              onClick={() => setActiveTab('watch')}
              className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === 'watch'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
              Live Watch Stream
            </button>
          </div>

          {/* Export JSON Button */}
          <button
            onClick={handleExport}
            disabled={exportLoading || !selectedBucket}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Export bucket snapshot to JSON"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden md:inline">Export</span>
          </button>

          {/* Import JSON Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Import bucket from JSON snapshot"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Import</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />

          <button
            onClick={handleDeleteBucket}
            className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
            title="Delete this bucket"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bucket Meta Metrics */}
      {currentBucketMeta && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400 block">Values Stored</span>
            <span className="font-mono text-base font-bold text-white mt-0.5 block">
              {formatNumber(currentBucketMeta.valuesCount)}
            </span>
          </div>
          <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400 block">Storage Size</span>
            <span className="font-mono text-base font-bold text-teal-400 mt-0.5 block">
              {formatBytes(currentBucketMeta.bytesSize)}
            </span>
          </div>
          <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400 block">History Depth</span>
            <span className="font-mono text-base font-bold text-slate-200 mt-0.5 block">
              {currentBucketMeta.history} revs
            </span>
          </div>
          <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400 block">TTL Retention</span>
            <span className="font-mono text-base font-bold text-slate-200 mt-0.5 block">
              {currentBucketMeta.ttlSeconds > 0 ? `${currentBucketMeta.ttlSeconds}s` : 'Persistent'}
            </span>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      {activeTab === 'watch' ? (
        <KVWatchFeed bucket={selectedBucket} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Keys Directory */}
          <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[580px]">
            {/* Keys Search & Add Button */}
            <div className="p-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  placeholder="Filter keys..."
                  value={keySearch}
                  onChange={(e) => setKeySearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 bg-[#090D16] border border-slate-700 rounded text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                onClick={() => {
                  setIsEditingNew(true);
                  setSelectedKey(null);
                  setNewKeyName('');
                  setEditValue('{\n  \n}');
                }}
                className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded flex items-center gap-1 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Key</span>
              </button>
            </div>

            {/* Keys Table List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
              {filteredKeys.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No keys found in bucket {selectedBucket}.
                </div>
              ) : (
                filteredKeys.map((k) => {
                  const isSelected = selectedKey?.key === k.key && !isEditingNew;
                  return (
                    <div
                      key={k.key}
                      onClick={() => handleSelectKey(k)}
                      className={`p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-teal-500/10 border-l-2 border-teal-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-white truncate">
                          {k.key}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-teal-400 border border-slate-700">
                          rev #{k.revision}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        {k.value || '(deleted / empty)'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Key Value Editor & History Inspector */}
          <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-5 flex flex-col max-h-[580px]">
            {isEditingNew || selectedKey ? (
              <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
                {/* Editor Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    {isEditingNew ? (
                      <div>
                        <label className="text-[11px] text-slate-400 block mb-1">New Key Name</label>
                        <input
                          type="text"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          placeholder="e.g. features.beta_chat"
                          className="px-2.5 py-1 bg-[#090D16] border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-teal-500 w-64"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-bold text-sm text-white">
                            {selectedKey?.key}
                          </h3>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
                            Rev #{selectedKey?.revision}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                          Last Modified: {formatDate(selectedKey?.created as unknown as string)}
                        </span>
                      </div>
                    )}
                  </div>

                  {!isEditingNew && (
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <button
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <History className="w-3.5 h-3.5 text-teal-400" />
                        <span>History</span>
                      </button>

                      <button
                        onClick={handleDelete}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                        title="Delete key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={handlePurge}
                        className="px-2 py-1 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded text-[11px] transition-colors"
                        title="Purge all historical revisions"
                      >
                        Purge
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs text-emerald-300 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Saved new revision!</span>
                  </div>
                )}

                {/* Editor Area */}
                <div className="flex-1 flex flex-col space-y-2 overflow-hidden">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Value Editor (JSON / Text)</span>
                    <button
                      type="button"
                      onClick={handleFormatJson}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded text-[11px] flex items-center gap-1 transition-colors"
                    >
                      <FileCode className="w-3 h-3" />
                      Format JSON
                    </button>
                  </div>

                  <textarea
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    rows={12}
                    className="w-full flex-1 p-3 bg-[#090D16] border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500 resize-none"
                    placeholder="Enter key payload..."
                  />
                </div>

                {/* Save Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={handleSave}
                    disabled={saveLoading}
                    className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-teal-500/20 disabled:opacity-50"
                  >
                    {saveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Revision</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 p-8">
                <Database className="w-10 h-10 text-slate-400 mb-2" />
                <p className="text-xs">Select a key from the directory on the left or click "+ Key" to insert a new key.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Bucket Modal */}
      <CreateKVModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (req) => {
          await loadBuckets();
          setSelectedBucket(req.bucket);
          onRefreshStats();
        }}
      />

      {/* Revision History Modal */}
      {selectedKey && (
        <KVRevisionHistory
          bucket={selectedBucket}
          keyName={selectedKey.key}
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}
    </div>
  );
};
