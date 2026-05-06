import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Smartphone, Plus, Trash2, ChevronLeft, ChevronRight, Loader2, Link as LinkIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { db } from '../../firebase'; 
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

type Banner = {
  id: string;
  imageUrl: string;
  headline: string;
  subHeadline: string;
  targetId: string;
  isActive: boolean;
  priority: number;
};

export default function BannerManagerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // 🌟 LẤY DỮ LIỆU TỪ FIREBASE KHI MỞ MODAL
  useEffect(() => {
    if (!isOpen) return;

    const fetchBanners = async () => {
      setIsFetching(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'banners'));
        const fetchedBanners: Banner[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedBanners.push({
            id: doc.id,
            imageUrl: data.imageUrl || '',
            headline: data.headline || '',
            subHeadline: data.subHeadline || '',
            targetId: data.targetId || '',
            isActive: data.isActive !== false,
            priority: data.priority || 0,
          });
        });

        // Sắp xếp theo thứ tự priority
        fetchedBanners.sort((a, b) => a.priority - b.priority);

        if (fetchedBanners.length > 0) {
          setBanners(fetchedBanners);
        } else {
          // Nếu database rỗng, tạo sẵn 1 cái trống
          setBanners([{
            id: 'temp_1',
            imageUrl: '',
            headline: 'TIÊU ĐỀ',
            subHeadline: 'Mô tả',
            targetId: '',
            isActive: true,
            priority: 1
          }]);
        }
        setCurrentIndex(0);
      } catch (error) {
        console.error("Lỗi lấy dữ liệu banner:", error);
        toast.error("Không thể tải danh sách Banner từ máy chủ.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchBanners();
  }, [isOpen]);

  const currentBanner = banners[currentIndex] || { imageUrl: '', headline: '', subHeadline: '', targetId: '' };

  if (!isOpen) return null;

  // HÀM XỬ LÝ: Cập nhật dữ liệu cho banner hiện tại
  const updateCurrentBanner = (field: keyof Banner, value: string | boolean) => {
    const updatedBanners = [...banners];
    updatedBanners[currentIndex] = { ...updatedBanners[currentIndex], [field]: value };
    setBanners(updatedBanners);
  };

  // HÀM XỬ LÝ: Thêm banner mới
  const handleAddBanner = () => {
    const newBanner: Banner = {
      id: `new_${Date.now()}`, // Đánh dấu là banner mới
      imageUrl: '',
      headline: 'TIÊU ĐỀ MỚI',
      subHeadline: 'Mô tả ngắn',
      targetId: '',
      isActive: true,
      priority: banners.length + 1
    };
    setBanners([...banners, newBanner]);
    setCurrentIndex(banners.length);
  };

  // HÀM XỬ LÝ: Xóa banner hiện tại
  const handleDeleteBanner = () => {
    if (banners.length <= 1) {
      toast.error("Phải có ít nhất 1 banner trên trang chủ!");
      return;
    }
    const filtered = banners.filter((_, index) => index !== currentIndex);
    // Cập nhật lại priority
    const reordered = filtered.map((b, idx) => ({ ...b, priority: idx + 1 }));
    setBanners(reordered);
    
    if (currentIndex >= reordered.length) {
      setCurrentIndex(reordered.length - 1);
    }
  };

  // 🌟 HÀM XỬ LÝ: LƯU LÊN FIREBASE (DÙNG BATCH ĐỂ LƯU NHANH)
  const handleSaveToFirebase = async () => {
    // Validate cơ bản
    const invalidBanner = banners.find(b => !b.imageUrl.trim());
    if (invalidBanner) {
      toast.error("Vui lòng điền Link Ảnh cho tất cả Banner trước khi lưu.");
      return;
    }

    setIsLoading(true);
    try {
      const bannerCollection = collection(db, 'banners');
      
      // 1. Xóa toàn bộ banner cũ (để xử lý việc admin xóa banner hoặc đổi thứ tự)
      const existingDocs = await getDocs(bannerCollection);
      const batch = writeBatch(db);
      existingDocs.forEach((document) => {
        batch.delete(document.ref);
      });

      // 2. Ghi đè danh sách banner mới
      banners.forEach((banner, index) => {
        // Bỏ ID tạm thời, để Firestore tự sinh ID mới
        const { id, ...dataToSave } = banner; 
        const newDocRef = doc(bannerCollection);
        batch.set(newDocRef, {
          ...dataToSave,
          priority: index + 1 // Cập nhật lại priority chắc chắn đúng thứ tự
        });
      });

      // Thực thi batch
      await batch.commit();
      
      toast.success(`Đã cập nhật ${banners.length} Banner lên App Mobile!`);
      onClose();
    } catch (error) {
      console.error("Lỗi lưu banner:", error);
      toast.error("Lỗi khi lưu dữ liệu. Vui lòng kiểm tra kết nối mạng.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
        {/* THÀNH: */}
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-300">        
        {/* NỬA TRÁI: FORM NHẬP LIỆU & ĐIỀU HƯỚNG */}
        <div className="w-full md:w-1/2 p-8 border-r border-slate-100 flex flex-col relative">
          
          {/* Overlay Loading khi đang Fetch dữ liệu lần đầu */}
          {isFetching && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="mt-2 text-sm font-bold text-slate-500">Đang tải dữ liệu...</p>
            </div>
          )}

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Quản lý Banner</h2>
            <button 
              onClick={onClose} 
              disabled={isLoading}
              className="p-2 bg-slate-100 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* THANH ĐIỀU HƯỚNG CÁC BANNER */}
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200 mb-6">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0 || isLoading}
                className="p-1.5 bg-white rounded-lg border border-slate-200 disabled:opacity-50 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-slate-700 min-w-[80px] text-center">
                Ảnh {currentIndex + 1} / {banners.length}
              </span>
              <button 
                onClick={() => setCurrentIndex(prev => Math.min(banners.length - 1, prev + 1))}
                disabled={currentIndex === banners.length - 1 || isLoading}
                className="p-1.5 bg-white rounded-lg border border-slate-200 disabled:opacity-50 hover:bg-slate-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleDeleteBanner}
                disabled={isLoading}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors tooltip-trigger disabled:opacity-50"
                title="Xóa banner này"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button 
                onClick={handleAddBanner}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Thêm
              </button>
            </div>
          </div>

          {/* CÁC INPUT DÀNH CHO BANNER ĐANG ĐƯỢC CHỌN */}
          <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Link ảnh (URL) <span className="text-red-500">*</span></label>
              <div className="relative">
                <ImageIcon className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  value={currentBanner.imageUrl}
                  onChange={(e) => updateCurrentBanner('imageUrl', e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm disabled:opacity-60"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tiêu đề chính</label>
                <input 
                  type="text" 
                  value={currentBanner.headline}
                  onChange={(e) => updateCurrentBanner('headline', e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-slate-800 text-sm disabled:opacity-60"
                  placeholder="Ví dụ: SALE 50%"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Phụ đề</label>
                <input 
                  type="text" 
                  value={currentBanner.subHeadline}
                  onChange={(e) => updateCurrentBanner('subHeadline', e.target.value)}
                  disabled={isLoading}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-slate-600 text-sm disabled:opacity-60"
                  placeholder="Chi tiết chương trình"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ID Sản phẩm (Khi khách bấm vào)</label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                <input 
                  type="text" 
                  value={currentBanner.targetId}
                  onChange={(e) => updateCurrentBanner('targetId', e.target.value)}
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                  placeholder="Nhập ID con Gundam (Không bắt buộc)"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
               <div>
                 <p className="font-bold text-slate-800 text-sm">Trạng thái hiển thị</p>
                 <p className="text-xs text-slate-500 mt-0.5">Cho phép banner này xuất hiện trên App Mobile</p>
               </div>
               <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={currentBanner.isActive !== false} // Mặc định là true
                    onChange={(e) => updateCurrentBanner('isActive', e.target.checked)}
                    disabled={isLoading}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
               </label>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button 
              onClick={onClose} 
              disabled={isLoading}
              className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button 
              onClick={handleSaveToFirebase}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Lưu lên App'
              )}
            </button>
          </div>
        </div>

        {/* NỬA PHẢI: LIVE PREVIEW GIẢ LẬP ĐIỆN THOẠI */}
        <div className="w-full md:w-1/2 bg-slate-50 p-8 flex flex-col items-center justify-center relative border-l border-slate-200/50">
          <div className="absolute top-4 left-4 flex items-center gap-2 text-slate-400 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
            <Smartphone className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Preview</span>
          </div>

          <div className={`w-full max-w-[320px] rounded-[2rem] overflow-hidden shadow-2xl relative bg-white border-[8px] border-slate-800 ring-4 ring-slate-100 transition-opacity duration-300 ${currentBanner.isActive === false ? 'opacity-50 grayscale' : 'opacity-100'}`}>
            
            <div className="absolute top-0 inset-x-0 h-4 bg-slate-800 rounded-b-xl w-32 mx-auto z-20"></div>

            <div className="aspect-[2/1] relative group mt-8 mx-4 mb-4 rounded-xl overflow-hidden shadow-md">
              <img 
                src={currentBanner.imageUrl} 
                alt="Preview" 
                className="w-full h-full object-cover bg-slate-200"
                onError={(e) => (e.currentTarget.src = 'https://placehold.co/600x300/e2e8f0/475569?text=Chưa+có+ảnh')}
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              <div className="absolute bottom-0 left-0 p-3">
                <h3 className="text-white font-black text-lg leading-tight uppercase drop-shadow-md line-clamp-2">
                  {currentBanner.headline || 'NHẬP TIÊU ĐỀ'}
                </h3>
                {currentBanner.subHeadline && (
                  <p className="text-white/90 font-medium text-xs mt-1 drop-shadow-md line-clamp-1">
                    {currentBanner.subHeadline}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex justify-center gap-1.5 pb-6">
               {banners.map((_, idx) => (
                 <div key={idx} className={`h-1.5 rounded-full ${idx === currentIndex ? 'w-4 bg-slate-800' : 'w-1.5 bg-slate-300'}`} />
               ))}
            </div>
          </div>
          <p className="mt-6 text-xs text-slate-400 font-medium text-center max-w-xs">
            {currentBanner.isActive === false 
              ? <span className="text-red-500 font-bold">Banner này đang bị TẮT, sẽ không hiện trên App.</span>
              : "Admin có thể thêm nhiều ảnh. Ứng dụng di động sẽ tự động tạo Carousel trượt qua lại."
            }
          </p>
        </div>

      </div>
    </div>
  );
}