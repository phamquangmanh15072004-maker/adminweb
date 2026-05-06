import { useEffect, useState } from 'react';
import { Box as BoxIcon, Edit, EyeOff, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductTableProps {
  products: any[];
  deletingId: string | null;
  onToggleStatus: (id: string, currentStatus: boolean) => void;
  onEdit: (product: any) => void;
  onDelete: (id: string, name: string) => void;
  currentUserRole: string;
}

export default function ProductTable({ products, deletingId, onToggleStatus, onEdit, onDelete, currentUserRole }: ProductTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const isAdmin = currentUserRole === 'ADMIN';
  const canEdit = isAdmin || currentUserRole === 'INVENTORY';

  const totalPages = Math.ceil(products.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = products.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    const lastPage = Math.max(1, totalPages || 1);
    if (currentPage > lastPage) {
      setCurrentPage(lastPage);
    }
  }, [currentPage, totalPages]);

  const StockBadge = ({ stock }: { stock: number }) => {
    const baseClass = 'inline-block px-2 py-1 text-[10px] font-black rounded border uppercase whitespace-nowrap';
    if (stock > 10) return <span className={`${baseClass} bg-green-50 text-green-600 border-green-100`}>Còn hàng ({stock})</span>;
    if (stock > 0) return <span className={`${baseClass} bg-orange-50 text-orange-600 border-orange-100`}>Sắp hết ({stock})</span>;
    return <span className={`${baseClass} bg-red-50 text-red-600 border-red-100`}>Hết hàng</span>;
  };

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="overflow-visible p-3 sm:p-4 lg:p-5">
        <div className="space-y-3 lg:hidden">
          {paginatedProducts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-slate-500 font-medium">
              Không tìm thấy sản phẩm nào
            </div>
          )}

          {paginatedProducts.map((item, index) => {
            const discount = item.originalPrice > 0 && item.price < item.originalPrice
              ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
              : 0;
            const isNew = item.createdAt ? Date.now() - item.createdAt <= 7 * 24 * 60 * 60 * 1000 : false;
            const isHot = item.sold > 50 || item.isFeatured;

            return (
              <div
                key={item.id}
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                className={`rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)] p-3.5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_45px_rgba(37,99,235,0.18)] cursor-pointer ${
                  deletingId === item.id ? 'opacity-0 -translate-x-full' : ''
                } ${!item.isActive ? 'opacity-70' : ''}`}
              >
                <div className="flex gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={item.imageUrl || 'https://placehold.co/100x100?text=No+Img'}
                      className="w-18 h-18 rounded-2xl object-cover border border-slate-200"
                    />
                    {!item.isActive && (
                      <div className="absolute inset-0 bg-black/25 rounded-2xl flex items-center justify-center">
                        <EyeOff className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-900 text-sm truncate leading-tight" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono mt-1">SKU: {item.sku || 'N/A'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {isNew && <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide">MỚI</span>}
                      {isHot && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide">HOT</span>}
                      {item.has3D && (
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-bold border border-indigo-200 inline-flex items-center gap-1">
                          <BoxIcon className="w-3 h-3" /> 3D
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{item.category || 'Khác'}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                    <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Giá bán</p>
                    <p className="text-sm font-black text-blue-600">
                      {item.price?.toLocaleString('vi-VN')}đ {discount > 0 ? `(-${discount}%)` : ''}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Vốn: {item.costPrice?.toLocaleString('vi-VN')}đ</p>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                    <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Kho hàng</p>
                    <StockBadge stock={item.stock} />
                    <p className="text-[10px] text-slate-500 mt-1">Đã bán: {item.sold || 0}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <button
                    onClick={() => onToggleStatus(item.id, item.isActive)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 hover:scale-[1.06] cursor-pointer ${
                      item.isActive ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 hover:bg-slate-400'
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        item.isActive ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  <div className="flex items-center gap-1">
                    {canEdit && (
                      <button onClick={() => onEdit(item)} className="p-2 text-blue-600 hover:bg-blue-200 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer" title="Chỉnh sửa">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => onDelete(item.id, item.name)} className="p-2 text-red-600 hover:bg-red-200 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden lg:grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
          {paginatedProducts.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-slate-500 font-medium">
              Không tìm thấy sản phẩm nào
            </div>
          )}

          {paginatedProducts.map((item, index) => {
            const discount = item.originalPrice > 0 && item.price < item.originalPrice
              ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
              : 0;
            const isNew = item.createdAt ? Date.now() - item.createdAt <= 7 * 24 * 60 * 60 * 1000 : false;
            const isHot = item.sold > 50 || item.isFeatured;

            return (
              <article
                key={item.id}
                style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
                className={`rounded-3xl border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)] p-5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_20px_55px_rgba(37,99,235,0.20)] cursor-pointer ${
                  deletingId === item.id ? 'opacity-0 -translate-x-full' : ''
                } ${!item.isActive ? 'opacity-70' : 'hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <img
                      src={item.imageUrl || 'https://placehold.co/100x100?text=No+Img'}
                      className="w-20 h-20 rounded-2xl object-cover border border-slate-200 bg-slate-100"
                    />
                    {!item.isActive && (
                      <div className="absolute inset-0 bg-black/25 rounded-2xl flex items-center justify-center">
                        <EyeOff className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 text-base truncate leading-tight" title={item.name}>
                          {item.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono mt-1">SKU: {item.sku || 'N/A'}</p>
                      </div>

                      <button
                        onClick={() => onToggleStatus(item.id, item.isActive)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-all duration-300 ease-out hover:scale-[1.06] cursor-pointer ${
                          item.isActive ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-300 hover:bg-slate-400'
                        }`}
                      >
                        <span className={`h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${item.isActive ? 'translate-x-4.5' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {isNew && <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide">MỚI</span>}
                      {isHot && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[9px] font-black tracking-wide">HOT</span>}
                      {item.has3D && (
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[9px] font-bold border border-indigo-200 inline-flex items-center gap-1">
                          <BoxIcon className="w-3 h-3" /> 3D
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{item.category || 'Khác'}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Giá bán</p>
                        <p className="text-sm font-black text-blue-600 mt-1">
                          {item.price?.toLocaleString('vi-VN')}đ {discount > 0 ? `(-${discount}%)` : ''}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Kho hàng</p>
                        <div className="mt-1"><StockBadge stock={item.stock} /></div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3">
                        <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Đã bán</p>
                        <p className="text-sm font-black text-slate-700 mt-1">{item.sold || 0}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-1">
                      {canEdit && (
                        <button onClick={() => onEdit(item)} className="inline-flex items-center gap-1.5 px-3 py-2 text-blue-600 hover:bg-blue-200 rounded-xl text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:text-blue-800 active:translate-y-0 cursor-pointer" title="Chỉnh sửa">
                          <Edit className="w-4 h-4" /> Sửa
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => onDelete(item.id, item.name)} className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-200 rounded-xl text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:text-red-800 active:translate-y-0 cursor-pointer" title="Xóa">
                          <Trash2 className="w-4 h-4" /> Xóa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/90 backdrop-blur flex items-center justify-between rounded-b-[28px]">
        <p className="text-xs text-slate-500 font-medium">
          Đang xem <span className="font-bold text-slate-900">{products.length === 0 ? 0 : startIndex + 1}</span> -{' '}
          <span className="font-bold text-slate-900">{Math.min(startIndex + itemsPerPage, products.length)}</span> /{' '}
          <span className="font-bold text-slate-900">{products.length}</span>
        </p>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-100 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-bold text-slate-700 px-2">
            {totalPages === 0 ? 0 : currentPage}/{totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages || 1, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-blue-100 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
