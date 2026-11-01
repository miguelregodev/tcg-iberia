'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { AdminNav } from '@/components/AdminNav';
import type { MediaLibraryImage } from '@/lib/media-library';

type StorageProvider = 'all' | 'supabase' | 'r2';
type AssignmentStatus = 'all' | 'assigned' | 'unassigned';
type MigrationStatus = 'all' | 'not_started' | 'migrated' | 'failed';
type FileType = 'all' | 'webp' | 'jpeg' | 'png' | 'avif' | 'other';
type SortBy = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'size-largest' | 'size-smallest';

export default function MediaLibraryPage() {
  const [images, setImages] = useState<MediaLibraryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [storageFilter, setStorageFilter] = useState<StorageProvider>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentStatus>('all');
  const [migrationFilter, setMigrationFilter] = useState<MigrationStatus>('all');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileType>('all');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    supabase: 0,
    r2: 0,
    assigned: 0,
    unassigned: 0,
    migrationEligible: 0,
  });

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/media-library');
      if (response.ok) {
        const data = await response.json();
        setImages(data.images || []);
        updateStats(data.images || []);
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (imgs: MediaLibraryImage[]) => {
    setStats({
      total: imgs.length,
      supabase: imgs.filter((i) => i.provider === 'supabase').length,
      r2: imgs.filter((i) => i.provider === 'r2').length,
      assigned: imgs.filter((i) => i.assignedProducts.length > 0).length,
      unassigned: imgs.filter((i) => i.assignedProducts.length === 0).length,
      migrationEligible: imgs.filter((i) => i.provider === 'supabase').length,
    });
  };

  const filteredAndSorted = useMemo(() => {
    let result = images;

    // Apply filters
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (img) =>
          img.filename.toLowerCase().includes(term) ||
          img.publicUrl.toLowerCase().includes(term) ||
          img.key.toLowerCase().includes(term) ||
          img.assignedProducts.some((p) => p.productName.toLowerCase().includes(term))
      );
    }

    if (storageFilter !== 'all') {
      result = result.filter((img) => img.provider === storageFilter);
    }

    if (assignmentFilter === 'assigned') {
      result = result.filter((img) => img.assignedProducts.length > 0);
    } else if (assignmentFilter === 'unassigned') {
      result = result.filter((img) => img.assignedProducts.length === 0);
    }

    if (migrationFilter !== 'all') {
      if (migrationFilter === 'not_started') {
        result = result.filter((img) => img.provider === 'supabase');
      } else if (migrationFilter === 'migrated') {
        result = result.filter((img) => img.provider === 'r2');
      }
    }

    if (fileTypeFilter !== 'all') {
      result = result.filter((img) => {
        const ext = img.filename.split('.').pop()?.toLowerCase() || '';
        if (fileTypeFilter === 'jpeg') return ext === 'jpg' || ext === 'jpeg';
        return ext === fileTypeFilter;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name-asc':
          return a.filename.localeCompare(b.filename);
        case 'name-desc':
          return b.filename.localeCompare(a.filename);
        case 'size-largest':
          return b.size - a.size;
        case 'size-smallest':
          return a.size - b.size;
        default:
          return 0;
      }
    });

    return result;
  }, [images, search, storageFilter, assignmentFilter, migrationFilter, fileTypeFilter, sortBy]);

  const paginatedImages = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSorted.length / pageSize);

  const selectedImage = images.find((img) => img.id === selectedImageId);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <div className="container-custom px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Biblioteca Multimedia</h1>
          <p className="text-gray-700">Gestiona todas tus imágenes de productos en Supabase y Cloudflare R2</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-700 font-medium">Total de imágenes</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-700 font-medium">Supabase Storage</p>
            <p className="text-2xl font-bold text-gray-900">{stats.supabase}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600">
            <p className="text-sm text-gray-700 font-medium">Cloudflare R2</p>
            <p className="text-2xl font-bold text-gray-900">{stats.r2}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-700 font-medium">Asignadas</p>
            <p className="text-2xl font-bold text-gray-900">{stats.assigned}</p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <input
                type="text"
                placeholder="Nombre, URL, producto..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              />
            </div>

            {/* Storage Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <select
                value={storageFilter}
                onChange={(e) => {
                  setStorageFilter(e.target.value as StorageProvider);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              >
                <option value="all">Todos</option>
                <option value="supabase">Supabase Storage</option>
                <option value="r2">Cloudflare R2</option>
              </select>
            </div>

            {/* Assignment Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado de asignación</label>
              <select
                value={assignmentFilter}
                onChange={(e) => {
                  setAssignmentFilter(e.target.value as AssignmentStatus);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              >
                <option value="all">Todos</option>
                <option value="assigned">Asignadas a productos</option>
                <option value="unassigned">Sin asignar</option>
              </select>
            </div>

            {/* Sorting */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              >
                <option value="newest">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="name-asc">Nombre (A-Z)</option>
                <option value="name-desc">Nombre (Z-A)</option>
                <option value="size-largest">Tamaño (Mayor)</option>
                <option value="size-smallest">Tamaño (Menor)</option>
              </select>
            </div>

            {/* Page Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Por página</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn btn-primary text-sm"
            >
              📤 Subir imágenes
            </button>
            <button
              onClick={fetchImages}
              disabled={loading}
              className="btn btn-secondary text-sm"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image Grid */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-800 font-medium">Cargando imágenes...</p>
              </div>
            ) : paginatedImages.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-gray-800 text-lg font-medium">No se encontraron imágenes</p>
                <p className="text-gray-700 text-sm mt-2">Intenta cambiar los filtros o sube nuevas imágenes</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {paginatedImages.map((image) => (
                    <MediaLibraryImageCard
                      key={image.id}
                      image={image}
                      isSelected={selectedImageId === image.id}
                      onSelect={setSelectedImageId}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center bg-white rounded-lg p-4 border border-gray-200">
                    <p className="text-sm font-medium text-gray-700">
                      Página {currentPage} de {totalPages} ({filteredAndSorted.length} imágenes)
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 text-gray-900 font-medium"
                      >
                        ←
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 text-gray-900 font-medium"
                      >
                        →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Image Details Panel */}
          <div className="lg:col-span-1">
            {selectedImage ? (
              <MediaLibraryImageInspector
                image={selectedImage}
                onClose={() => setSelectedImageId(null)}
                onRefresh={fetchImages}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                <p className="text-gray-700">Selecciona una imagen para ver detalles</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <MediaLibraryUploadModal
          onClose={() => setShowUploadModal(false)}
          onUpload={fetchImages}
        />
      )}
    </div>
  );
}

// ===== Image Card Component =====
function MediaLibraryImageCard({
  image,
  isSelected,
  onSelect,
}: {
  image: MediaLibraryImage;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(image.id)}
      className={`rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
        isSelected ? 'border-red-500 shadow-lg' : 'border-gray-200 shadow-sm hover:shadow-md'
      }`}
    >
      <div className="relative aspect-square bg-gray-100">
        <img
          src={image.publicUrl}
          alt={image.filename}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black opacity-0 hover:opacity-10 transition-opacity" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <span
            className={`px-2 py-1 rounded text-xs font-medium text-white ${
              image.provider === 'r2' ? 'bg-blue-600' : 'bg-purple-600'
            }`}
          >
            {image.provider === 'r2' ? 'R2' : 'Supabase'}
          </span>
          {image.assignedProducts.length > 0 && (
            <span className="px-2 py-1 rounded text-xs font-medium text-white bg-green-600">
              {image.assignedProducts.length}
            </span>
          )}
        </div>
      </div>

      <div className="p-2 text-xs">
        <p className="font-medium text-gray-900 truncate">{image.filename}</p>
        <p className="text-gray-700">{formatFileSize(image.size)}</p>
      </div>
    </div>
  );
}

