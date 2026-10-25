import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Edit2, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { AssessmentCategoryItem, db } from '../../lib/database';
import { DEFAULT_CATEGORY_PRESETS, getCategoryColorBadgeClasses } from '../../utils/categoryUtils';

interface AssessmentCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  courseCode?: string;
  onCategoriesUpdated?: (categories: AssessmentCategoryItem[]) => void;
  onSelectCategory?: (category: AssessmentCategoryItem) => void;
}

const COLOR_OPTIONS = [
  { key: 'blue', label: 'Blue', border: 'border-blue-400', bg: 'bg-blue-100 text-blue-800' },
  { key: 'purple', label: 'Purple', border: 'border-purple-400', bg: 'bg-purple-100 text-purple-800' },
  { key: 'amber', label: 'Amber', border: 'border-amber-400', bg: 'bg-amber-100 text-amber-800' },
  { key: 'emerald', label: 'Emerald', border: 'border-emerald-400', bg: 'bg-emerald-100 text-emerald-800' },
  { key: 'rose', label: 'Rose', border: 'border-rose-400', bg: 'bg-rose-100 text-rose-800' },
  { key: 'slate', label: 'Slate', border: 'border-slate-400', bg: 'bg-slate-100 text-slate-800' },
];

export default function AssessmentCategoryModal({
  isOpen,
  onClose,
  courseId,
  courseCode,
  onCategoriesUpdated,
  onSelectCategory
}: AssessmentCategoryModalProps) {
  const [categories, setCategories] = useState<AssessmentCategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [prefix, setPrefix] = useState('');
  const [color, setColor] = useState('blue');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && courseId) {
      loadCategories();
    }
  }, [isOpen, courseId]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await db.getAssessmentCategories(courseId);
      setCategories(data || []);
      if (onCategoriesUpdated) {
        onCategoriesUpdated(data || []);
      }
    } catch (err) {
      console.error('Failed to load assessment categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPrefix('');
    setColor('blue');
    setDescription('');
    setError('');
    setIsCreating(false);
    setEditingId(null);
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleApplyPreset = (preset: typeof DEFAULT_CATEGORY_PRESETS[0]) => {
    setName(preset.name);
    setPrefix(preset.prefix);
    setColor(preset.color);
    setDescription(preset.description);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a category name (e.g., Mid-Semester 2025).');
      return;
    }
    const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().trim();
    if (!cleanPrefix) {
      setError('Please enter a short prefix code (e.g., MID25, FE24).');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await db.updateAssessmentCategory(editingId, {
          name: name.trim(),
          prefix: cleanPrefix,
          color,
          description: description.trim()
        });
      } else {
        await db.createAssessmentCategory({
          course_id: courseId,
          name: name.trim(),
          prefix: cleanPrefix,
          color,
          description: description.trim()
        });
      }
      await loadCategories();
      resetForm();
    } catch (err: any) {
      console.error('Error saving category:', err);
      setError(err?.message || 'Failed to save category. Ensure the prefix is unique for this course.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: AssessmentCategoryItem) => {
    setEditingId(cat.id);
    setName(cat.name);
    setPrefix(cat.prefix);
    setColor(cat.color || 'blue');
    setDescription(cat.description || '');
    setIsCreating(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Bank questions tagged with this prefix will remain safely in the bank as General.')) {
      return;
    }
    try {
      await db.deleteAssessmentCategory(id);
      await loadCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      alert('Failed to delete category.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assessment Categories & Prefixes${courseCode ? ` — ${courseCode}` : ''}`}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Create categories and short prefix codes (e.g., <span className="font-semibold text-gray-700">MID25</span> for Mid-Semester 2025) to tag questions in the bank. This ensures old questions from prior terms aren't mixed into current exams.
        </p>

        {/* Existing Categories List */}
        {!isCreating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Course Categories ({categories.length})
              </span>
              <Button
                size="sm"
                onClick={handleStartCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>+ New Category</span>
              </Button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 space-y-2">
                <Tag className="mx-auto text-gray-400" size={28} />
                <p className="text-xs font-semibold text-gray-600">No Custom Categories Defined</p>
                <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                  Click "+ New Category" to create prefixes like <code>MID25</code> or <code>FE25</code> to isolate assessment questions.
                </p>
                <div className="pt-2">
                  <Button size="sm" variant="secondary" onClick={handleStartCreate}>
                    Create Your First Category
                  </Button>
                </div>
              </div>
            ) : (
              <div className="max-h-[45vh] overflow-y-auto space-y-2 pr-1">
                {categories.map((cat) => {
                  const badgeStyle = getCategoryColorBadgeClasses(cat.color);
                  return (
                    <div
                      key={cat.id}
                      className="p-3 border border-gray-200 rounded-xl hover:border-gray-300 bg-white transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold tracking-wide uppercase border ${badgeStyle}`}>
                          [{cat.prefix}]
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-gray-900">{cat.name}</h4>
                          </div>
                          {cat.description && (
                            <p className="text-[11px] text-gray-500 leading-tight mt-0.5">{cat.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onSelectCategory && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectCategory(cat);
                              onClose();
                            }}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md transition-colors"
                          >
                            Select
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEdit(cat)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create / Edit Form */}
        {isCreating && (
          <form onSubmit={handleSave} className="space-y-3 bg-gray-50/80 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-bold uppercase text-gray-800 tracking-wider">
                {editingId ? 'Edit Category' : 'Create New Assessment Category'}
              </h3>
              <button
                type="button"
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* Quick Presets */}
            {!editingId && (
              <div className="space-y-1">
                <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500" />
                  Quick Presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_CATEGORY_PRESETS.map((p) => (
                    <button
                      key={p.prefix}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="text-[11px] px-2 py-0.5 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 transition-colors"
                    >
                      {p.name} ({p.prefix})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Mid-Semester Exam 2025"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Prefix Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="e.g., MID25"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase())}
                    className="w-full px-3 py-1.5 font-mono uppercase font-bold border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">Alphanumeric, max 10 chars</p>
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Theme Color</label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setColor(c.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                      color === c.key
                        ? `${c.border} ring-2 ring-offset-1 ring-blue-500 shadow-sm ${c.bg}`
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${c.bg.split(' ')[0]}`} />
                    <span>{c.label}</span>
                    {color === c.key && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g., First semester continuous assessment questions"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Preview Pill */}
            {prefix.trim() && (
              <div className="p-2 bg-white rounded-lg border border-gray-200 flex items-center gap-2">
                <span className="text-[11px] text-gray-500">Preview:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold border uppercase ${getCategoryColorBadgeClasses(color)}`}>
                  [{prefix.trim()}] {name.trim() || 'Category Name'}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" size="sm" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !name.trim() || !prefix.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {saving ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
              </Button>
            </div>
          </form>
        )}

        <div className="flex justify-end pt-3 border-t">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
