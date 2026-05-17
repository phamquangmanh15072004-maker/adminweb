import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, Upload, AlertCircle, Trash, X, Filter, ChevronDown, ArrowUpDown, Box, Download, FileText } from 'lucide-react';
import { subscribeProducts, updateProductStatus } from '../../services/productService'; 
import { doc, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import { db } from '../../firebase'; 
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ProductTable from './ProductTable'; 
import Papa from 'papaparse'; // 🌟 THƯ VIỆN ĐỌC CSV
import { useAuth } from '../../hooks/useAuth';
import { createCustomNotification, notifyLowStock } from '../../services/notificationService';

export default function ProductsPage() {
  const baseCategories = ['HG', 'RG', 'MG', 'PG', 'SD', 'ACCESSORY', 'TOOL', 'Khác'];

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // STATE TÌM KIẾM & LỌC
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("Tất cả"); 
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState("ALL");
  const [priceSort, setPriceSort] = useState<'NONE' | 'ASC' | 'DESC'>('NONE');
  const [only3D, setOnly3D] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const searchFromUrl = searchParams.get('search');

  // STATE XÓA
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string, name: string } | null>(null);
  const [clearAllDialog, setClearAllDialog] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");

  // 🌟 STATE CHO TÍNH NĂNG IMPORT CSV
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ success: number, skipped: number, errors: string[] } | null>(null);  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUserRole = String(currentUser?.role || '').toUpperCase();
  const isAdmin = currentUserRole === 'ADMIN';
  const isInventory = currentUserRole === 'INVENTORY';
  const canManageProducts = isAdmin || isInventory;
  useEffect(() => {
    document.title = "Quản lý Sản Phẩm - Gunpla Store";
  }, []);
  useEffect(() => {
    const unsub = subscribeProducts((data) => {
      setProducts(data);
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!searchFromUrl) return;
    setSearchTerm(searchFromUrl);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    setSearchParams(nextParams, { replace: true });
  }, [searchFromUrl, searchParams, setSearchParams]);

  const normalizeCategory = (value?: string) => {
    const normalized = (value || '').trim().toUpperCase();
    if (!normalized) return 'Khác';
    if (normalized === 'OTHER' || normalized === 'KHAC' || normalized === 'KHÁC') return 'Khác';
    return normalized;
  };

  const filteredProducts = useMemo(() => {
    const filtered = products.filter(p => {
      const matchSearch = (p.name?.toLowerCase().includes(searchTerm.toLowerCase())) || (p.sku?.toLowerCase().includes(searchTerm.toLowerCase()));
      const productCategory = normalizeCategory(p.category);
      const selectedCategory = normalizeCategory(filterCategory);
      const matchCategory = filterCategory === "Tất cả" || productCategory === selectedCategory;
      const has3DModel = Boolean(p.has3D || String(p.model3DUrl || '').trim());
      const match3D = !only3D || has3DModel;
      let matchQuickFilter = true;
      if (quickFilter === "HOT") matchQuickFilter = p.sold > 50 || p.isFeatured;
      if (quickFilter === "NEW") matchQuickFilter = p.createdAt ? (Date.now() - p.createdAt) <= (7 * 24 * 60 * 60 * 1000) : false;
      if (quickFilter === "SALE") matchQuickFilter = p.originalPrice > 0 && p.price < p.originalPrice;
      return matchSearch && matchCategory && matchQuickFilter && match3D;
    });

    if (priceSort === 'NONE') return filtered;
    return [...filtered].sort((a, b) => {
      const aPrice = Number(a?.price || 0);
      const bPrice = Number(b?.price || 0);
      return priceSort === 'ASC' ? aPrice - bPrice : bPrice - aPrice;
    });
  }, [products, searchTerm, filterCategory, quickFilter, priceSort, only3D]);

  const cyclePriceSort = () => {
    setPriceSort((prev) => {
      if (prev === 'NONE') return 'ASC';
      if (prev === 'ASC') return 'DESC';
      return 'NONE';
    });
  };

  const priceSortLabel = useMemo(() => {
    if (priceSort === 'ASC') return 'Giá tăng dần';
    if (priceSort === 'DESC') return 'Giá giảm dần';
    return 'Sắp xếp giá';
  }, [priceSort]);

  const categories = useMemo(() => {
    const dynamicCategories = products
      .map((p) => normalizeCategory(p.category))
      .filter(Boolean);
    return Array.from(new Set([...baseCategories.map((item) => normalizeCategory(item)), ...dynamicCategories]));
  }, [products]);

  const toggleActiveStatus = async (productId: string, currentStatus: boolean) => {
    if (!canManageProducts) return;
    if (isProcessing) return;
    setIsProcessing(true);
    try { 
      await updateProductStatus(productId, !currentStatus); 
      toast.success("Trạng thái đã đổi");
    } catch (err) { toast.error("Lỗi cập nhật!"); } 
    finally { setIsProcessing(false); }
  };

  const confirmDelete = async () => {
    if (!isAdmin) return;
    if (!deleteDialog) return;
    const { id, name } = deleteDialog;
    setDeleteDialog(null);
    setDeletingId(id); 
    setTimeout(async () => {
      try {
        await createCustomNotification(
          'Xóa sản phẩm',
          `Sản phẩm ${name} vừa bị xóa bởi ${currentUser?.name || 'Tài khoản hiện tại'}`,
          ['ADMIN'],
          { type: 'INVENTORY', targetId: id, productId: id }
        );
        const productToDelete = products.find((product) => product.id === id);
        const sku = String(productToDelete?.sku || id).trim().toUpperCase();
        await deleteDoc(doc(db, "products", id));
        if (sku) await deleteDoc(doc(db, "product_skus", sku));
        toast.success(`Đã xóa: ${name.substring(0, 15)}...`);
      } catch (err) { toast.error("Không thể xóa!"); } 
      finally { setDeletingId(null); }
    }, 400);
  };

  const confirmClearAll = async () => {
    if (!isAdmin) return;
    if (clearConfirmText !== "DELETE") return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      products.forEach(p => {
        batch.delete(doc(db, "products", p.id));
        const sku = String(p.sku || p.id || '').trim().toUpperCase();
        if (sku) batch.delete(doc(db, "product_skus", sku));
      });
      await batch.commit();
      setClearAllDialog(false);
      setClearConfirmText("");
      toast.success("Kho hàng đã được dọn sạch sẽ!");
    } catch (err) { toast.error("Lỗi dọn kho!"); } 
    finally { setIsProcessing(false); }
  };

  // ==========================================
  // 🌟 1. TẢI FILE MẪU CHUẨN SYMMETRY
  // ==========================================
  const downloadTemplate = () => {
    const headers = "sku,name,category,price,originalPrice,costPrice,stock,weight,imagesInput,model3DUrl,description,isActive,isFeatured\n";
    const sample = "SKU-TEST-01,Gundam Mẫu,HG,500000,600000,400000,10,250,https://link1.jpg,https://link3d.glb,Mô tả mẫu,TRUE,FALSE\n";
    const bom = "\uFEFF"; 
    const blob = new Blob([bom + headers + sample], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Gunpla_Import_Template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Đã tải File mẫu!");
  };

  // ==========================================
  // 🌟 2. XUẤT CSV: ĐỒNG BỘ 100% VỚI HEADER
  // ==========================================
  const exportToCSV = () => {
    if (filteredProducts.length === 0) { toast.error("Không có dữ liệu!"); return; }
    setIsProcessing(true);
    
    const exportData = filteredProducts.map(p => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      price: p.price,
      originalPrice: p.originalPrice,
      costPrice: p.costPrice,
      stock: p.stock,      weight: p.weight,
      imagesInput: Array.isArray(p.images) ? p.images.join(',') : '', 
      model3DUrl: p.model3DUrl || '',
      description: p.description || '',
      isActive: p.isActive ? "TRUE" : "FALSE",
      isFeatured: p.isFeatured ? "TRUE" : "FALSE"
    }));

    const csvString = Papa.unparse(exportData);
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Kho_Gunpla_${new Date().toISOString().slice(0, 10)}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsProcessing(false);
    toast.success(`Đã xuất ${filteredProducts.length} sản phẩm!`, { icon: '📊' });
  };

  // ==========================================
  // 🌟 3. NHẬP CSV: CÓ BÁO LỖI CHI TIẾT
  // ==========================================
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) { toast.error("Chỉ hỗ trợ file .csv"); return; }

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          let successCount = 0;
          const lowStockProducts: Array<{ productName: string; stock: number; productId: string }> = [];
          const errorLogs: string[] = []; // Sổ ghi lỗi

          results.data.forEach((row: any, index: number) => {
            const lineNum = index + 2; 
            
            const sku = (row.sku || '').trim().toUpperCase();
            const name = (row.name || '').trim();

            if (!sku) { errorLogs.push(`Dòng ${lineNum}: Thiếu mã SKU.`); return; }
            if (sku.includes('/') || sku.includes('\\') || sku.includes(' ')) {
              errorLogs.push(`Dòng ${lineNum}: Mã SKU "${sku}" chứa khoảng trắng hoặc ký tự cấm (/, \\).`); return;
            }
            if (!name) { errorLogs.push(`Dòng ${lineNum}: SKU [${sku}] thiếu Tên sản phẩm.`); return; }

            const parseNumber = (val: any, fieldName: string) => {
              if (val === '' || val === null || val === undefined) return 0;
              const raw = String(val).trim();
              const normalized = raw.replace(/[^\d-]/g, '');
              const num = Number(normalized || 0);
              if (isNaN(num) || num < 0) {
                throw new Error(`Dòng ${lineNum}: SKU [${sku}] có ${fieldName} không hợp lệ ("${val}").`);
              }
              return num;
            };

            try {
              // Ép kiểu và kiểm tra các trường số
              const price = parseNumber(row.price, 'Giá bán');
              const originalPrice = parseNumber(row.originalPrice, 'Giá gốc');
              const costPrice = parseNumber(row.costPrice, 'Giá vốn');
              const stockToAdd = parseNumber(row.stock, 'Tồn kho'); // 🌟 Đổi tên biến cho rõ nghĩa
              const weight = parseNumber(row.weight, 'Cân nặng');

              // Xử lý Ảnh
              const imagesArray = row.imagesInput ? String(row.imagesInput).split(/[\n,;]+/).map(u => u.trim()).filter(Boolean) : [];
              const mainImageUrl = imagesArray.length > 0 ? imagesArray[0] : '';

              const productData = {
                id: sku,
                sku, name,
                category: row.category?.trim() || 'Khác',
                price, originalPrice, costPrice, weight,
                
                // 🌟 PHÉP THUẬT CỘNG DỒN TỒN KHO NẰM Ở ĐÂY 🌟
                stock: increment(stockToAdd), 
                
                images: imagesArray,
                imageUrl: mainImageUrl,
                model3DUrl: row.model3DUrl?.trim() || '',
                has3D: !!row.model3DUrl?.trim(),
                description: row.description?.trim() || '',
                isActive: String(row.isActive).trim().toUpperCase() === 'FALSE' ? false : true,
                isFeatured: String(row.isFeatured).trim().toUpperCase() === 'TRUE' ? true : false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };

              const docRef = doc(db, "products", sku);
              const skuRef = doc(db, "product_skus", sku);

              batch.set(docRef, productData, { merge: true }); 
              batch.set(skuRef, {
                sku,
                productId: sku,
                updatedAt: Date.now(),
              }, { merge: true });
              successCount++;

              if (stockToAdd <= 5) {
                lowStockProducts.push({ productName: name, stock: stockToAdd, productId: sku });
              }
              
            } catch (validationError: any) {
              errorLogs.push(validationError.message);
            }
          });

          if (successCount > 250) {
            toast.error("Vui lòng chia nhỏ file CSV (tối đa 250 dòng/lần)");
            setIsImporting(false); return;
          }

          if (successCount > 0) {
             await batch.commit(); 
             await Promise.all(
              lowStockProducts.map((product) => notifyLowStock(product.productName, product.stock, product.productId))
             );
          }
          
          setImportSummary({ 
            success: successCount, 
            skipped: errorLogs.length, 
            errors: errorLogs // Truyền sổ lỗi ra State
          });

          setSearchTerm("");
          setFilterCategory("Tất cả");
          setQuickFilter("ALL");

        } catch (error) { toast.error("Lỗi khi ghi vào Database!"); } 
        finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = ''; 
        }
      }
    });
  };
