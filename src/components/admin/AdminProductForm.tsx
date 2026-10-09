import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Upload,
  Plus,
  Trash2,
  Star,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Sliders,
  RotateCcw,
  Check,
} from 'lucide-react';
import { adminService, CategoryAdminData, CollectionAdminData } from '../../services/adminService';
import { Product, AdminSubView, ProductCategory, ProductImageRole } from '../../types';
import { Button } from '../ui/Button';
import { useSiteSettings } from '../../hooks/useSiteSettings';
import { CANONICAL_COLOR_DICTIONARY } from '../../lib/colorSystem';
import { formatVariantSku, parseNextVariantIndex } from '../../lib/skuHelper';
import { ImageAdjustmentControl } from './ImageAdjustmentControl';

interface AdminProductFormProps {
  productId?: string;
  onNavigateSubView: (view: AdminSubView) => void;
}

interface ImageItem {
  id?: string;
  imageUrl: string;
  isPrimary: boolean;
  altText?: string;
  sortOrder: number;
  role?: ProductImageRole;
  variantSku?: string;
  variantId?: string;
  fit?: 'cover' | 'contain';
  focalPositionX?: string | number;
  focalPositionY?: string | number;
  scale?: number;
}

interface VariantItem {
  id?: string;
  sku: string;
  variantName: string;
  color?: string;
  size?: string;
  bedSize?: string;
  dimensions?: string;
  priceOverride?: number;
  mrpOverride?: number;
  stockQuantity: number;
  isActive?: boolean;
  colorHexPrimary?: string;
  colorHexSecondary?: string;
  colorSwatchUrl?: string;
}

