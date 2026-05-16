import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, limit, query, where, orderBy, runTransaction } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Save, ImageIcon, Box, ChevronLeft, ChevronRight,
  MessageSquare, Maximize2, X, TrendingUp, Loader2, CheckCircle2, AlertTriangle, Star
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useLottie } from 'lottie-react';
import robotLoadingJson from '../../assets/robot_loading.json'; 

const ModelViewerWrapper = React.forwardRef<HTMLElement, any>((props, ref) => {
  return React.createElement('model-viewer', { ...props, ref });
});
ModelViewerWrapper.displayName = 'ModelViewerWrapper';

const categories = ['HG', 'RG', 'MG', 'PG', 'SD', 'ACCESSORY', 'TOOL', 'Khác'];

type ProductForm = {
  id?: string; sku: string; name: string; category: string; description: string;
  price: number; originalPrice: number; costPrice: number; stock: number; weight: number;
  images: string[]; imagesInput: string; imageUrl: string; model3DUrl: string;
  has3D: boolean; isActive: boolean; isFeatured: boolean; sold: number; rating?: number;
  createdAt?: number; updatedAt?: number;
};

type ReviewRecord = {
  id: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  content: string;
  rating: number;
  timestamp: number;
  mediaUrls?: string[];
};

const defaultFormData: ProductForm = {
  sku: '', name: '', category: 'HG', description: '', price: 0, originalPrice: 0, costPrice: 0,
  stock: 0, weight: 0, images: [], imagesInput: '', imageUrl: '', model3DUrl: '',
  has3D: false, isActive: true, isFeatured: false, sold: 0, rating: 0,
};