// ==========================================
  // 🌟 3. XUẤT RA FILE .TXT (DẠNG BÁO CÁO DỄ ĐỌC)
  // ==========================================
  const exportToTXT = () => {
    if (filteredProducts.length === 0) { 
      toast.error("Không có dữ liệu để xuất!"); 
      return; 
    }
    
    setIsProcessing(true);

    // 1. Khởi tạo tiêu đề của file Text
    const dateStr = new Date().toLocaleString('vi-VN');
    let textContent = `BÁO CÁO KIỂM KHO GUNPLA\nNgày xuất: ${dateStr}\nTổng số: ${filteredProducts.length} sản phẩm\n`;
    textContent += `=================================================\n\n`;

    // 2. Lặp qua từng sản phẩm và trình bày nó thành văn bản đẹp mắt
    filteredProducts.forEach((p, index) => {
      textContent += `[Sản phẩm ${index + 1}]\n`;
      textContent += `- Mã SKU    : ${p.sku}\n`;
      textContent += `- Tên       : ${p.name}\n`;
      textContent += `- Phân loại : ${p.category}\n`;
      textContent += `- Giá bán   : ${new Intl.NumberFormat('vi-VN').format(p.price)} VNĐ\n`;
      textContent += `- Tồn kho   : ${p.stock} hộp\n`;
      textContent += `- Đã bán    : ${p.sold} hộp\n`;
      textContent += `- Trạng thái: ${p.isActive ? 'Đang mở bán' : 'Đã ẩn'}\n`;
      textContent += `-------------------------------------------------\n`;
    });

    // 3. Tạo file TXT với chuẩn UTF-8 để không lỗi tiếng Việt
    const bom = "\uFEFF"; 
    const blob = new Blob([bom + textContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Bao_Cao_Gunpla_${new Date().toISOString().slice(0, 10)}.txt`;
    
    // 4. Kích hoạt tải xuống
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsProcessing(false);
    toast.success(`Đã xuất file TXT cho ${filteredProducts.length} sản phẩm!`, { icon: '📄' });
  };
  return (
    <div className="flex flex-col animate-in fade-in duration-300 relative">
        <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4 sm:pb-5">
          <div className="relative px-5 sm:px-6 lg:px-8 py-6 rounded-t-[28px] border border-slate-900/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 text-white">
            <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(56,189,248,0.22), transparent 0), radial-gradient(circle at 80% 0%, rgba(99,102,241,0.18), transparent 0)' }} />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-sky-300 font-black">Quản lý kho</p>
                <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Danh sách sản phẩm</h1>
                <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
                  Theo dõi tồn kho, nhanh chóng chỉnh sửa, lọc và quản lý toàn bộ sản phẩm theo kiểu dashboard chuyên nghiệp.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[420px]">
                <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">Tổng sản phẩm</p>
                  <p className="mt-1 text-2xl font-black">{products.length}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">Đang hiển thị</p>
                  <p className="mt-1 text-2xl font-black">{filteredProducts.length}</p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">Nổi bật</p>
                  <p className="mt-1 text-2xl font-black">{products.filter((item) => item.isFeatured).length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-20 px-5 sm:px-6 lg:px-8 py-5 border-x border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
            <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
              <div className="min-w-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_220px] gap-3">
                <div className="relative min-w-0 z-[30]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full min-w-0 pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-medium"
                  />
                </div>
                <div className="relative min-w-0 w-full z-[35]">
                  <button
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                    className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-all text-sm font-bold text-slate-700 shadow-sm cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-blue-500" />
                      <span className="truncate">{filterCategory === 'Tất cả' ? 'Tất cả' : filterCategory}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isCategoryOpen && (
                    <>
                      <div className="fixed inset-0 z-[80]" onClick={() => setIsCategoryOpen(false)}></div>
                      <div className="absolute top-full mt-2 left-0 w-full min-w-[220px] bg-white border border-slate-200 shadow-2xl rounded-2xl py-2 z-[90] animate-in fade-in slide-in-from-top-2">
                        <button onClick={() => { setFilterCategory('Tất cả'); setIsCategoryOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors cursor-pointer ${filterCategory === 'Tất cả' ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-600' : 'text-slate-600 hover:bg-slate-50 border-l-2 border-transparent'}`}>Tất cả</button>
                        {categories.map((cat) => (
                          <button key={cat} onClick={() => { setFilterCategory(cat); setIsCategoryOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-bold transition-colors cursor-pointer ${filterCategory === cat ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-600' : 'text-slate-600 hover:bg-slate-50 border-l-2 border-transparent'}`}>{cat}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                {isAdmin && products.length > 0 && (
                  <button onClick={() => setClearAllDialog(true)} className="inline-flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl text-xs font-bold transition-all uppercase tracking-widest cursor-pointer border border-red-100 shrink-0 whitespace-nowrap">
                    <Trash className="w-4 h-4" /> Dọn kho
                  </button>
                )}

                {canManageProducts && (
                  <button onClick={() => setShowImportModal(true)} className="inline-flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-2xl text-xs font-bold transition-all uppercase tracking-widest cursor-pointer border border-emerald-100 shrink-0 whitespace-nowrap">
                    <Upload className="w-4 h-4" /> Nhập CSV
                  </button>
                )}
                {canManageProducts && (
                  <button onClick={exportToCSV} disabled={isProcessing} className="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-2xl text-xs font-bold transition-all uppercase tracking-widest cursor-pointer border border-blue-100 disabled:opacity-50 shrink-0 whitespace-nowrap">
                    <Download className="w-4 h-4" /> Xuất CSV
                  </button>
                )}
                {canManageProducts && (
                  <button onClick={exportToTXT} disabled={isProcessing} className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-2xl text-xs font-bold transition-all uppercase tracking-widest cursor-pointer border border-slate-200 disabled:opacity-50 shrink-0 whitespace-nowrap">
                    <FileText className="w-4 h-4" /> Xuất TXT
                  </button>
                )}
                {canManageProducts && (
                  <button onClick={() => navigate('/products/new')} className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-200 uppercase tracking-widest transition-all cursor-pointer shrink-0 whitespace-nowrap">
                    <Plus className="w-4 h-4" /> Thêm mới
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
              <button onClick={() => setQuickFilter('ALL')} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${quickFilter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Tất cả</button>
              <button onClick={() => setQuickFilter('HOT')} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1 cursor-pointer ${quickFilter === 'HOT' ? 'bg-red-500 text-white shadow-md shadow-red-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>Hàng HOT 🔥</button>
              <button onClick={() => setQuickFilter('NEW')} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1 cursor-pointer ${quickFilter === 'NEW' ? 'bg-blue-500 text-white shadow-md shadow-blue-200' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>Hàng mới 🆕</button>
              <button onClick={() => setQuickFilter('SALE')} className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1 cursor-pointer ${quickFilter === 'SALE' ? 'bg-orange-500 text-white shadow-md shadow-orange-200' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}>Đang giảm giá %</button>
              <button
                onClick={() => setOnly3D((prev) => !prev)}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1 cursor-pointer ${
                  only3D
                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200'
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                3D
              </button>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-xs font-semibold text-slate-500">
                Đang hiển thị <span className="text-slate-700">{filteredProducts.length}</span> sản phẩm
              </p>
              <button
                onClick={cyclePriceSort}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-blue-100 hover:text-blue-700 transition-all text-sm font-bold text-slate-700 cursor-pointer"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span>{priceSortLabel}</span>
              </button>
            </div>
          </div>

          <div className="relative z-0 border-x border-b border-slate-200/70 rounded-b-[28px] bg-white/90 min-h-[calc(100vh-360px)]">
            <div className="overflow-visible flex flex-col relative rounded-b-[28px] min-h-[calc(100vh-360px)]">
              <ProductTable 
                 products={filteredProducts} 
                 deletingId={deletingId}
                 onToggleStatus={toggleActiveStatus}
                 onEdit={(item: { id: string }) => navigate(`/products/${item.id}`)}
                 onDelete={(id: string, name: string) => setDeleteDialog({ id, name })}
                  currentUserRole={currentUserRole}
              />

              {isLoading && (
                <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px] z-40 flex items-center justify-center">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-semibold text-slate-600">Đang tải danh sách sản phẩm...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>

      {/* ========================================== */}
      {/* 🌟 MODAL IMPORT CSV 🌟 */}
      {/* ========================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header Modal */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><FileText className="w-5 h-5" /></div>
                <div><h3 className="font-black text-slate-900 text-lg tracking-tight">Nhập sản phẩm hàng loạt</h3><p className="text-xs font-semibold text-slate-500">Thêm nhanh hàng trăm Gunpla qua file CSV</p></div>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportSummary(null); }} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {/* Nội dung Modal */}
            <div className="p-6 space-y-6">
               
               {/* Nút Tải Template */}
               {!importSummary && (
                 <div className="flex items-center justify-between p-4 rounded-2xl border border-blue-100 bg-blue-50">
                    <div>
                      <p className="text-sm font-bold text-blue-900">1. Tải File Mẫu (Template)</p>
                      <p className="text-xs text-blue-700 mt-1">Điền dữ liệu theo đúng chuẩn các cột có sẵn.</p>
                    </div>
                    <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-colors"><Download className="w-4 h-4"/> Tải xuống</button>
                 </div>
               )}

               {/* 🌟 KHU VỰC BÁO CÁO THÀNH CÔNG & LỖI (Đã thêm phần hiện lỗi) */}
               {importSummary ? (
                  <div className="flex flex-col items-center py-4 animate-in zoom-in">
                     <div className="flex gap-6 w-full mb-6">
                        <div className="flex-1 p-5 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                           <p className="text-4xl font-black text-emerald-600">{importSummary.success}</p>
                           <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mt-1">Đã lưu thành công</p>
                        </div>
                        <div className="flex-1 p-5 bg-red-50 rounded-2xl border border-red-100 text-center">
                           <p className="text-4xl font-black text-red-600">{importSummary.skipped}</p>
                           <p className="text-xs font-bold text-red-800 uppercase tracking-wide mt-1">Lỗi / Bị bỏ qua</p>
                        </div>
                     </div>
                     
                     {/* BẢNG CHI TIẾT LỖI (Break-words để chữ không bị tràn) */}
                     {importSummary.errors && importSummary.errors.length > 0 && (
                        <div className="w-full text-left bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
                           <p className="text-xs font-black text-red-600 uppercase mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4"/> Chi tiết các dòng bị lỗi trong Excel:</p>
                           <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2 pr-2 break-words">
                             {importSummary.errors.map((err, idx) => (
                               <div key={idx} className="text-xs font-medium text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm leading-relaxed">
                                 {err}
                               </div>
                             ))}
                           </div>
                        </div>
                     )}

                     <button onClick={() => { setShowImportModal(false); setImportSummary(null); }} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer transition-colors shadow-lg">Đóng / Hoàn tất</button>
                  </div>
               ) : (
                 /* Khu vực Upload (Ẩn đi khi đang import hoặc khi đã xong) */
                 <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      disabled={isImporting}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10" 
                    />
                    <div className={`flex flex-col items-center justify-center p-10 rounded-3xl border-2 border-dashed transition-all ${isImporting ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50'}`}>
                      {isImporting ? (
                         <>
                           <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                           <p className="text-sm font-bold text-slate-700">Đang xử lý dữ liệu và đẩy lên Firebase...</p>
                         </>
                      ) : (
                         <>
                           <Upload className="w-12 h-12 text-slate-400 mb-4" />
                           <p className="text-sm font-bold text-slate-900">2. Kéo thả file CSV vào đây hoặc click để chọn</p>
                           <p className="text-xs font-medium text-slate-500 mt-2">Hỗ trợ tối đa 250 sản phẩm / 1 lần tải lên.</p>
                         </>
                      )}
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* DIALOG XÓA & CLEAR */}
      {deleteDialog && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-black uppercase tracking-wide text-sm">Xác nhận xóa</h3>
              </div>
              <button onClick={() => setDeleteDialog(null)} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Bạn sắp xóa sản phẩm <span className="font-bold text-gray-900">{deleteDialog.name}</span>. Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setDeleteDialog(null)} className="px-4 py-2 text-sm font-bold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors">
                Hủy
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors">
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {clearAllDialog && (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <Trash className="w-5 h-5" />
                <h3 className="font-black uppercase tracking-wide text-sm">Dọn toàn bộ kho</h3>
              </div>
              <button onClick={() => { setClearAllDialog(false); setClearConfirmText(""); }} className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-gray-600 leading-relaxed">
                Thao tác này sẽ xóa <span className="font-bold text-gray-900">toàn bộ {products.length} sản phẩm</span> trong kho. Để xác nhận, nhập chính xác từ khóa bên dưới.
              </p>
              <input
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="Nhập DELETE để xác nhận"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-red-100 focus:border-red-400 text-sm font-semibold"
              />
            </div>
            <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setClearAllDialog(false); setClearConfirmText(""); }} className="px-4 py-2 text-sm font-bold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 transition-colors">
                Hủy
              </button>
              <button
                onClick={confirmClearAll}
                disabled={clearConfirmText !== "DELETE" || isProcessing}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? "Đang dọn..." : "Xóa toàn bộ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
