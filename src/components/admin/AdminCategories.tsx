import React, { useState, useEffect } from 'react';
import { Plus, Edit2, CheckCircle2, XCircle, RefreshCw, Save, X, Archive, RotateCcw, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { adminService, CategoryAdminData } from '../../services/adminService';
import { Button } from '../ui/Button';
import { MediaUploader } from './MediaUploader';

export const AdminCategories: React.FC = () => {
  const [categories, setCategories] = useState<CategoryAdminData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<Partial<CategoryAdminData> | null>(null);
  const [saving, setSaving] = useState(false);

  // Safe delete modal
  const [selectedCategory, setSelectedCategory] = useState<CategoryAdminData | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSafety, setDeleteSafety] = useState<{ safe: boolean; reason?: string; productCount?: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    const data = await adminService.getCategories();
    setCategories(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory?.name || !editingCategory?.slug) return;
    setSaving(true);
    await adminService.saveCategory(editingCategory);
    setSaving(false);
    setEditingCategory(null);
    fetchCategories();
  };

  const handleToggleArchive = async (cat: CategoryAdminData) => {
    await adminService.saveCategory({ ...cat, isActive: !cat.isActive });
    fetchCategories();
  };

  const handleDeleteClick = async (cat: CategoryAdminData) => {
    setSelectedCategory(cat);
    setDeleting(true);
    const check = await adminService.checkCategoryDeleteSafety(cat.id);
    setDeleteSafety(check);
    setDeleting(false);
    setDeleteModalOpen(true);
  };

  const handleConfirmHardDelete = async () => {
    if (!selectedCategory) return;
    setDeleting(true);
    const res = await adminService.deleteCategorySafely(selectedCategory.id);
    setDeleting(false);
    setDeleteModalOpen(false);
    setSelectedCategory(null);
    if (res.success) {
      fetchCategories();
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
            Taxonomy & Categories
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Manage top-level store departments (Sarees, Bedsheets, Home Textiles).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCategories}
            title="Refresh categories"
            className="p-2 bg-[#FAF8F5] border border-[#1C1917]/15 rounded-xs hover:bg-[#F4EFE6] text-[#57534E] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() =>
              setEditingCategory({
                name: '',
                slug: '',
                description: '',
                imageUrl: '',
                sortOrder: categories.length + 1,
                isActive: true,
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] text-xs font-medium rounded-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Category</span>
          </button>
        </div>
      </div>

      {/* Categories Data Grid */}
      <div className="bg-[#FAF8F5] rounded-xs border border-[#1C1917]/10 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F4EFE6] text-[#78716C] uppercase text-[10px] tracking-wider border-b border-[#1C1917]/10">
            <tr>
              <th className="px-5 py-3 font-semibold">Category Name</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Sort Order</th>
              <th className="px-4 py-3 font-semibold">Live Products</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1C1917]/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[#78716C]">
                  Loading categories...
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                  <td className="px-5 py-3.5 flex items-center gap-3">
                    {cat.imageUrl && (
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-9 h-11 object-cover rounded-xs bg-[#EFE9DC] shrink-0 border border-[#1C1917]/5"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-[#1C1917] font-serif text-sm">{cat.name}</p>
                      <p className="text-[11px] text-[#78716C] line-clamp-1 max-w-xs">{cat.description}</p>
                    </div>
                  </td>

                  <td className="px-4 py-3.5 font-mono text-[11px] text-[#57534E]">
                    {cat.slug}
                  </td>

                  <td className="px-4 py-3.5 tabular-nums text-[#1C1917]">
                    {cat.sortOrder}
                  </td>

                  <td className="px-4 py-3.5 tabular-nums font-medium text-[#1C1917]">
                    {cat.productCount ?? 0}
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleToggleArchive(cat)}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xs text-[10px] uppercase tracking-wider font-semibold cursor-pointer ${
                        cat.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-zinc-200 text-zinc-700'
                      }`}
                    >
                      {cat.isActive ? <CheckCircle2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                      <span>{cat.isActive ? 'Active' : 'Archived'}</span>
                    </button>
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingCategory(cat)}
                        title="Edit Category"
                        className="p-1.5 text-[#57534E] hover:text-[#1C1917] hover:bg-[#EFE9DC] rounded-xs transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {cat.isActive ? (
                        <button
                          onClick={() => handleToggleArchive(cat)}
                          title="Archive Category"
                          className="p-1.5 text-[#78716C] hover:text-amber-700 hover:bg-amber-50 rounded-xs transition-colors cursor-pointer"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleArchive(cat)}
                          title="Restore Category"
                          className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 rounded-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteClick(cat)}
                        title="Delete Category"
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
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C1917]/60 backdrop-blur-xs">
          <div className="bg-[#FAF8F5] border border-[#1C1917]/10 rounded-xs w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
              <h3 className="font-serif text-lg text-[#1C1917] font-medium">
                {editingCategory.id ? 'Edit Category' : 'Create Category'}
              </h3>
              <button
                onClick={() => setEditingCategory(null)}
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
                  value={editingCategory.name || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    setEditingCategory({
                      ...editingCategory,
                      name: val,
                      slug: editingCategory.slug || autoSlug,
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
                  value={editingCategory.slug || ''}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, slug: e.target.value })
                  }
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Description</label>
                <input
                  type="text"
                  value={editingCategory.description || ''}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2 rounded-xs"
                />
              </div>

              <div>
                <MediaUploader
                  label="Category Image"
                  value={editingCategory.imageUrl || ''}
                  onChange={(url) => setEditingCategory({ ...editingCategory, imageUrl: url })}
                  folder="categories"
                  recommendedSize="Recommended 800 × 1066 px · Ratio 3:4 · One source image"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">Sort Order</label>
                <input
                  type="number"
                  value={editingCategory.sortOrder || 1}
                  onChange={(e) =>
                    setEditingCategory({
                      ...editingCategory,
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
                  onClick={() => setEditingCategory(null)}
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
                  {saving ? 'Saving...' : 'Save Category'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Delete Modal for Categories */}
      {deleteModalOpen && selectedCategory && (
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
                  {deleteSafety?.safe ? 'Confirm Category Delete' : 'Category Delete Blocked — Assigned Products Exist'}
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
                <p className="font-semibold text-[#1C1917] font-serif text-sm">{selectedCategory.name}</p>
                <p className="font-mono text-[11px] text-[#78716C]">Slug: {selectedCategory.slug}</p>
              </div>

              {deleteSafety?.safe ? (
                <p className="text-[#1C1917] font-medium">
                  No products are currently assigned to this category. It is safe to permanently delete.
                </p>
              ) : (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xs text-red-900 space-y-2">
                  <p className="font-semibold text-xs">{deleteSafety?.reason}</p>
                  <p className="text-[11px] text-red-700">
                    Deleting a category with active products will leave those products orphaned. Please reassign products to another category or archive this category instead.
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
                    await handleToggleArchive(selectedCategory);
                    setDeleteModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-medium bg-[#1C1917] hover:bg-[#2E2926] text-[#FAF8F5] rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Category Instead</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