const FALLBACK_IMAGE = 'https://placehold.co/800x600/f8fafc/94a3b8?text=Image+Not+Found';
const RobotLoadingAnimation = () => {
  const options = {
    animationData: robotLoadingJson,
    loop: true,
    autoplay: true,
  };
  const { View } = useLottie(options);
  
  return (
    <div className="w-48 h-48 drop-shadow-xl flex items-center justify-center -scale-x-100">
      {View}
    </div>
  );
};
export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isCreateMode = !id || id === 'new';
  const goToProducts = () => navigate('/products', { replace: true });

  const [formData, setFormData] = useState<ProductForm | null>(null);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [reviewFilter, setReviewFilter] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'reviews'>('info');
  
  const [activeMedia, setActiveMedia] = useState<'2d' | '3d'>('2d');
  const [fullscreenMode, setFullscreenMode] = useState<'2d' | '3d' | null>(null);

  const modelViewerRef = useRef<HTMLElement | null>(null);
  const fullscreenModelViewerRef = useRef<HTMLElement | null>(null);
  const [modelLoadProgress, setModelLoadProgress] = useState(0);
  const [modelLoadState, setModelLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [modelViewerReady, setModelViewerReady] = useState(false);
  const [showLoadedBadge, setShowLoadedBadge] = useState(false);
  useEffect(() => {
    const fetchProduct = async () => {
      if (isCreateMode) { setFormData(defaultFormData); setReviews([]); setLoading(false); document.title = "Tạo sản phẩm mới - Gunpla Store"; return;}
      try {
        const docSnap = await getDoc(doc(db, 'products', id));
        if (!docSnap.exists()) { toast.error('Không tìm thấy sản phẩm'); goToProducts(); return; }
        const data = docSnap.data() as any;
        const existingImages = Array.isArray(data.images) ? data.images.filter(Boolean).map(String) : [];
        
        setFormData({
          id: docSnap.id, sku: String(data.sku || ''), name: String(data.name || ''), category: String(data.category || 'HG'),
          description: String(data.description || ''), price: Number(data.price || 0), originalPrice: Number(data.originalPrice || 0),
          costPrice: Number(data.costPrice || 0), stock: Number(data.stock || 0), weight: Number(data.weight || 0),
          images: existingImages, imagesInput: existingImages.join('\n'), imageUrl: String(data.imageUrl || existingImages[0] || ''),
          model3DUrl: String(data.model3DUrl || ''), has3D: Boolean(data.has3D), isActive: Boolean(data.isActive ?? true),
          isFeatured: Boolean(data.isFeatured), sold: Number(data.sold || 0), rating: Number(data.rating || 0),
          createdAt: Number(data.createdAt || Date.now()), updatedAt: Number(data.updatedAt || Date.now()),
        });

        const reviewsQuery = query(collection(db, 'products', id, 'reviews'), orderBy('timestamp', 'desc'));
        const reviewsSnap = await getDocs(reviewsQuery);
        const fetchedReviews = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReviewRecord));
        setReviews(fetchedReviews);

      } catch { toast.error('Lỗi tải dữ liệu'); } 
      finally { setLoading(false); }
    };
    fetchProduct();
  }, [id, navigate, isCreateMode]);

  const reviewStats = useMemo(() => {
    const total = reviews.length;
    if (total === 0) return { total: 0, average: 0, counts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    reviews.forEach(r => {
      const star = r.rating as 1|2|3|4|5;
      if (counts[star] !== undefined) counts[star]++;
      sum += r.rating;
    });
    return { total, average: (sum / total).toFixed(1), counts };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (reviewFilter === null) return reviews;
    return reviews.filter(r => r.rating === reviewFilter);
  }, [reviews, reviewFilter]);

  const handleFieldChange = <K extends keyof ProductForm>(field: K, value: ProductForm[K]) => { if (!formData) return; setFormData({ ...formData, [field]: value }); };
  const handleCurrencyChange = (field: 'price' | 'originalPrice' | 'costPrice', value: string) => { if (!formData) return; const rawValue = value.replace(/\D/g, ''); setFormData({ ...formData, [field]: Number(rawValue || 0) }); };
  const imageList = useMemo(() => { if (!formData) return []; return (formData.imagesInput || '').split(/[\n,]+/).map((url) => url.trim()).filter(url => url.length > 0); }, [formData?.imagesInput]);
  useEffect(() => { if (imageList.length > 0 && selectedImage > imageList.length - 1) setSelectedImage(0); }, [imageList, selectedImage]);

  const model3DUrl = formData?.model3DUrl || '';
  
  // 🌟 [LAZY LOADING FIX]: CHỈ THỰC SỰ KÍCH HOẠT KHI TAB ĐANG LÀ 3D
  const isInline3DActive = activeMedia === '3d' && !!model3DUrl && /\.(glb|gltf|usdz)(\?|#|$)/i.test(model3DUrl);

  useEffect(() => {
    // Nếu chưa bấm sang tab 3D, dọn dẹp sạch sẽ không load gì cả
    if (!isInline3DActive) {
      setModelLoadState('idle'); 
      setModelLoadProgress(0);
      setShowLoadedBadge(false);
      return;
    }

    if (customElements.get('model-viewer')) { 
      setModelViewerReady(true); 
      return; 
    }
    
    setModelLoadState('loading');
    const scriptId = 'google-model-viewer-script';
    let scriptEl = document.getElementById(scriptId) as HTMLScriptElement;
    const handleLoad = () => setModelViewerReady(true);
    const handleError = () => { setModelViewerReady(false); setModelLoadState('error'); };

    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = scriptId;
      scriptEl.type = 'module';
      scriptEl.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
      document.head.appendChild(scriptEl);
    }
    
    scriptEl.addEventListener('load', handleLoad);
    scriptEl.addEventListener('error', handleError);
    return () => { scriptEl.removeEventListener('load', handleLoad); scriptEl.removeEventListener('error', handleError); };
  }, [isInline3DActive, model3DUrl]);

  useEffect(() => {
    const el = modelViewerRef.current as any;
    // Bắt buộc phải có isInline3DActive mới cho phép bắt đầu gán sự kiện Loading
    if (!el || !isInline3DActive || !modelViewerReady) return;

    setModelLoadState('loading'); 
    setModelLoadProgress(0); 
    let fallbackTimeout: number;

    const onProgress = (event: Event) => {
      const detail = (event as CustomEvent<{ totalProgress?: number }>).detail;
      const percent = Math.floor((detail?.totalProgress || 0) * 100);
      setModelLoadProgress(prev => Math.max(prev, percent));
    };

    const markAsLoaded = () => { 
      setModelLoadProgress(100); 
      setModelLoadState('loaded'); 
      setShowLoadedBadge(true); 
    };
    
    const onError = () => { 
      setModelLoadState('error'); 
      toast.error('File 3D bị lỗi hoặc không tồn tại!'); 
    };

    el.addEventListener('progress', onProgress); 
    el.addEventListener('load', markAsLoaded); 
    el.addEventListener('error', onError);
    
    if (el.loaded) { 
      markAsLoaded(); 
    } else { 
      fallbackTimeout = window.setTimeout(() => { if (el.loaded) markAsLoaded(); }, 1500); 
    }

    return () => { 
      el.removeEventListener('progress', onProgress); 
      el.removeEventListener('load', markAsLoaded); 
      el.removeEventListener('error', onError); 
      clearTimeout(fallbackTimeout); 
    };
  }, [isInline3DActive, modelViewerReady, model3DUrl]);

  useEffect(() => {
    if (modelLoadState === 'loaded') {
      const timer = setTimeout(() => setShowLoadedBadge(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [modelLoadState]);

  const formatCurrency = (val: number) => (val === 0 ? '0' : new Intl.NumberFormat('vi-VN').format(val));
  const normalizeIntegerInput = (value: string) => value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const formatIntegerInput = (value: number) => String(Math.max(0, Math.trunc(Number(value) || 0)));
  const handleIntegerChange = (field: 'stock' | 'weight', value: string) => {
    if (!formData) return;
    const normalized = normalizeIntegerInput(value);
    setFormData({ ...formData, [field]: Number(normalized || 0) });
  };
  const goPrevImage = () => { if (imageList.length === 0) return; setSelectedImage((prev) => (prev - 1 + imageList.length) % imageList.length); };
  const goNextImage = () => { if (imageList.length === 0) return; setSelectedImage((prev) => (prev + 1) % imageList.length); };

  const handleSave = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData) return;
    const name = formData.name?.trim(); const sku = formData.sku?.trim().toUpperCase();
    if (!name) { toast.error('❌ Tên sản phẩm không được để trống!'); return; }
    if (!sku) { toast.error('❌ Mã SKU không được để trống!'); return; }
    if (/\s|\/|\\/.test(sku)) { toast.error('❌ Mã SKU không được chứa khoảng trắng, / hoặc \\.'); return; }
    
    setIsSaving(true);
    try {
      const productId = isCreateMode ? sku : String(formData.id || id || sku);
      const cleanData = {
        ...formData,
        id: productId,
        sku: sku,
        name: name,
        stock: Math.max(0, Math.trunc(Number(formData.stock) || 0)),
        weight: Math.max(0, Math.trunc(Number(formData.weight) || 0)),
        imageUrl: imageList[0] || '',
        images: imageList,
        has3D: !!formData.model3DUrl,
        updatedAt: Date.now(),
      };
      const { imagesInput, ...payload } = cleanData;

      const duplicateSkuQuery = query(collection(db, 'products'), where('sku', '==', cleanData.sku), limit(5));
      const duplicateSkuSnap = await getDocs(duplicateSkuQuery);
      const currentDocId = isCreateMode ? productId : id || productId;
      const hasDuplicateSku = duplicateSkuSnap.docs.some((item) => item.id !== currentDocId);
      if (hasDuplicateSku) { toast.error(`Mã SKU "${cleanData.sku}" đã tồn tại!`); setIsSaving(false); return; }

      await runTransaction(db, async (transaction) => {
        const targetProductRef = doc(db, 'products', currentDocId);
        const skuRef = doc(db, 'product_skus', cleanData.sku);
        const skuSnap = await transaction.get(skuRef);

        if (isCreateMode) {
          const productSnap = await transaction.get(targetProductRef);
          if (productSnap.exists() || skuSnap.exists()) throw new Error(`Mã SKU "${cleanData.sku}" đã tồn tại!`);
          transaction.set(targetProductRef, { ...payload, id: productId, rating: 0, createdAt: Date.now() });
          transaction.set(skuRef, { sku: cleanData.sku, productId, createdAt: Date.now(), updatedAt: Date.now() });
          return;
        }

        const productSnap = await transaction.get(targetProductRef);
        if (!productSnap.exists()) throw new Error('Sản phẩm không tồn tại.');
        const lockedProductId = skuSnap.exists() ? String(skuSnap.data().productId || '') : '';
        if (lockedProductId && lockedProductId !== targetProductRef.id) throw new Error(`Mã SKU "${cleanData.sku}" đã tồn tại!`);

        const oldSku = String(productSnap.data().sku || '').trim().toUpperCase();
        if (oldSku && oldSku !== cleanData.sku) transaction.delete(doc(db, 'product_skus', oldSku));
        transaction.update(targetProductRef, { ...payload, id: targetProductRef.id });
        transaction.set(skuRef, {
          sku: cleanData.sku,
          productId: targetProductRef.id,
          createdAt: skuSnap.exists() ? skuSnap.data().createdAt || Date.now() : Date.now(),
          updatedAt: Date.now(),
        });
      });

      toast.success(isCreateMode ? 'Tạo sản phẩm mới thành công!' : 'Cập nhật thành công!');
      goToProducts();
      return;
    } catch (err: any) { toast.error(`❌ Lỗi khi lưu: ${err.message}`); } finally { setIsSaving(false); }
  };

  if (loading) return <div className="min-h-screen p-16 text-center font-bold text-blue-600 animate-pulse">Đang tải dữ liệu sản phẩm Gunpla...</div>;
  if (!formData) return null;

  const marginAmount = formData.price - formData.costPrice;
  const marginPercent = formData.price > 0 ? Math.round((marginAmount / formData.price) * 100) : 0;
  const totalRevenue = (formData.sold || 0) * formData.price;
  
  const mainImage = imageList[selectedImage] || FALLBACK_IMAGE;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
             <button onClick={goToProducts} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600 transition-colors cursor-pointer shrink-0">
               <ChevronLeft className="w-5 h-5" />
             </button>
             <div className="min-w-0">
               <h1 className="text-xl font-black truncate">{formData.name || 'Sản phẩm mới'}</h1>
               <p className="text-xs text-slate-500 font-mono mt-0.5">SKU: {formData.sku || 'CHƯA_CÓ_MÃ'}</p>
             </div>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black shadow-lg shadow-blue-200 disabled:opacity-50 transition-all cursor-pointer shrink-0 whitespace-nowrap">
            {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 lg:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in-bottom-4 duration-300">
          
          <div className="xl:col-span-5 space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex p-1.5 bg-slate-50 rounded-2xl mb-5 border border-slate-100">
                  <button onClick={() => setActiveMedia('2d')} className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${activeMedia === '2d' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><ImageIcon className="w-4 h-4" /> ẢNH 2D</button>
                  
                  {/* LUÔN HIỆN NÚT NẾU CÓ MODEL URL */}
                  {formData.model3DUrl && (
                   <button onClick={() => setActiveMedia('3d')} className={`flex-1 py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${activeMedia === '3d' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Box className="w-4 h-4" /> CHẾ ĐỘ 3D
                    {activeMedia === '3d' && modelLoadState === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
                    {activeMedia === '3d' && modelLoadState === 'loaded' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {activeMedia === '3d' && modelLoadState === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                   </button>
                  )}
              </div>

              {activeMedia === '3d' && formData.model3DUrl ? (
                <div className="relative aspect-[4/3] rounded-2xl border border-slate-200 overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 group">
                  
                  {modelLoadState === 'loading' && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300">
                      
                      {/* 🌟 GỌI COMPONENT ROBOT VÀO ĐÂY */}
                      <RobotLoadingAnimation />

                      <div className="flex flex-col items-center gap-2">
                        <span className="text-[11px] font-black text-indigo-900 uppercase tracking-widest bg-white px-4 py-1.5 rounded-full shadow-sm border border-indigo-100">
                          Đang Dựng Hình 3D
                        </span>
                        
                        {/* THÊM `flex justify-start` VÀO THẺ NÀY ĐỂ ÉP NÓ MỌC TỪ BÊN TRÁI */}
                        <div className="w-48 h-2.5 rounded-full bg-slate-200/80 overflow-hidden border border-white shadow-inner flex justify-start">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300 rounded-full relative" 
                            style={{ width: `${Math.max(5, modelLoadProgress)}%` }} 
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-500">{modelLoadProgress}%</span>
                      </div>
                    </div>
                  )}

                  <ModelViewerWrapper 
                    ref={(node: any) => { modelViewerRef.current = node; }} 
                    src={formData.model3DUrl} 
                    ar="true"
                    exposure="1" 
                    style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }} 
                    {...{
                      "ar-modes": "webxr scene-viewer quick-look",
                      "auto-rotate": "true",
                      "rotation-per-second": "30deg",
                      "camera-controls": "true",
                      "touch-action": "pan-y",
                      "environment-image": "neutral",
                      "shadow-intensity": "1"
                    }}
                  />
                  
                  {showLoadedBadge && modelLoadState === 'loaded' && (
                    <div className="absolute left-3 bottom-3 rounded-xl bg-emerald-500/90 text-white px-4 py-2.5 text-xs font-bold backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-bottom-2">
                      <span className="flex items-center gap-2"><CheckCircle2 size={14} /> Sẵn sàng tương tác</span>
                    </div>
                  )}
                  {modelLoadState === 'error' && (
                     <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-20">
                        <div className="text-center text-red-500">
                           <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                           <p className="font-bold">Không thể tải File 3D</p>
                           <p className="text-xs text-slate-500 mt-1">Đường dẫn bị lỗi hoặc máy chủ từ chối kết nối</p>
                        </div>
                     </div>
                  )}

                  <button onClick={() => setFullscreenMode('3d')} className="absolute top-3 right-3 z-30 p-2 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-lg backdrop-blur-md shadow-xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer scale-90 group-hover:scale-100"><Maximize2 className="w-5 h-5" /></button>
                </div>
              ) : (
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 group flex items-center justify-center">
                  <img src={mainImage} alt="Product preview" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }} />
                  {imageList.length > 0 && (
                     <button onClick={() => setFullscreenMode('2d')} className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md shadow-xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer scale-90 group-hover:scale-100"><Maximize2 className="w-5 h-5" /></button>
                  )}
                </div>
              )}

              {activeMedia === '2d' && (
                 <div className="mt-4 flex items-center gap-2">
                    <button type="button" onClick={goPrevImage} disabled={imageList.length <= 1} className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-40 transition-colors cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="flex-1 flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                      {imageList.map((url, idx) => (
                        <button key={idx} onClick={() => setSelectedImage(idx)} className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 cursor-pointer ${selectedImage === idx ? 'border-blue-500 shadow-md shadow-blue-200' : 'border-transparent'} transition-all`}>
                          <img src={url || FALLBACK_IMAGE} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }} />
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={goNextImage} disabled={imageList.length <= 1} className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-40 transition-colors cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                 </div>
              )}
            </section>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl bg-blue-600 p-6 text-white shadow-lg shadow-blue-200">
                 <p className="text-[10px] uppercase font-black opacity-80 mb-1">Lãi gộp / Đơn</p>
                 <p className="text-3xl font-black">{formatCurrency(marginAmount)}₫</p>
                 <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-sm font-black text-white">{marginPercent}%<TrendingUp className="w-3.5 h-3.5 text-white/70" /></div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
                 <p className="text-[10px] uppercase font-black text-slate-400 mb-1">Dự phóng Doanh thu</p>
                 <p className="text-3xl font-black text-green-400">{formatCurrency(totalRevenue)}₫</p>
              </div>
            </div>
          </div>

          <div className="xl:col-span-7">
             <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-1">
                <div className="flex p-1.5 bg-slate-50 rounded-t-2xl border-b border-slate-100">
                  <button onClick={() => setActiveTab('info')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${activeTab === 'info' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Thông tin Cấu hình</button>
                  <button onClick={() => setActiveTab('reviews')} className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${activeTab === 'reviews' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Đánh giá ({reviewStats.total})</button>
                </div>

                <div key={activeTab} className="p-6 space-y-6 custom-scrollbar max-h-[1000px] overflow-y-auto animate-in fade-in slide-in-from-right-3 duration-300">
                  {activeTab === 'info' ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-2">Tên sản phẩm *</label><input value={formData.name} onChange={(e) => handleFieldChange('name', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-2">Mã SKU *</label><input value={formData.sku} onChange={(e) => handleFieldChange('sku', e.target.value.toUpperCase())} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-2">Phân loại</label><select value={formData.category} onChange={(e) => handleFieldChange('category', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold cursor-pointer">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-6">
                        <div><label className="block text-xs font-bold text-slate-500 mb-2">Giá bán (₫)</label><input value={formatCurrency(formData.price)} onChange={(e) => handleCurrencyChange('price', e.target.value)} className="w-full bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-black text-lg" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-2">Giá gốc (₫)</label><input value={formatCurrency(formData.originalPrice)} onChange={(e) => handleCurrencyChange('originalPrice', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-2">Giá vốn (₫)</label><input value={formatCurrency(formData.costPrice)} onChange={(e) => handleCurrencyChange('costPrice', e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-green-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500 font-bold" /></div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div><label className="block text-xs font-bold text-slate-500 mb-2">Tồn kho (Hộp)</label><input type="text" inputMode="numeric" value={formatIntegerInput(formData.stock)} onChange={(e) => handleIntegerChange('stock', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-black text-center" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-2">Đã bán <span className="text-[10px] font-normal italic text-slate-400">(Read-only)</span></label><input type="number" value={formData.sold} disabled className="w-full bg-slate-100 border border-slate-200 text-slate-400 rounded-xl px-4 py-3 outline-none font-bold text-center cursor-not-allowed" /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-2">Cân nặng (Gr)</label><input type="text" inputMode="numeric" value={formatIntegerInput(formData.weight)} onChange={(e) => handleIntegerChange('weight', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-center" /></div>
                      </div>

                      <div className="border-t border-slate-100 pt-6 space-y-4">
                         <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2 flex justify-between">
                               <span>Album ảnh</span>
                               <span className="text-[10px] text-blue-500 font-normal">Mỗi dòng 1 link. Dòng đầu làm Ảnh chính.</span>
                            </label>
                            <textarea rows={4} value={formData.imagesInput} onChange={(e) => handleFieldChange('imagesInput', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-xs font-mono resize-none leading-relaxed" placeholder="https://anh-1.jpg&#10;https://anh-2.jpg"></textarea>
                         </div>
                         <div><label className="block text-xs font-bold text-slate-500 mb-2">Link 3D Model (.glb)</label><input value={formData.model3DUrl} onChange={(e) => handleFieldChange('model3DUrl', e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm" placeholder="https://...model.glb" /></div>
                         <div><label className="block text-xs font-bold text-slate-500 mb-2">Bài viết giới thiệu</label><textarea rows={6} value={formData.description} onChange={(e) => handleFieldChange('description', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"></textarea></div>
                         
                         <div className="flex gap-4 pt-2">
                            <label className="flex-1 flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                               <span className="text-sm font-bold text-slate-700">Đang hiển thị bán</span>
                               <input type="checkbox" checked={formData.isActive} onChange={(e) => handleFieldChange('isActive', e.target.checked)} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                            </label>
                            <label className="flex-1 flex items-center justify-between p-4 rounded-xl border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors">
                               <span className="text-sm font-bold text-red-600">Sản phẩm HOT 🔥</span>
                               <input type="checkbox" checked={formData.isFeatured} onChange={(e) => handleFieldChange('isFeatured', e.target.checked)} className="w-5 h-5 accent-red-600 cursor-pointer" />
                            </label>
                         </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center">
                        <div className="flex flex-col items-center justify-center shrink-0">
                          <p className="text-5xl font-black text-amber-500">{reviewStats.average}</p>
                          <div className="flex items-center gap-1 mt-2 text-amber-500">
                            {[1, 2, 3, 4, 5].map(i => (
                               <Star key={i} className={`w-4 h-4 ${i <= Number(reviewStats.average) ? 'fill-current' : 'text-amber-200'}`} />
                            ))}
                          </div>
                          <p className="text-xs font-bold text-slate-500 mt-2">{reviewStats.total} đánh giá</p>
                        </div>
                        
                        <div className="flex-1 w-full space-y-2 border-l border-amber-200/50 pl-6">
                          {[5, 4, 3, 2, 1].map(star => {
                            const count = reviewStats.counts[star as 1|2|3|4|5];
                            const percent = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                            return (
                              <div key={star} className="flex items-center gap-3 text-xs font-bold text-slate-600">
                                <span className="w-10 flex items-center gap-1">{star} <Star className="w-3 h-3 text-amber-500 fill-current" /></span>
                                <div className="flex-1 h-2 bg-amber-200/40 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                                <span className="w-8 text-right">{count}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap border-b border-slate-100 pb-4">
                         <button onClick={() => setReviewFilter(null)} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${reviewFilter === null ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Tất cả</button>
                         {[5, 4, 3, 2, 1].map(star => (
                           <button key={star} onClick={() => setReviewFilter(star)} className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${reviewFilter === star ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                             {star} <Star className={`w-3.5 h-3.5 ${reviewFilter === star ? 'fill-current' : 'text-amber-500 fill-current'}`} />
                           </button>
                         ))}
                      </div>

                      <div className="space-y-4">
                        {filteredReviews.length === 0 ? (
                          <div className="text-center py-10 text-slate-400">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="font-bold">Chưa có đánh giá nào</p>
                          </div>
                        ) : (
                          filteredReviews.map(review => (
                            <div key={review.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <img src={review.avatarUrl || FALLBACK_IMAGE} alt="avatar" className="w-10 h-10 rounded-full bg-slate-200 object-cover" onError={(e) => e.currentTarget.src = FALLBACK_IMAGE} />
                                  <div>
                                    <p className="text-sm font-bold text-slate-800">{review.userName || 'Khách hàng'}</p>
                                    <div className="flex items-center gap-0.5 text-amber-500 mt-0.5">
                                      {Array(5).fill(0).map((_, i) => (
                                        <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-slate-300'}`} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-xs font-medium text-slate-400">
                                  {new Date(review.timestamp).toLocaleDateString('vi-VN')}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{review.content}</p>
                              
                              {review.mediaUrls && review.mediaUrls.length > 0 && (
                                <div className="flex gap-2 mt-3 overflow-x-auto custom-scrollbar pb-2">
                                  {review.mediaUrls.map((url, idx) => (
                                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="shrink-0">
                                      <img src={url || FALLBACK_IMAGE} alt="Review attachment" className="w-16 h-16 object-cover rounded-lg border border-slate-200" onError={(e) => e.currentTarget.src = FALLBACK_IMAGE} />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      </div>

      {fullscreenMode && (
        <div className="fixed inset-0 z-[9999] bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#030712_100%)] backdrop-blur-2xl flex flex-col animate-in zoom-in-95 duration-200">
           <button 
             onClick={() => setFullscreenMode(null)} 
             className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-red-500 text-white rounded-full transition-all duration-300 cursor-pointer shadow-2xl hover:scale-110 hover:rotate-90"
           >
              <X className="w-8 h-8" />
           </button>
           <div className="absolute inset-0 w-full h-full z-10 flex items-center justify-center outline-none">
              {fullscreenMode === '2d' && (
                 <img src={mainImage} className="w-full h-full object-contain p-8 drop-shadow-[0_0_100px_rgba(255,255,255,0.1)]" onError={(e) => { e.currentTarget.src = FALLBACK_IMAGE; }} />
              )}
              {fullscreenMode === '3d' && (
                 <div className="w-full h-full cursor-move">
                    <ModelViewerWrapper 
                      ref={(node: any) => { fullscreenModelViewerRef.current = node; }} 
                      src={formData.model3DUrl} 
                      ar="true"
                      exposure="1.2" 
                      style={{ width: '100%', height: '100%', backgroundColor: 'transparent', outline: 'none' }}
                      {...{
                        "ar-modes": "webxr scene-viewer quick-look",
                        "auto-rotate": "true",
                        "rotation-per-second": "30deg",
                        "camera-controls": "true",
                        "touch-action": "pan-y",
                        "environment-image": "neutral",
                        "shadow-intensity": "2"
                      }}
                    />
                 </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