// ===== Image Inspector Component =====
function MediaLibraryImageInspector({
  image,
  onClose,
  onRefresh,
}: {
  image: MediaLibraryImage;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(image.publicUrl);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/media-library/${encodeURIComponent(image.id)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Imagen eliminada correctamente');
        onRefresh();
        onClose();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      alert('Error al eliminar la imagen');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleMigrate = async () => {
    if (!showMigrateConfirm) {
      setShowMigrateConfirm(true);
      return;
    }

    setMigrating(true);
    try {
      const response = await fetch('/api/admin/media-library/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'migrate-single',
          imageUrl: image.publicUrl 
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Migración exitosa: ${result.productsUpdated} producto(s) actualizado(s)`);
        onRefresh();
      } else {
        const error = await response.json();
        alert(`Error en migración: ${error.error}`);
      }
    } catch (err) {
      alert('Error al migrar la imagen');
    } finally {
      setMigrating(false);
      setShowMigrateConfirm(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
      {/* Image Preview */}
      <div className="aspect-square bg-gray-100">
        <img src={image.publicUrl} alt={image.filename} className="w-full h-full object-cover" />
      </div>

      {/* Details */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="font-bold text-lg text-gray-900 mb-1">{image.filename}</h3>

        <div className="space-y-3 text-sm mb-4">
          <div>
            <p className="text-gray-700 font-medium">Proveedor</p>
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium text-white ${
              image.provider === 'r2' ? 'bg-blue-600' : 'bg-purple-600'
            }`}>
              {image.provider === 'r2' ? 'Cloudflare R2' : 'Supabase Storage'}
            </span>
          </div>

          <div>
            <p className="text-gray-700 font-medium">Tamaño</p>
            <p className="text-gray-900">{formatFileSize(image.size)}</p>
          </div>

          <div>
            <p className="text-gray-700 font-medium">Creado</p>
            <p className="text-gray-900">{new Date(image.createdAt).toLocaleDateString()}</p>
          </div>

          <div>
            <p className="text-gray-700 font-medium">URL Pública</p>
            <p className="text-xs text-gray-700 break-all font-mono bg-gray-100 p-2 rounded mt-1">
              {image.publicUrl}
            </p>
          </div>
        </div>

        {/* Assigned Products */}
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">Productos asignados</h4>
          {image.assignedProducts.length === 0 ? (
            <p className="text-sm text-gray-700">No asignada a ningún producto</p>
          ) : (
            <ul className="space-y-2">
              {image.assignedProducts.map((product) => (
                <li key={product.productId} className="text-sm bg-gray-100 p-2 rounded border border-gray-200">
                  <p className="font-medium text-gray-900">{product.productName}</p>
                  <a
                    href={`/admin/products#${product.productId}`}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Ver en editor →
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 p-4 space-y-2">
        <button
          onClick={handleCopyUrl}
          className="w-full px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-medium rounded transition"
        >
          {copying ? '✓ Copiado' : '📋 Copiar URL'}
        </button>

        <a
          href={image.publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full block text-center px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 text-sm font-medium rounded transition"
        >
          🔗 Abrir en nueva pestaña
        </a>

        {/* Migrate to R2 Button - Only for Supabase images */}
        {image.provider === 'supabase' && (
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className={`w-full px-3 py-2 text-sm font-medium rounded transition ${
              showMigrateConfirm
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-900'
            }`}
          >
            {migrating ? '⏳ Migrando...' : showMigrateConfirm ? '¿Confirmar migración a R2?' : '🚀 Migrar a R2'}
          </button>
        )}

        {image.assignedProducts.length === 0 && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`w-full px-3 py-2 text-sm font-medium rounded transition ${
              showDeleteConfirm
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
            }`}
          >
            {deleting ? '⏳ Eliminando...' : showDeleteConfirm ? '¿Confirmar eliminación?' : '🗑️ Eliminar'}
          </button>
        )}

        {image.assignedProducts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
            <p className="text-xs text-yellow-800">
              ⚠️ No se puede eliminar: {image.assignedProducts.length} producto(s) usando esta imagen
            </p>
          </div>
        )}

        {/* Migration Info Message */}
        {showMigrateConfirm && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-xs text-blue-900 font-medium mb-2">
              📋 Detalles de la migración:
            </p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Proveedor: Supabase Storage → Cloudflare R2</li>
              <li>• Productos afectados: {image.assignedProducts.length}</li>
              {image.assignedProducts.length > 0 && (
                <li>• URLs de {image.assignedProducts.length} producto(s) serán actualizadas</li>
              )}
              <li>• El archivo original permanecerá en Supabase</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Upload Modal Component =====
function MediaLibraryUploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [provider, setProvider] = useState<'r2' | 'supabase'>('r2');

  const handleFiles = async (files: FileList) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));

    if (fileArray.length === 0) {
      alert('Por favor selecciona archivos de imagen válidos');
      return;
    }

    setUploading(true);
    setUploadedCount(0);
    setErrorCount(0);

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('provider', provider);

        const response = await fetch('/api/admin/media-library/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          setUploadedCount((prev) => prev + 1);
        } else {
          setErrorCount((prev) => prev + 1);
        }
      } catch (err) {
        setErrorCount((prev) => prev + 1);
      }
    }

    setUploading(false);

    if (errorCount === 0) {
      onUpload();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Subir imágenes</h2>
            <button
              onClick={onClose}
              className="text-gray-700 hover:text-gray-900 text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Proveedor de almacenamiento</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as 'r2' | 'supabase')}
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 text-gray-900"
            >
              <option value="r2">Cloudflare R2 (recomendado)</option>
              <option value="supabase">Supabase Storage</option>
            </select>
          </div>

          {/* Drag and Drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files) {
                handleFiles(e.dataTransfer.files);
              }
            }}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
              dragging ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
          >
            <p className="text-gray-800 font-medium">Arrastra imágenes aquí</p>
            <p className="text-xs text-gray-700 mt-1">o</p>
            <label className="text-red-600 hover:underline cursor-pointer text-sm font-medium mt-1 inline-block">
              selecciona del ordenador
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>

          {uploading && (
            <div className="text-center">
              <p className="text-sm text-gray-800 font-medium">
                Subiendo... {uploadedCount} completadas, {errorCount} errores
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== Utilities =====
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
