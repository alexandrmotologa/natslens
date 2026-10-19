import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  Plus,
  Upload,
  Download,
  Trash2,
  File,
  HardDrive,
  FileText,
  Search,
  Eye,
  X,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { ObjectStoreBucketSummary, ObjectSummary } from '../../lib/types';
import {
  fetchObjectStoreBuckets,
  createObjectStoreBucket,
  deleteObjectStoreBucket,
  fetchObjects,
  uploadObject,
  deleteObject,
} from '../../lib/api';
import { formatBytes, formatDate } from '../../lib/utils';

export const ObjectStoreExplorer: React.FC = () => {
  const [buckets, setBuckets] = useState<ObjectStoreBucketSummary[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');
  const [objects, setObjects] = useState<ObjectSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [isCreateBucketOpen, setIsCreateBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketDesc, setNewBucketDesc] = useState('');
  const [newBucketStorage, setNewBucketStorage] = useState<'file' | 'memory'>('file');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploading, setUploading] = useState(false);

  // Preview Modal
  const [previewName, setPreviewName] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    loadBuckets();
  }, []);

  useEffect(() => {
    if (selectedBucket) {
      loadObjects(selectedBucket);
    } else {
      setObjects([]);
    }
  }, [selectedBucket]);

  const loadBuckets = async () => {
    setLoading(true);
    try {
      const bList = await fetchObjectStoreBuckets();
      setBuckets(bList);
      if (bList.length > 0 && !selectedBucket) {
        setSelectedBucket(bList[0].bucket);
      }
    } catch (err) {
      console.error('Failed to load ObjectStore buckets', err);
    } finally {
      setLoading(false);
    }
  };

  const loadObjects = async (bucketName: string) => {
    setLoading(true);
    try {
      const oList = await fetchObjects(bucketName);
      setObjects(oList);
    } catch (err) {
      console.error('Failed to load objects', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBucketName.trim()) return;
    try {
      await createObjectStoreBucket(newBucketName.trim(), newBucketDesc.trim(), newBucketStorage, 1, 0);
      setIsCreateBucketOpen(false);
      setNewBucketName('');
      setNewBucketDesc('');
      await loadBuckets();
    } catch (err) {
      alert('Failed to create bucket: ' + err);
    }
  };

  const handleDeleteBucket = async () => {
    if (!selectedBucket) return;
    if (!window.confirm(`Delete ObjectStore bucket ${selectedBucket} and all stored files?`)) return;
    try {
      await deleteObjectStoreBucket(selectedBucket);
      await loadBuckets();
    } catch (err) {
      alert('Failed to delete bucket: ' + err);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedBucket) return;
    setUploading(true);
    try {
      await uploadObject(selectedBucket, uploadFile.name, uploadDesc, uploadFile);
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadDesc('');
      await loadObjects(selectedBucket);
    } catch (err) {
      alert('Upload failed: ' + err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteObject = async (name: string) => {
    if (!window.confirm(`Delete object ${name}?`)) return;
    try {
      await deleteObject(selectedBucket, name);
      await loadObjects(selectedBucket);
    } catch (err) {
      alert('Delete failed: ' + err);
    }
  };

  const handlePreview = async (name: string) => {
    setPreviewName(name);
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/objectstore/${encodeURIComponent(selectedBucket)}/objects/${encodeURIComponent(name)}`);
      const text = await res.text();
      setPreviewContent(text);
    } catch (err) {
      setPreviewContent('Failed to load object content: ' + err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const currentBucketMeta = buckets.find((b) => b.bucket === selectedBucket);
  const filteredObjects = objects.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Bucket Selector & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
            <FolderArchive className="w-5 h-5" />
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
                onClick={() => setIsCreateBucketOpen(true)}
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
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-3.5 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>

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
            <span className="text-[11px] text-slate-400 block">Objects Count</span>
            <span className="font-mono text-base font-bold text-white mt-0.5 block">
              {objects.length}
            </span>
          </div>
          <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400 block">Total Storage Size</span>
            <span className="font-mono text-base font-bold text-teal-400 mt-0.5 block">
              {formatBytes(currentBucketMeta.totalBytes)}
            </span>
          </div>
          <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400 block">Storage Backend</span>
            <span className="font-mono text-base font-bold text-slate-200 mt-0.5 block uppercase">
              {currentBucketMeta.storage}
            </span>
          </div>
          <div className="p-3 bg-[#111827] border border-slate-800 rounded-xl">
            <span className="text-[11px] text-slate-400 block">Replicas</span>
            <span className="font-mono text-base font-bold text-slate-200 mt-0.5 block">
              {currentBucketMeta.replicas}
            </span>
          </div>
        </div>
      )}

      {/* Search and Table */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search objects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#111827] border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Size</th>
                <th className="p-3.5">Modified Date</th>
                <th className="p-3.5">SHA-256 Digest</th>
                <th className="p-3.5">Chunks</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredObjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No objects stored in bucket {selectedBucket}.
                  </td>
                </tr>
              ) : (
                filteredObjects.map((obj) => (
                  <tr key={obj.name} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 text-teal-400 shrink-0" />
                        <div>
                          <span className="font-mono font-medium text-white block">{obj.name}</span>
                          {obj.description && (
                            <span className="text-[10px] text-slate-400">{obj.description}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-slate-200">{formatBytes(obj.size)}</td>
                    <td className="p-3.5 font-mono text-slate-400">{formatDate(obj.modTime)}</td>
                    <td className="p-3.5 font-mono text-slate-400 text-[11px]" title={obj.digest}>
                      {obj.digest ? `${obj.digest.slice(0, 16)}...` : '—'}
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">{obj.chunks}</td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => handlePreview(obj.name)}
                        className="p-1 text-slate-400 hover:text-teal-300 rounded hover:bg-slate-800 transition-colors"
                        title="Preview content"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={`/api/objectstore/${encodeURIComponent(selectedBucket)}/objects/${encodeURIComponent(obj.name)}`}
                        download={obj.name}
                        className="inline-block p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                        title="Download object"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleDeleteObject(obj.name)}
                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors"
                        title="Delete object"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Bucket Modal */}
      {isCreateBucketOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#111827] border border-slate-700 rounded-xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-3">Create ObjectStore Bucket</h3>
            <form onSubmit={handleCreateBucket} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Bucket Name *</label>
                <input
                  type="text"
                  required
                  value={newBucketName}
                  onChange={(e) => setNewBucketName(e.target.value)}
                  placeholder="e.g. documents, media"
                  className="w-full px-3 py-1.5 bg-[#090D16] border border-slate-700 rounded text-xs font-mono text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={newBucketDesc}
                  onChange={(e) => setNewBucketDesc(e.target.value)}
                  placeholder="Blob storage bucket"
                  className="w-full px-3 py-1.5 bg-[#090D16] border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Storage Type</label>
                <select
                  value={newBucketStorage}
                  onChange={(e) => setNewBucketStorage(e.target.value as 'file' | 'memory')}
                  className="w-full px-2.5 py-1.5 bg-[#090D16] border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="file">File (Persistent Disk)</option>
                  <option value="memory">Memory (RAM)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateBucketOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#111827] border border-slate-700 rounded-xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-3">Upload File to {selectedBucket}</h3>
            <form onSubmit={handleUpload} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Select File *</label>
                <input
                  type="file"
                  required
                  onChange={(e) => e.target.files && setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-teal-500 file:text-slate-950 hover:file:bg-teal-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full px-3 py-1.5 bg-[#090D16] border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded flex items-center gap-1.5"
                >
                  {uploading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Object Preview Modal */}
      {previewName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#111827] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold text-white">{previewName}</h3>
              <button
                onClick={() => setPreviewName(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto bg-[#090D16] font-mono text-xs">
              {loadingPreview ? (
                <div className="flex items-center justify-center p-12 text-teal-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <pre className="text-slate-200 whitespace-pre-wrap break-all">
                  {previewContent}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
