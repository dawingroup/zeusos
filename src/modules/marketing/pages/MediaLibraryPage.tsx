/**
 * MediaLibraryPage
 * Full-featured media library with upload, browse, search, and folder management
 * Backed by Firebase Storage
 */

import { useState, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  Upload,
  Search,
  LayoutGrid,
  List,
  FolderPlus,
  Image,
  Video,
  FileText,
  Music,
  File,
  Trash2,
  Edit3,
  Download,
  MoreVertical,
  X,
  Check,
  FolderOpen,
  HardDrive,
} from 'lucide-react';
import { useMediaLibrary } from '../hooks';
import type { MediaAssetType, MediaViewMode, MediaAsset, MediaFolder } from '../types';

// ============================================
// Helper Components
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getAssetIcon(type: MediaAssetType) {
  switch (type) {
    case 'image': return Image;
    case 'video': return Video;
    case 'document': return FileText;
    case 'audio': return Music;
    default: return File;
  }
}

const ASSET_TYPE_FILTERS: { value: MediaAssetType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'document', label: 'Documents' },
  { value: 'audio', label: 'Audio' },
  { value: 'other', label: 'Other' },
];

// ============================================
// Upload Drop Zone
// ============================================

function UploadDropZone({
  onFilesSelected,
  uploading,
}: {
  onFilesSelected: (files: File[]) => void;
  uploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) onFilesSelected(files);
  }, [onFilesSelected]);

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-gray-300 hover:border-gray-400'
      } ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onFilesSelected(files);
          e.target.value = '';
        }}
      />
      <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-700">
        {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Images, videos, documents up to 100MB each
      </p>
    </div>
  );
}

// ============================================
// Upload Progress Bar
// ============================================