export const AdminProductForm: React.FC<AdminProductFormProps> = ({
  productId,
  onNavigateSubView,
}) => {
  const isEditing = Boolean(productId);
  const { settings } = useSiteSettings();
  const storeName = settings?.storeName || 'VK VASTRAM';

  // Categories & Collections
  const [categories, setCategories] = useState<CategoryAdminData[]>([]);
  const [collections, setCollections] = useState<CollectionAdminData[]>([]);

  // Form State
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<ProductCategory>('sarees');
  const [categoryId, setCategoryId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [mrp, setMrp] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('active');
  const [featured, setFeatured] = useState(false);
  const [bestSeller, setBestSeller] = useState(false);
  const [newArrival, setNewArrival] = useState(false);
  const [description, setDescription] = useState('');

  // Textile Specific Attributes
  const [fabric, setFabric] = useState('');
  const [weave, setWeave] = useState('');
  const [origin, setOrigin] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [care, setCare] = useState('');
  const [color, setColor] = useState('');
  const [pattern, setPattern] = useState('');
  const [occasion, setOccasion] = useState('');
  const [blousePiece, setBlousePiece] = useState('0.8m Running Blouse Piece Included');
  const [threadCount, setThreadCount] = useState('400 TC');
  const [bedSize, setBedSize] = useState('King');

  // SEO Fields
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  // Images & Variants
  const [images, setImages] = useState<ImageItem[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [activeGalleryTab, setActiveGalleryTab] = useState<string>('all');
  const [newImageTargetVariant, setNewImageTargetVariant] = useState<string>('all');
  const [newImageTargetRole, setNewImageTargetRole] = useState<ProductImageRole>('hero');
  const [expandedAdjustIndex, setExpandedAdjustIndex] = useState<number | null>(null);

  // UI feedback & Unsaved tracker
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Auto-generate slug from name if slug is not manually changed
  const handleNameChange = (val: string) => {
    setName(val);
    setIsDirty(true);
    if (!isEditing || !slug) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      setSlug(generated);
    }
  };

  // Auto Generate SKU
  const handleAutoGenerateSku = async () => {
    const generated = await adminService.generateAutoSku(category);
    setSku(generated);
    setIsDirty(true);
  };

  // Fetch Category and Collection definitions
  useEffect(() => {
    const fetchMetadata = async () => {
      const [cats, cols] = await Promise.all([
        adminService.getCategories(),
        adminService.getCollections(),
      ]);
      setCategories(cats);
      setCollections(cols);

      if (cats.length > 0 && !categoryId) {
        setCategoryId(cats[0].id);
        setCategory(cats[0].slug as ProductCategory);
      }

      // Automatically generate sequential authoritative SKU if creating new product
      if (!isEditing && !sku) {
        const autoSku = await adminService.generateAutoSku(cats[0]?.slug || 'sarees');
        setSku(autoSku);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch Existing Product details if editing
  useEffect(() => {
    if (!productId) return;

    const loadProduct = async () => {
      setFetching(true);
      const data = await adminService.getProductById(productId);
      if (data) {
        const p = data.product;
        setName(p.name);
        setSlug(p.slug);
        setSku(p.sku || '');
        setCategory(p.category);
        setCategoryId(p.categoryId || '');
        setCollectionId(p.collectionId || '');
        setPrice(p.price);
        setMrp(p.mrp);
        setStatus(p.status || 'active');
        setFeatured(Boolean(p.featured));
        setBestSeller(Boolean(p.bestSeller));
        setNewArrival(Boolean(p.newArrival));
        setDescription(p.description || '');
        setFabric(p.fabric || '');
        setWeave(p.weave || '');
        setOrigin(p.origin || '');
        setDimensions(p.dimensions || '');
        setCare(p.care || '');
        setSeoTitle(p.seoTitle || '');
        setSeoDescription(p.seoDescription || '');

        if (data.images && data.images.length > 0) {
          setImages(data.images);
        } else if (p.primaryImage) {
          setImages([{ imageUrl: p.primaryImage, isPrimary: true, sortOrder: 1 }]);
        }

        if (data.variants && data.variants.length > 0) {
          setVariants(
            data.variants.map((v: any) => ({
              id: v.id,
              sku: v.sku,
              variantName: v.variant_name || 'Standard',
              color: v.color || '',
              size: v.size || '',
              bedSize: v.bed_size || '',
              dimensions: v.dimensions || '',
              stockQuantity: v.stock_quantity || 0,
              priceOverride: v.price_override ? Number(v.price_override) : undefined,
              mrpOverride: v.mrp_override ? Number(v.mrp_override) : undefined,
              isActive: v.is_active !== false,
              colorHexPrimary: v.attributes?.colorHexPrimary,
              colorHexSecondary: v.attributes?.colorHexSecondary,
              colorSwatchUrl: v.attributes?.colorSwatchUrl,
            }))
          );
        }
      }
      setFetching(false);
    };

    loadProduct();
  }, [productId]);

  // Handle Category selection change
  const handleCategorySelect = (catId: string) => {
    setCategoryId(catId);
    const catObj = categories.find((c) => c.id === catId);
    if (catObj) {
      setCategory(catObj.slug as ProductCategory);
    }
    setIsDirty(true);
  };

  // Add image by URL
  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    const targetSku = newImageTargetVariant !== 'all' ? newImageTargetVariant : undefined;
    const targetVarObj = variants.find((v) => v.sku === targetSku);
    const newImg: ImageItem = {
      imageUrl: imageUrlInput.trim(),
      isPrimary: images.length === 0,
      sortOrder: images.length + 1,
      variantSku: targetSku,
      variantId: targetVarObj?.id,
      role: newImageTargetRole,
      fit: 'cover',
      focalPositionX: 50,
      focalPositionY: 50,
      scale: 1.0,
      altText: name ? `${name} - ${newImageTargetRole}` : undefined,
    };
    setImages([...images, newImg]);
    setImageUrlInput('');
    setIsDirty(true);
  };

  // Upload local image file
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingImages(true);
    setErrorMessage('');
    const total = files.length;
    const targetSku = newImageTargetVariant !== 'all' ? newImageTargetVariant : undefined;
    const targetVarObj = variants.find((v) => v.sku === targetSku);

    try {
      for (let i = 0; i < total; i++) {
        const file = files[i];
        setImageUploadStatus(`Optimizing to WebP (1200x1600) & uploading image ${i + 1} of ${total} (${file.name})...`);
        const uploaded = await adminService.uploadImage(file, 'products');
        setImages((prev) => [
          ...prev,
          {
            imageUrl: uploaded.url,
            isPrimary: prev.length === 0,
            sortOrder: prev.length + 1,
            variantSku: targetSku,
            variantId: targetVarObj?.id,
            role: newImageTargetRole,
            fit: 'cover',
            focalPositionX: 50,
            focalPositionY: 50,
            scale: 1.0,
            altText: name ? `${name} - ${newImageTargetRole}` : undefined,
          },
        ]);
      }
      setIsDirty(true);
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      setErrorMessage(err?.message || 'Error uploading one or more images.');
    } finally {
      setUploadingImages(false);
      setImageUploadStatus('');
      // Reset input
      e.target.value = '';
    }
  };

  const handleSetPrimaryImage = (index: number) => {
    const targetImg = images[index];
    const isVariantAssigned = Boolean(targetImg?.variantSku && targetImg.variantSku !== 'all');

    setImages(
      images.map((img, i) => {
        if (i === index) {
          return { ...img, isPrimary: true };
        }
        // If target is variant specific, only unset primary for images of the SAME variant
        if (isVariantAssigned) {
          if (img.variantSku === targetImg.variantSku) {
            return { ...img, isPrimary: false };
          }
          return img;
        }
        // If target is general/all, unset for other general images
        if (!img.variantSku || img.variantSku === 'all') {
          return { ...img, isPrimary: false };
        }
        return img;
      })
    );
    setIsDirty(true);
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((i) => i.isPrimary)) {
      updated[0].isPrimary = true;
    }
    setImages(updated);
    if (expandedAdjustIndex === index) {
      setExpandedAdjustIndex(null);
    }
    setIsDirty(true);
  };

  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    const copy = [...images];
    const [item] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, item);
    copy.forEach((img, idx) => {
      img.sortOrder = idx + 1;
    });
    setImages(copy);
    setIsDirty(true);
  };

  const handleUpdateImageRole = (idx: number, role: ProductImageRole) => {
    const copy = [...images];
    copy[idx].role = role;
    setImages(copy);
    setIsDirty(true);
  };

  const handleUpdateImageVariant = (idx: number, variantSku: string) => {
    const copy = [...images];
    const vSku = variantSku === 'all' ? undefined : variantSku;
    const matchedV = variants.find((v) => v.sku === vSku);
    copy[idx].variantSku = vSku;
    copy[idx].variantId = matchedV?.id;
    setImages(copy);
    setIsDirty(true);
  };

  const handleUpdateImagePresentation = (
    idx: number,
    settings: { fit?: 'cover' | 'contain'; focalPositionX?: string | number; focalPositionY?: string | number; scale?: number }
  ) => {
    const copy = [...images];
    copy[idx] = {
      ...copy[idx],
      ...settings,
    };
    setImages(copy);
    setIsDirty(true);
  };

  // Add Variant
  const handleAddVariant = () => {
    const nextNum = parseNextVariantIndex(variants);
    const varSku = formatVariantSku(sku || 'VKV-SAR-001', nextNum);

    const newVariant: VariantItem = {
      sku: varSku,
      variantName: category === 'bedsheets' ? `${bedSize} / ${color || 'Standard'}` : (color || 'Standard Free Size'),
      color: color || '',
      size: category === 'bedsheets' ? bedSize : dimensions,
      bedSize: category === 'bedsheets' ? bedSize : undefined,
      dimensions: dimensions,
      stockQuantity: 10,
      isActive: true,
      priceOverride: undefined,
    };
    setVariants([...variants, newVariant]);
    setIsDirty(true);
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Product name is required.');
      return;
    }
    if (!slug.trim()) {
      setErrorMessage('Product slug is required.');
      return;
    }
    if (price < 0) {
      setErrorMessage('Price cannot be negative.');
      return;
    }
    if (mrp && mrp < price) {
      setErrorMessage('MRP cannot be lower than the selling price.');
      return;
    }
    if (images.length === 0) {
      setErrorMessage('Please add at least one product image.');
      return;
    }

    setLoading(true);

    const productPayload: Partial<Product> = {
      name,
      slug,
      sku: sku || `VKV-${Date.now().toString().slice(-6)}`,
      category,
      categoryId,
      collectionId: collectionId || undefined,
      price: Number(price),
      mrp: mrp ? Number(mrp) : undefined,
      status,
      featured,
      bestSeller,
      newArrival,
      description,
      fabric: fabric.trim() || undefined,
      weave: weave.trim() || undefined,
      origin: origin.trim() || undefined,
      dimensions: dimensions.trim() || undefined,
      care: care.trim() || undefined,
      seoTitle: seoTitle || `${name} | ${storeName}`,
      seoDescription: seoDescription || description.slice(0, 150),
    };

    // Auto-generate default variant if none configured, and attach variant-specific images
    const rawVariants =
      variants.length > 0
        ? variants
        : [
            {
              sku: formatVariantSku(sku || 'VKV-SAR-001', 1),
              variantName: 'Standard Free Size',
              color: color.trim() || undefined,
              size: dimensions.trim() || undefined,
              stockQuantity: 10,
              isActive: true,
            },
          ];

    const imagesPayload = images.map((img, idx) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      isPrimary: Boolean(img.isPrimary),
      sortOrder: img.sortOrder || idx + 1,
      role: img.role || (idx === 0 ? 'hero' : 'gallery'),
      variantSku: img.variantSku && img.variantSku !== 'all' ? img.variantSku : undefined,
      variantId: img.variantId || undefined,
      fit: img.fit || 'cover',
      focalPositionX: img.focalPositionX ?? 50,
      focalPositionY: img.focalPositionY ?? 50,
      scale: img.scale ? Number(img.scale) : 1.0,
      altText: img.altText || `${name}`,
    }));

    const variantPayload = rawVariants.map((v) => {
      // Find images assigned specifically to this variant SKU or assigned to 'all'
      const assignedImages = images.filter(
        (img) => !img.variantSku || img.variantSku === 'all' || img.variantSku === v.sku
      );

      return {
        ...v,
        attributes: {
          images: assignedImages.map((ai, aIdx) => ({
            id: ai.id,
            imageUrl: ai.imageUrl,
            role: ai.role || (aIdx === 0 ? 'hero' : 'gallery'),
            isPrimary: ai.isPrimary,
            sortOrder: ai.sortOrder,
            variantSku: v.sku,
            fit: ai.fit || 'cover',
            focalPositionX: ai.focalPositionX ?? 50,
            focalPositionY: ai.focalPositionY ?? 50,
            scale: ai.scale ?? 1.0,
            altText: ai.altText || `${name} - ${v.variantName}`,
          })),
          colorHexPrimary: v.colorHexPrimary,
          colorHexSecondary: v.colorHexSecondary,
          colorSwatchUrl: v.colorSwatchUrl,
        },
      };
    });

    try {
      if (isEditing && productId) {
        const res = await adminService.updateProduct(productId, productPayload, imagesPayload, variantPayload);
        if (res.success) {
          setSuccessMessage('Product updated successfully and synchronized with storefront.');
          setIsDirty(false);
          setTimeout(() => onNavigateSubView('products'), 1200);
        } else {
          setErrorMessage(res.error || 'Failed to update product');
        }
      } else {
        const res = await adminService.createProduct(productPayload, imagesPayload, variantPayload);
        if (res.success) {
          setSuccessMessage('Product created successfully and published.');
          setIsDirty(false);
          setTimeout(() => onNavigateSubView('products'), 1200);
        } else {
          setErrorMessage(res.error || 'Failed to create product');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving product');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="py-20 text-center text-xs text-[#78716C]">
        Loading product data for editing...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header and Back navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (isDirty && !window.confirm('You have unsaved changes. Leave anyway?')) {
              return;
            }
            onNavigateSubView('products');
          }}
          className="inline-flex items-center gap-1.5 text-xs text-[#57534E] hover:text-[#1C1917] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Products</span>
        </button>

        {isDirty && (
          <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-xs font-medium">
            Unsaved Changes
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl text-[#1C1917] font-normal">
            {isEditing ? 'Edit Textile Creation' : 'Add New Textile Creation'}
          </h1>
          <p className="text-xs text-[#57534E] mt-1">
            Specify craftsmanship attributes, inventory variants, and product imagery.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Core Information (Simplified View) */}
        <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-5">
          <h2 className="font-serif text-base text-[#1C1917] font-medium border-b border-[#1C1917]/10 pb-3">
            Product Essentials
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-[#1C1917] mb-1.5">
                Product Title *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Royal Emerald Banarasi Katan Silk Saree"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1.5">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => handleCategorySelect(e.target.value)}
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E] cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Colour (Simplified) */}
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1.5">
                Primary Colour
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="e.g., Emerald Green"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
              />
            </div>

            {/* Selling Price */}
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1.5">
                Selling Price (₹ INR) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={price}
                onChange={(e) => {
                  setPrice(Number(e.target.value));
                  setIsDirty(true);
                }}
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] font-semibold text-sm tabular-nums focus:outline-none focus:border-[#B88E3E]"
              />
            </div>

            {/* MRP */}
            <div>
              <label className="block font-semibold text-[#1C1917] mb-1.5">
                MRP (₹ INR)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={mrp ?? ''}
                onChange={(e) => {
                  setMrp(e.target.value ? Number(e.target.value) : undefined);
                  setIsDirty(true);
                }}
                placeholder="Leave blank if no discount"
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] tabular-nums focus:outline-none focus:border-[#B88E3E]"
              />
            </div>
            
            {/* Description */}
            <div className="md:col-span-2">
              <label className="block font-semibold text-[#1C1917] mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Short description of the piece..."
                className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E]"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Advanced Settings (Collapsible) */}
        <details className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs group">
          <summary className="font-serif text-base text-[#1C1917] font-medium cursor-pointer flex items-center justify-between">
            Advanced Settings & Technical Data
            <span className="text-[#967029] group-open:rotate-180 transition-transform">▼</span>
          </summary>
          
          <div className="mt-5 space-y-5 pt-5 border-t border-[#1C1917]/10">
            {/* Technical Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Slug */}
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1.5">
                  URL Slug *
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="royal-emerald-banarasi-katan-silk-saree"
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] font-mono text-[11px] focus:outline-none focus:border-[#B88E3E]"
                />
              </div>

              {/* SKU */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-semibold text-[#1C1917]">
                    Master SKU
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSku}
                    className="text-[10px] uppercase font-semibold text-[#967029] hover:underline cursor-pointer"
                  >
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => {
                    setSku(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="VKV-SAR-001"
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] font-mono text-[11px] focus:outline-none focus:border-[#B88E3E]"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block font-semibold text-[#1C1917] mb-1.5">
                  Catalog Status
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as any);
                    setIsDirty(true);
                  }}
                  className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917] focus:outline-none focus:border-[#B88E3E] cursor-pointer"
                >
                  <option value="active">Active (Published on Storefront)</option>
                  <option value="draft">Draft (Hidden in CMS)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Merchandising Toggles */}
              <div className="flex items-center gap-6 pt-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => {
                      setFeatured(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded-xs accent-[#B88E3E] w-4 h-4"
                  />
                  <span className="text-[#1C1917] font-medium">Featured</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bestSeller}
                    onChange={(e) => {
                      setBestSeller(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded-xs accent-[#B88E3E] w-4 h-4"
                  />
                  <span className="text-[#1C1917] font-medium">Best Seller</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newArrival}
                    onChange={(e) => {
                      setNewArrival(e.target.checked);
                      setIsDirty(true);
                    }}
                    className="rounded-xs accent-[#B88E3E] w-4 h-4"
                  />
                  <span className="text-[#1C1917] font-medium">New Arrival</span>
                </label>
              </div>
            </div>

            {/* Dynamic Category Specific Attributes */}
            <div className="border-t border-[#1C1917]/10 pt-5">
              <div className="flex items-center justify-between pb-3">
                <h2 className="font-serif text-base text-[#1C1917] font-medium">
                  {category === 'bedsheets' ? 'Bedding & Fabric Specifications' : 'Handloom & Saree Specifications'}
                </h2>
                <span className="text-[11px] text-[#967029] uppercase font-semibold">
                  Category: {category}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Fabric */}
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1.5">Fabric Composition</label>
                  <input
                    type="text"
                    value={fabric}
                    onChange={(e) => { setFabric(e.target.value); setIsDirty(true); }}
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
                  />
                </div>
                {/* Origin */}
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1.5">Weaving Origin</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => { setOrigin(e.target.value); setIsDirty(true); }}
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
                  />
                </div>
                {/* Dimensions */}
                <div>
                  <label className="block font-semibold text-[#1C1917] mb-1.5">Dimensions / Sizing</label>
                  <input
                    type="text"
                    value={dimensions}
                    onChange={(e) => { setDimensions(e.target.value); setIsDirty(true); }}
                    className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
                  />
                </div>
              </div>
            </div>
          </div>
        </details>



        {/* Section 3: Product Image Management */}
        <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1C1917]/10 pb-3 gap-2">
            <div>
              <h2 className="font-serif text-base text-[#1C1917] font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#967029]" />
                <span>Product Photography & Variant Gallery System</span>
              </h2>
              <p className="text-xs text-[#78716C] mt-0.5">
                Recommended 1200 × 1600 px (3:4 portrait). Assign images to specific variants (e.g., Lavender vs Gold) or general product drape.
              </p>
            </div>
            <div className="text-[11px] font-mono text-[#57534E] bg-[#EFE9DC] px-2.5 py-1 rounded-xs">
              {images.length} {images.length === 1 ? 'image' : 'images'} total
            </div>
          </div>

          {/* Target Variant & Role Pre-selector for Uploads/URLs */}
          <div className="p-3 bg-[#F4EFE6] rounded-xs border border-[#1C1917]/10 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-[#1C1917] text-[11px] uppercase tracking-wider">
              Upload / Add Destination:
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[#78716C]">Assign To:</span>
              <select
                value={newImageTargetVariant}
                onChange={(e) => setNewImageTargetVariant(e.target.value)}
                className="bg-[#FAF8F5] border border-[#1C1917]/15 px-2 py-1 rounded-xs text-[#1C1917] font-medium cursor-pointer"
              >
                <option value="all">General (All Variants)</option>
                {variants.map((v) => (
                  <option key={v.sku} value={v.sku}>
                    Variant: {v.variantName} ({v.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[#78716C]">Initial Role:</span>
              <select
                value={newImageTargetRole}
                onChange={(e) => setNewImageTargetRole(e.target.value as ProductImageRole)}
                className="bg-[#FAF8F5] border border-[#1C1917]/15 px-2 py-1 rounded-xs text-[#1C1917] font-medium cursor-pointer"
              >
                <option value="hero">Hero (Main Drape)</option>
                <option value="full_saree">Full Saree (Complete View)</option>
                <option value="pallu">Pallu (End-piece)</option>
                <option value="border">Border (Zari Border)</option>
                <option value="texture">Texture (Weave Close-up)</option>
                <option value="gallery">Gallery (Angle View)</option>
                <option value="lifestyle">Lifestyle (Draped Silhouette)</option>
                <option value="model">Model View</option>
                <option value="thumbnail">Thumbnail</option>
                <option value="detail">Detail (Motif)</option>
              </select>
            </div>
          </div>

          {/* Add Image Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <div className="md:col-span-8 flex gap-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="Paste public image URL (https://... or /src/assets/...)"
                className="flex-1 bg-[#F4EFE6] border border-[#1C1917]/15 p-2.5 rounded-xs text-[#1C1917]"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-4 py-2 bg-[#1C1917] text-[#FAF8F5] font-medium rounded-xs hover:bg-[#2E2926] cursor-pointer shrink-0"
              >
                Add URL
              </button>
            </div>

            <div className="md:col-span-4">
              <label className={`w-full flex items-center justify-center gap-2 p-2.5 bg-[#F4EFE6] hover:bg-[#EFE9DC] border border-dashed border-[#1C1917]/25 rounded-xs cursor-pointer text-[#1C1917] font-medium transition-colors ${
                uploadingImages ? 'opacity-60 pointer-events-none' : ''
              }`}>
                <Upload className="w-4 h-4 text-[#967029]" />
                <span>{uploadingImages ? 'Optimizing & Uploading...' : 'Upload Image File(s)'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageFileUpload}
                  disabled={uploadingImages}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {uploadingImages && (
            <div className="p-2.5 bg-[#EDE6D8]/60 border border-[#B88E3E]/30 rounded-xs text-xs text-[#967029] flex items-center gap-2 animate-pulse">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{imageUploadStatus || 'Optimizing images to WebP & uploading to Supabase Storage...'}</span>
            </div>
          )}

          {/* Gallery Filter Tabs */}
          {variants.length > 0 && images.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[#1C1917]/10 pb-2">
              <button
                type="button"
                onClick={() => setActiveGalleryTab('all')}
                className={`px-3 py-1 text-xs rounded-xs font-medium transition-colors cursor-pointer ${
                  activeGalleryTab === 'all'
                    ? 'bg-[#1C1917] text-[#FAF8F5]'
                    : 'bg-[#F4EFE6] text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                All Images ({images.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveGalleryTab('general')}
                className={`px-3 py-1 text-xs rounded-xs font-medium transition-colors cursor-pointer ${
                  activeGalleryTab === 'general'
                    ? 'bg-[#1C1917] text-[#FAF8F5]'
                    : 'bg-[#F4EFE6] text-[#78716C] hover:text-[#1C1917]'
                }`}
              >
                General / Shared ({images.filter((i) => !i.variantSku || i.variantSku === 'all').length})
              </button>
              {variants.map((v) => {
                const count = images.filter((i) => i.variantSku === v.sku).length;
                return (
                  <button
                    key={v.sku}
                    type="button"
                    onClick={() => setActiveGalleryTab(v.sku)}
                    className={`px-3 py-1 text-xs rounded-xs font-medium transition-colors cursor-pointer ${
                      activeGalleryTab === v.sku
                        ? 'bg-[#967029] text-[#FAF8F5]'
                        : 'bg-[#F4EFE6] text-[#78716C] hover:text-[#1C1917]'
                    }`}
                  >
                    {v.variantName} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Image Gallery Grid */}
          {images.length === 0 ? (
            <div className="py-8 text-center bg-[#F4EFE6]/50 border border-dashed border-[#1C1917]/15 rounded-xs text-[#78716C] text-xs">
              <ImageIcon className="w-8 h-8 mx-auto text-[#A8A29E] mb-2" />
              No images added yet. Add a public URL or upload high-resolution photos above.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {images
                .map((img, idx) => ({ img, idx }))
                .filter(({ img }) => {
                  if (activeGalleryTab === 'all') return true;
                  if (activeGalleryTab === 'general') return !img.variantSku || img.variantSku === 'all';
                  return img.variantSku === activeGalleryTab;
                })
                .map(({ img, idx }) => {
                  const assignedVariant = variants.find((v) => v.sku === img.variantSku);
                  const isTuningOpen = expandedAdjustIndex === idx;

                  const roleBadgeLabels: Record<string, string> = {
                    hero: 'Hero Drape',
                    full_saree: 'Full Saree',
                    pallu: 'Pallu End-piece',
                    border: 'Zari Border',
                    texture: 'Weave Texture',
                    detail: 'Artisanal Detail',
                    gallery: 'Gallery Angle',
                    lifestyle: 'Lifestyle View',
                    model: 'Model Drape',
                    thumbnail: 'Catalog Thumb',
                  };

                  return (
                    <div
                      key={idx}
                      className={`relative bg-[#F4EFE6] rounded-xs border overflow-hidden flex flex-col justify-between transition-shadow ${
                        img.isPrimary ? 'border-[#B88E3E] ring-2 ring-[#B88E3E]/60 shadow-xs' : 'border-[#1C1917]/15'
                      }`}
                    >
                      {/* Top Status & Attribution Header */}
                      <div className="px-3 py-2 bg-[#EDE6D8]/80 border-b border-[#1C1917]/10 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-[#1C1917] truncate">
                            {assignedVariant ? `Variant: ${assignedVariant.variantName}` : 'Shared / General'}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[#78716C] shrink-0">
                          #{idx + 1}
                        </span>
                      </div>

                      {/* 3:4 Portrait Image Preview Stage with Safe Presentation Styles */}
                      <div className="relative aspect-[3/4] bg-[#EFE8DA] overflow-hidden group">
                        <img
                          src={img.imageUrl}
                          alt={img.altText || `Product image ${idx + 1}`}
                          className="w-full h-full transition-transform duration-200"
                          style={{
                            objectFit: img.fit || 'cover',
                            objectPosition: `${img.focalPositionX ?? 50}% ${img.focalPositionY ?? 50}%`,
                            transform: img.scale && img.scale !== 1.0 ? `scale(${img.scale})` : undefined,
                          }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="%23efe8da"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="%2378716c">Preview Unavailable</text></svg>';
                          }}
                        />

                        {/* Top Badges: Primary Star + Role */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10 pointer-events-none">
                          {img.isPrimary && (
                            <span className="inline-flex items-center gap-1 bg-[#1C1917] text-[#FAF8F5] text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-xs shadow-xs">
                              <Star className="w-2.5 h-2.5 text-[#B88E3E] fill-[#B88E3E]" />
                              Primary
                            </span>
                          )}
                          <span className="bg-[#1C1917]/80 backdrop-blur-xs text-[#FAF8F5] text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-xs shadow-2xs">
                            {roleBadgeLabels[img.role || ''] || img.role || 'Gallery'}
                          </span>
                        </div>

                        {/* Action buttons overlay (Move Left, Right, Delete, Tune) */}
                        <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, idx - 1)}
                              className="p-1 bg-[#1C1917]/85 hover:bg-[#1C1917] text-white rounded-xs cursor-pointer shadow-xs"
                              title="Move earlier in gallery sequence"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {idx < images.length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMoveImage(idx, idx + 1)}
                              className="p-1 bg-[#1C1917]/85 hover:bg-[#1C1917] text-white rounded-xs cursor-pointer shadow-xs"
                              title="Move later in gallery sequence"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Remove this image from product gallery?')) {
                                handleRemoveImage(idx);
                              }
                            }}
                            className="p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-xs cursor-pointer shadow-xs"
                            title="Delete image safely"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Framing indicators footer on image preview */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none text-[9px] text-[#FAF8F5] font-mono bg-[#1C1917]/70 px-2 py-0.5 rounded-xs">
                          <span>{img.fit || 'cover'}</span>
                          <span>Focal: {img.focalPositionX ?? 50}% / {img.focalPositionY ?? 50}%</span>
                          {img.scale && img.scale !== 1.0 && <span>{Math.round(img.scale * 100)}%</span>}
                        </div>
                      </div>

                      {/* Metadata, Role, and Variant Assignment Panel */}
                      <div className="p-3 bg-[#FAF8F5] border-t border-[#1C1917]/10 space-y-2.5 text-xs">
                        {/* 1. Image Role Selector (Comprehensive 10 roles) */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                            Semantic Role
                          </label>
                          <select
                            value={img.role || (idx === 0 ? 'hero' : 'gallery')}
                            onChange={(e) => handleUpdateImageRole(idx, e.target.value as ProductImageRole)}
                            className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-1.5 rounded-xs text-[11px] text-[#1C1917] cursor-pointer"
                          >
                            <option value="hero">Hero (Primary Front Drape)</option>
                            <option value="full_saree">Full Saree (Complete Unfolded View)</option>
                            <option value="pallu">Pallu (Zari End-piece Detail)</option>
                            <option value="border">Border (Korvai / Zari Border)</option>
                            <option value="texture">Texture (Authentic Weave Close-up)</option>
                            <option value="detail">Detail (Artisanal Motif / Embroidery)</option>
                            <option value="gallery">Gallery (Angle & Fold View)</option>
                            <option value="lifestyle">Lifestyle (Draped Silhouette)</option>
                            <option value="model">Model Drape View</option>
                            <option value="thumbnail">Catalog Grid Thumbnail</option>
                          </select>
                        </div>

                        {/* 2. Variant Association Selector */}
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                            Variant Link (No Cross-Variant Leaks)
                          </label>
                          <select
                            value={img.variantSku || 'all'}
                            onChange={(e) => handleUpdateImageVariant(idx, e.target.value)}
                            className="w-full bg-[#F4EFE6] border border-[#1C1917]/15 p-1.5 rounded-xs text-[11px] text-[#1C1917] cursor-pointer"
                          >
                            <option value="all">All Variants / General Shared Drape</option>
                            {variants.map((v) => (
                              <option key={v.sku} value={v.sku}>
                                {v.variantName} ({v.sku})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Action Bar: Set Primary + Tune Framing */}
                        <div className="flex items-center gap-2 pt-1">
                          {!img.isPrimary ? (
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryImage(idx)}
                              className="flex-1 py-1.5 bg-[#F4EFE6] hover:bg-[#EFE9DC] text-[#1C1917] text-[11px] font-medium rounded-xs border border-[#1C1917]/15 cursor-pointer flex items-center justify-center gap-1 transition-colors"
                            >
                              <Star className="w-3 h-3 text-[#967029]" />
                              <span>Set as Primary</span>
                            </button>
                          ) : (
                            <div className="flex-1 py-1.5 bg-[#EFE9DC] text-[#1C1917] text-[11px] font-semibold rounded-xs border border-[#B88E3E]/40 flex items-center justify-center gap-1">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Primary Image</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedAdjustIndex(isTuningOpen ? null : idx)}
                            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-xs border cursor-pointer flex items-center gap-1 transition-colors ${
                              isTuningOpen
                                ? 'bg-[#1C1917] text-[#FAF8F5] border-[#1C1917]'
                                : 'bg-[#F4EFE6] hover:bg-[#EFE9DC] text-[#1C1917] border-[#1C1917]/15'
                            }`}
                            title="Fine-tune focal position, fit, and scale"
                          >
                            <Sliders className="w-3 h-3 text-[#967029]" />
                            <span>{isTuningOpen ? 'Close' : 'Tune'}</span>
                          </button>
                        </div>

                        {/* 4. Expandable Image Adjustment Control */}
                        {isTuningOpen && (
                          <div className="pt-2 border-t border-[#1C1917]/10">
                            <ImageAdjustmentControl
                              imageUrl={img.imageUrl}
                              fit={img.fit || 'cover'}
                              focalPositionX={img.focalPositionX !== undefined ? `${img.focalPositionX}%` : 'center'}
                              focalPositionY={img.focalPositionY !== undefined ? `${img.focalPositionY}%` : 'center'}
                              scale={img.scale || 1.0}
                              aspectRatio="3/4"
                              onChange={(settings) => {
                                const parseX = (val: string) => {
                                  if (val === 'left') return 0;
                                  if (val === 'left-center') return 25;
                                  if (val === 'right-center') return 75;
                                  if (val === 'right') return 100;
                                  const n = parseFloat(val);
                                  return isNaN(n) ? 50 : n;
                                };
                                const parseY = (val: string) => {
                                  if (val === 'top') return 0;
                                  if (val === 'upper') return 25;
                                  if (val === 'lower') return 75;
                                  if (val === 'bottom') return 100;
                                  const n = parseFloat(val);
                                  return isNaN(n) ? 50 : n;
                                };
                                handleUpdateImagePresentation(idx, {
                                  fit: settings.fit,
                                  focalPositionX: parseX(settings.focalPositionX),
                                  focalPositionY: parseY(settings.focalPositionY),
                                  scale: settings.scale,
                                });
                              }}
                              title={`Image #${idx + 1} — Framing & Focal Point`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Section 4: Variants & Stock Quantity */}
        <div className="bg-[#FAF8F5] p-6 rounded-xs border border-[#1C1917]/10 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#1C1917]/10 pb-3">
            <div>
              <h2 className="font-serif text-base text-[#1C1917] font-medium">
                Stock & Variant Ledger
              </h2>
              <p className="text-xs text-[#78716C]">
                Configure distinct color/size variants and starting stock allocations.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddVariant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F4EFE6] hover:bg-[#EFE9DC] text-[#1C1917] text-xs font-medium rounded-xs border border-[#1C1917]/15 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Variant</span>
            </button>
          </div>

          {variants.length === 0 ? (
            <div className="p-4 bg-[#F4EFE6]/50 rounded-xs text-xs text-[#57534E]">
              Default single standard variant will be created automatically with initial stock.
            </div>
          ) : (
            <div className="space-y-3">
              {variants.map((v, idx) => {
                const canonicalColorsList = Object.values(CANONICAL_COLOR_DICTIONARY);
                const isCustomColor = Boolean(v.color && !canonicalColorsList.some((c) => c.displayName.toLowerCase() === v.color?.toLowerCase()));

                return (
                  <div
                    key={idx}
                    className="p-3 bg-[#F4EFE6] rounded-xs border border-[#1C1917]/10 space-y-3 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      {/* Variant Title */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                          Variant Title
                        </label>
                        <input
                          type="text"
                          value={v.variantName}
                          onChange={(e) => {
                            const copy = [...variants];
                            copy[idx].variantName = e.target.value;
                            setVariants(copy);
                            setIsDirty(true);
                          }}
                          className="w-full bg-[#FAF8F5] p-1.5 border border-[#1C1917]/15 rounded-xs"
                        />
                      </div>

                      {/* Variant SKU */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                          Variant SKU
                        </label>
                        <input
                          type="text"
                          value={v.sku}
                          onChange={(e) => {
                            const copy = [...variants];
                            copy[idx].sku = e.target.value;
                            setVariants(copy);
                            setIsDirty(true);
                          }}
                          className="w-full bg-[#FAF8F5] p-1.5 border border-[#1C1917]/15 rounded-xs font-mono text-[11px]"
                        />
                      </div>

                      {/* Explicit Variant Colour Selector */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                          Colour Attribute
                        </label>
                        <select
                          value={isCustomColor ? '__custom__' : (v.color || '')}
                          onChange={(e) => {
                            const val = e.target.value;
                            const copy = [...variants];
                            if (val === '__custom__') {
                              copy[idx].color = v.color || 'Indigo & Ivory';
                            } else {
                              copy[idx].color = val;
                            }
                            setVariants(copy);
                            setIsDirty(true);
                          }}
                          className="w-full bg-[#FAF8F5] p-1.5 border border-[#1C1917]/15 rounded-xs text-[#1C1917] cursor-pointer"
                        >
                          <option value="">(Colour not configured)</option>
                          <optgroup label="Canonical Palette">
                            {canonicalColorsList.map((c) => (
                              <option key={c.canonicalName} value={c.displayName}>
                                {c.displayName} ({c.family})
                              </option>
                            ))}
                          </optgroup>
                          <option value="__custom__">Custom / Multi-Colour...</option>
                        </select>
                      </div>

                      {/* Stock Units */}
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                          Stock
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={v.stockQuantity}
                          onChange={(e) => {
                            const copy = [...variants];
                            copy[idx].stockQuantity = Number(e.target.value);
                            setVariants(copy);
                            setIsDirty(true);
                          }}
                          className="w-full bg-[#FAF8F5] p-1.5 border border-[#1C1917]/15 rounded-xs tabular-nums font-semibold"
                        />
                      </div>

                      {/* Price Override */}
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1" title="Leave blank to inherit parent price">
                          Price (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Inherit"
                          value={v.priceOverride !== undefined && v.priceOverride !== null ? v.priceOverride : ''}
                          onChange={(e) => {
                            const copy = [...variants];
                            const val = e.target.value;
                            copy[idx].priceOverride = val === '' ? undefined : Number(val);
                            setVariants(copy);
                            setIsDirty(true);
                          }}
                          className="w-full bg-[#FAF8F5] p-1.5 border border-[#1C1917]/15 rounded-xs tabular-nums text-[11px]"
                        />
                      </div>

                      {/* Active Status & Delete Actions */}
                      <div className="sm:col-span-1 flex items-center justify-end gap-1.5 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            const copy = [...variants];
                            copy[idx].isActive = copy[idx].isActive === false ? true : false;
                            setVariants(copy);
                            setIsDirty(true);
                          }}
                          className={`p-1.5 rounded-xs cursor-pointer transition-colors ${
                            v.isActive !== false
                              ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              : 'text-stone-400 bg-stone-100 hover:bg-stone-200 line-through'
                          }`}
                          title={v.isActive !== false ? 'Variant Active' : 'Variant Inactive (Hidden)'}
                        >
                          {v.isActive !== false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-xs cursor-pointer transition-colors"
                          title="Delete variant"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Custom colour text input if selected */}
                    {isCustomColor && (
                      <div className="pt-1">
                        <label className="block text-[10px] uppercase tracking-wider font-semibold text-[#78716C] mb-1">
                          Custom Colour Specification
                        </label>
                        <input
                          type="text"
                          value={v.color || ''}
                          placeholder="e.g., Indigo & Ivory or Green + Pink"
                          onChange={(e) => {
                            const copy = [...variants];
                            copy[idx].color = e.target.value;
                            setVariants(copy);
                            setIsDirty(true);
                          }}
                          className="w-full sm:w-1/2 bg-[#FAF8F5] p-1.5 border border-[#1C1917]/15 rounded-xs text-xs text-[#1C1917]"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Button Strip */}
        <div className="flex items-center justify-between pt-4 border-t border-[#1C1917]/10">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={() => onNavigateSubView('products')}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={loading}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {loading ? 'Saving to Database...' : isEditing ? 'Update & Publish' : 'Save & Publish Product'}
          </Button>
        </div>
      </form>
    </div>
  );
};
