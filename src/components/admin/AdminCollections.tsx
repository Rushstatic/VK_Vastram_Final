import React, { useState, useEffect } from 'react';
import { Plus, Edit2, CheckCircle2, XCircle, RefreshCw, Save, X, Archive, RotateCcw, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { adminService, CollectionAdminData } from '../../services/adminService';
import { Button } from '../ui/Button';
import { MediaUploader } from './MediaUploader';

export const AdminCollections: React.FC = () => {
  const [collections, setCollections] = useState<CollectionAdminData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCollection, setEditingCollection] = useState<Partial<CollectionAdminData> | null>(null);
  const [saving, setSaving] = useState(false);

  // Safe delete modal
  const [selectedCollection, setSelectedCollection] = useState<CollectionAdminData | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSafety, setDeleteSafety] = useState<{ safe: boolean; reason?: string; productCount?: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCollections = async () => {
    setLoading(true);
    const data = await adminService.getCollections();
    setCollections(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection?.name || !editingCollection?.slug) return;
    setSaving(true);
    await adminService.saveCollection(editingCollection);
    setSaving(false);
    setEditingCollection(null);
    fetchCollections();
  };

  const handleToggleArchive = async (col: CollectionAdminData) => {
    await adminService.saveCollection({ ...col, isActive: !col.isActive });
    fetchCollections();
  };

  const handleDeleteClick = async (col: CollectionAdminData) => {
    setSelectedCollection(col);
    setDeleting(true);
    const check = await adminService.checkCollectionDeleteSafety(col.id);
    setDeleteSafety(check);
    setDeleting(false);
    setDeleteModalOpen(true);
  };

  const handleConfirmHardDelete = async () => {
    if (!selectedCollection) return;
    setDeleting(true);
    const res = await adminService.deleteCollectionSafely(selectedCollection.id);
    setDeleting(false);
    setDeleteModalOpen(false);
    setSelectedCollection(null);
    if (res.success) {
      fetchCollections();
    } else {
      alert(res.error || 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            Collections & Curations
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Create thematic showcases (Heritage Sarees, Artisanal Bedsheets, Seasonal Archive).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCollections}
            title="Refresh collections"
            className="p-2 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() =>
              setEditingCollection({
                name: '',
                slug: '',
                description: '',
                imageUrl: '',
                bannerImageUrl: '',
                sortOrder: collections.length + 1,
                isActive: true,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] text-xs font-medium rounded-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Collection</span>
          </button>
        </div>
      </div>

      {/* Collections Table */}
      <div className="bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F4EFE6] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#1C1917]/10">
            <tr>
              <th className="px-5 py-3 font-semibold">Collection</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Sort Order</th>
              <th className="px-4 py-3 font-semibold">Assigned Products</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C1917]/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[#78716C]">
                  Loading collections...
                </td>
              </tr>
            ) : (
              collections.map((col) => (
                <tr key={col.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                  <td className="px-5 py-3.5 flex items-center gap-3">
                    {col.imageUrl && (
                      <img
                        src={col.imageUrl}
                        alt={col.name}
                        className="w-12 h-9 object-cover rounded-xs bg-[#EFE9DC] shrink-0 border border-[#1C1917]/5"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-[#1C1917] font-serif text-sm">{col.name}</p>
                      <p className="text-[11px] text-[#78716C] line-clamp-1 max-w-xs">{col.description}</p>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-[11px] text-[#57534E]">
                    {col.slug}
                  </td>

                  <td className="px-4 py-3.5 tabular-nums text-[#1C1917]">
                    {col.sortOrder}
                  </td>

                  <td className="px-4 py-3.5 tabular-nums font-medium text-[#1C1917]">
                    {col.productCount ?? 0}
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleToggleArchive(col)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold cursor-pointer ${
                        col.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {col.isActive ? <CheckCircle2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                      <span>{col.isActive ? 'Active' : 'Archived'}</span>
                    </button>
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingCollection(col)}
                        title="Edit Collection"
                        className="p-1.5 text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFE9DC] rounded-xs transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {col.isActive ? (
                        <button
                          onClick={() => handleToggleArchive(col)}
                          title="Archive Collection"
                          className="p-1.5 text-[#78716C] hover:text-amber-700 hover:bg-amber-50 rounded-xs transition-colors cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleArchive(col)}
                          title="Restore Collection"
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteClick(col)}
                        title="Delete Collection"
                        className="p-1.5 text-[#78716C] hover:text-red-700 hover:bg-red-50 rounded-xs transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Modal */}
      {editingCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/60 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
              <h3 className="font-serif text-lg text-[#1C1917] font-medium">
                {editingCollection.id ? 'Edit Collection' : 'Create Collection'}
              </h3>
              <button
                onClick={() => setEditingCollection(null)}
                className="p-1 text-[#78716C] hover:text-[#1C1917] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={editingCollection.name || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    setEditingCollection({
                      ...editingCollection,
                      name: val,
                      slug: editingCollection.slug || autoSlug,
                    });
                  }}
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={editingCollection.slug || ''}
                  onChange={(e) =>
                    setEditingCollection({ ...editingCollection, slug: e.target.value })
                  }
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Description</label>
                <input
                  type="text"
                  value={editingCollection.description || ''}
                  onChange={(e) =>
                    setEditingCollection({ ...editingCollection, description: e.target.value })
                  }
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
                />
              </div>

              <div>
                <MediaUploader
                  label="Cover Image"
                  value={editingCollection.imageUrl || ''}
                  onChange={(url) => setEditingCollection({ ...editingCollection, imageUrl: url })}
                  folder="collections"
                  recommendedSize="Recommended 800 × 1066 px · Ratio 3:4 · One source image"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Sort Order</label>
                <input
                  type="number"
                  value={editingCollection.sortOrder || 1}
                  onChange={(e) =>
                    setEditingCollection({
                      ...editingCollection,
                      sortOrder: Number(e.target.value),
                    })
                  }
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs tabular-nums"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#1C1917]/10">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setEditingCollection(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={saving}
                  leftIcon={<Save className="w-3.5 h-3.5" />}
                >
                  {saving ? 'Saving...' : 'Save Collection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Delete Modal for Collections */}
      {deleteModalOpen && selectedCollection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/70 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border border-[#1C1917]/20 rounded-xs max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-[#1C1917]/10 pb-3">
              <div className="flex items-center gap-2.5">
                {deleteSafety?.safe ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <h3 className="font-serif text-lg text-[#1C1917] font-semibold">
                  {deleteSafety?.safe ? 'Confirm Collection Delete' : 'Collection Delete Blocked — Assigned Products Exist'}
                </h3>
              </div>
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="p-1 text-[#78716C] hover:text-[#1C1917]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#57534E]">
              <div className="bg-[#F4EFE6] p-3 rounded-xs border border-[#1C1917]/10 space-y-1">
                <p className="font-semibold text-[#1C1917] font-serif text-sm">{selectedCollection.name}</p>
                <p className="font-mono text-[11px] text-[#78716C]">Slug: {selectedCollection.slug}</p>
              </div>

              {deleteSafety?.safe ? (
                <p className="text-[#1C1917] font-medium">
                  No products reference this collection. It is safe to permanently delete.
                </p>
              ) : (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xs text-red-900 space-y-2">
                  <p className="font-semibold text-xs">{deleteSafety?.reason}</p>
                  <p className="text-[11px] text-red-700">
                    Deleting a collection with active products will orphan those product assignments. Please reassign products first or archive the collection instead.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1C1917]/10">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#57534E] hover:bg-[#F4EFE6] rounded-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              {deleteSafety?.safe ? (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleConfirmHardDelete}
                  className="px-4 py-2 text-xs font-medium bg-red-700 hover:bg-red-800 text-white rounded-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleting ? 'Deleting...' : 'Confirm Hard Delete'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await handleToggleArchive(selectedCollection);
                    setDeleteModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-medium bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Collection Instead</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