function UploadProgressList({ progress }: { progress: Array<{ fileName: string; progress: number; status: string; error?: string }> }) {
  if (progress.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Upload Progress</h3>
      {progress.map((p, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-700 truncate max-w-[200px]">{p.fileName}</span>
            <span className={
              p.status === 'complete' ? 'text-green-600' :
              p.status === 'error' ? 'text-red-600' :
              'text-blue-600'
            }>
              {p.status === 'complete' ? 'Done' : p.status === 'error' ? p.error || 'Failed' : `${p.progress}%`}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                p.status === 'error' ? 'bg-red-500' : p.status === 'complete' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${p.progress}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Asset Card (Grid View)
// ============================================

function AssetCard({
  asset,
  onDelete,
  onEdit,
  selected,
  onSelect,
}: {
  asset: MediaAsset;
  onDelete: (id: string) => void;
  onEdit: (asset: MediaAsset) => void;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const Icon = getAssetIcon(asset.assetType);
  const isImage = asset.assetType === 'image';

  return (
    <div
      className={`group relative bg-white rounded-lg border overflow-hidden hover:shadow-md transition-all cursor-pointer ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
      }`}
      onClick={() => onSelect(asset.id)}
    >
      {/* Thumbnail / Preview */}
      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        {isImage && asset.downloadUrl ? (
          <img
            src={asset.downloadUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Icon className="h-12 w-12 text-gray-300" />
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-gray-500">{formatFileSize(asset.fileSize)}</span>
          {asset.dimensions && (
            <span className="text-xs text-gray-400">{asset.dimensions.width}×{asset.dimensions.height}</span>
          )}
        </div>
        {asset.tags.length > 0 && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {asset.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions Overlay */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="p-1.5 bg-white/90 rounded-md shadow-sm hover:bg-white"
          >
            <MoreVertical className="h-4 w-4 text-gray-600" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(asset); setShowMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit Details
              </button>
              <a
                href={asset.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </a>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(asset.id); setShowMenu(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Selection Indicator */}
      {selected && (
        <div className="absolute top-2 left-2">
          <div className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center">
            <Check className="h-3 w-3" />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Asset Row (List View)
// ============================================

function AssetRow({
  asset,
  onDelete,
  onEdit,
}: {
  asset: MediaAsset;
  onDelete: (id: string) => void;
  onEdit: (asset: MediaAsset) => void;
}) {
  const Icon = getAssetIcon(asset.assetType);
  const date = asset.createdAt?.toDate?.();

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-100 hover:bg-gray-50 transition-colors">
      {/* Icon / Thumbnail */}
      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {asset.assetType === 'image' && asset.downloadUrl ? (
          <img src={asset.downloadUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <Icon className="h-5 w-5 text-gray-400" />
        )}
      </div>

      {/* Name & Meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
        <p className="text-xs text-gray-500">
          {formatFileSize(asset.fileSize)}
          {asset.dimensions && ` · ${asset.dimensions.width}×${asset.dimensions.height}`}
          {date && ` · ${date.toLocaleDateString()}`}
        </p>
      </div>

      {/* Tags */}
      <div className="hidden md:flex gap-1">
        {asset.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{tag}</span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button onClick={() => onEdit(asset)} className="p-1.5 hover:bg-gray-100 rounded-md" title="Edit">
          <Edit3 className="h-4 w-4 text-gray-500" />
        </button>
        <a href={asset.downloadUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-gray-100 rounded-md" title="Download">
          <Download className="h-4 w-4 text-gray-500" />
        </a>
        <button onClick={() => onDelete(asset.id)} className="p-1.5 hover:bg-red-50 rounded-md" title="Delete">
          <Trash2 className="h-4 w-4 text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// Folder Sidebar
// ============================================

function FolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
}: {
  folders: MediaFolder[];
  selectedFolderId: string | undefined;
  onSelectFolder: (id: string | undefined) => void;
  onCreateFolder: () => void;
  onDeleteFolder: (id: string) => void;
}) {
  return (
    <div className="w-56 border-r border-gray-200 bg-gray-50/50 flex-shrink-0">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Folders</span>
          <button onClick={onCreateFolder} className="p-1 hover:bg-gray-200 rounded" title="New Folder">
            <FolderPlus className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* All files */}
        <button
          onClick={() => onSelectFolder(undefined)}
          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors ${
            !selectedFolderId ? 'bg-primary text-primary-foreground' : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          <HardDrive className="h-4 w-4" />
          All Files
        </button>

        {/* Folder list */}
        <div className="mt-1 space-y-0.5">
          {folders.map((folder) => (
            <div key={folder.id} className="group flex items-center">
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={`flex items-center gap-2 flex-1 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  selectedFolderId === folder.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <FolderOpen className="h-4 w-4" />
                <span className="truncate">{folder.name}</span>
              </button>
              <button
                onClick={() => onDeleteFolder(folder.id)}
                className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded"
              >
                <X className="h-3 w-3 text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function MediaLibraryPage() {
  const {
    assets,
    folders,
    loading,
    uploading,
    uploadProgress,
    uploadAssets,
    removeAsset,
    addFolder,
    removeFolder,
    filters,
    setFilters,
  } = useMediaLibrary();

  const [viewMode, setViewMode] = useState<MediaViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);

  // Handle file upload
  const handleFilesSelected = useCallback(async (files: File[]) => {
    const requests = files.map((file) => ({ file }));
    await uploadAssets(requests);
    setShowUpload(false);
  }, [uploadAssets]);

  // Handle search
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    setFilters({ ...filters, search: value || undefined });
  }, [filters, setFilters]);

  // Handle type filter
  const handleTypeFilter = useCallback((type: MediaAssetType | '') => {
    setFilters({ ...filters, assetType: type || undefined });
  }, [filters, setFilters]);

  // Handle folder selection
  const handleFolderSelect = useCallback((folderId: string | undefined) => {
    setFilters({ ...filters, folderId });
  }, [filters, setFilters]);

  // Create folder
  const handleCreateFolder = useCallback(async () => {
    const name = window.prompt('Folder name:');
    if (name) await addFolder(name);
  }, [addFolder]);

  // Toggle asset selection
  const toggleAssetSelection = useCallback((id: string) => {
    setSelectedAssets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Delete asset with confirmation
  const handleDeleteAsset = useCallback(async (id: string) => {
    if (window.confirm('Delete this asset? This cannot be undone.')) {
      await removeAsset(id);
      setSelectedAssets((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [removeAsset]);

  return (
    <>
      <Helmet>
        <title>Media Library | Marketing Hub</title>
      </Helmet>

      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
              <p className="text-sm text-muted-foreground">
                Upload and manage images, videos, and documents for your campaigns
              </p>
            </div>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload Files
            </button>
          </div>

          {/* Upload Zone */}
          {showUpload && (
            <div className="mb-4">
              <UploadDropZone onFilesSelected={handleFilesSelected} uploading={uploading} />
            </div>
          )}

          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="mb-4">
              <UploadProgressList progress={uploadProgress} />
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Type Filter */}
            <select
              value={filters.assetType || ''}
              onChange={(e) => handleTypeFilter(e.target.value as MediaAssetType | '')}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {ASSET_TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>

            {/* View Mode Toggle */}
            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Bulk Delete */}
            {selectedAssets.size > 0 && (
              <button
                onClick={async () => {
                  if (window.confirm(`Delete ${selectedAssets.size} selected assets?`)) {
                    for (const id of selectedAssets) {
                      await removeAsset(id);
                    }
                    setSelectedAssets(new Set());
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Delete ({selectedAssets.size})
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Folder Sidebar */}
          <FolderSidebar
            folders={folders}
            selectedFolderId={filters.folderId}
            onSelectFolder={handleFolderSelect}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={async (id) => {
              if (window.confirm('Delete this folder? Assets will be moved to All Files.')) {
                await removeFolder(id);
              }
            }}
          />

          {/* Assets Grid/List */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-16">
                <Image className="h-16 w-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No assets found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {filters.search || filters.assetType || filters.folderId
                    ? 'Try adjusting your filters'
                    : 'Upload your first file to get started'}
                </p>
                {!filters.search && !filters.assetType && !filters.folderId && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="mt-4 text-primary text-sm hover:underline"
                  >
                    Upload Files
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    selected={selectedAssets.has(asset.id)}
                    onSelect={toggleAssetSelection}
                    onDelete={handleDeleteAsset}
                    onEdit={setEditingAsset}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {assets.map((asset) => (
                  <AssetRow
                    key={asset.id}
                    asset={asset}
                    onDelete={handleDeleteAsset}
                    onEdit={setEditingAsset}
                  />
                ))}
              </div>
            )}

            {/* Results count */}
            {!loading && assets.length > 0 && (
              <div className="mt-4 text-xs text-gray-500 text-center">
                {assets.length} asset{assets.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Asset Modal */}
      {editingAsset && (
        <EditAssetModal
          asset={editingAsset}
          onClose={() => setEditingAsset(null)}
        />
      )}
    </>
  );
}

// ============================================
// Edit Asset Modal
// ============================================

function EditAssetModal({ asset, onClose }: { asset: MediaAsset; onClose: () => void }) {
  const { updateAsset } = useMediaLibrary();
  const [name, setName] = useState(asset.name);
  const [description, setDescription] = useState(asset.description || '');
  const [tagsInput, setTagsInput] = useState(asset.tags.join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAsset(asset.id, {
        name,
        description,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      });
      onClose();
    } catch (err) {
      console.error('Failed to update asset:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Edit Asset</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. product, interior, showroom"
              className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="text-xs text-gray-500">
            <span className="font-medium">File:</span> {asset.originalFileName} · {formatFileSize(asset.fileSize)}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
