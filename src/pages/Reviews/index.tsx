import { useEffect, useMemo, useState } from 'react';
import { collectionGroup, getDocs, orderBy, query, limit, updateDoc, doc, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  Star, Search, MessageSquare, Reply, CheckCircle2, AlertCircle, Clock, Image as ImageIcon, Filter,ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

// ============= Types =============
type ReviewRecord = {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  avatarUrl: string;
  content: string;
  rating: number;
  timestamp: number;
  mediaUrls?: string[];
  adminReply?: string;
  replyTimestamp?: number;
};

type ProductInfo = {
  name: string;
  imageUrl: string;
};

// ============= Main Component =============
export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, ProductInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  // States cho Bộ lọc
  const [filterStar, setFilterStar] = useState<number | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNREPLIED' | 'REPLIED'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');

  // States cho Trả lời
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  useEffect(() => {
    document.title = "Quản lý Đánh giá - Gunpla Store";
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Lấy danh sách sản phẩm để map Tên và Ảnh
      const productsSnap = await getDocs(collection(db, 'products'));
      const pMap: Record<string, ProductInfo> = {};
      productsSnap.forEach(doc => {
        const data = doc.data();
        pMap[doc.id] = { name: data.name || 'Sản phẩm không rõ', imageUrl: data.imageUrl || '' };
      });
      setProductsMap(pMap);

      // 2. Lấy 200 đánh giá mới nhất trên toàn hệ thống
      // LƯU Ý: Phải tạo Index cho collectionGroup 'reviews' với 'timestamp' DESC trên Firebase
      const q = query(collectionGroup(db, 'reviews'), orderBy('timestamp', 'desc'), limit(200));
      const snapshot = await getDocs(q);
      
      const fetchedReviews: ReviewRecord[] = [];
      snapshot.forEach(doc => {
        fetchedReviews.push({ id: doc.id, ...doc.data() } as ReviewRecord);
      });
      
      setReviews(fetchedReviews);
    } catch (error: any) {
      console.error(error);
      toast.error('Lỗi tải dữ liệu đánh giá! Vui lòng kiểm tra Index trên Firebase.');
    } finally {
      setIsLoading(false);
    }
  };

  // ========== Lọc Dữ Liệu trên RAM ==========
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      // Lọc theo Sao
      if (filterStar !== 'ALL' && r.rating !== filterStar) return false;
      // Lọc theo Trạng thái Rep
      if (filterStatus === 'UNREPLIED' && r.adminReply) return false;
      if (filterStatus === 'REPLIED' && !r.adminReply) return false;
      // Lọc theo Từ khóa (Tên khách, nội dung)
      if (searchKeyword) {
        const kw = searchKeyword.toLowerCase();
        const matchName = r.userName.toLowerCase().includes(kw);
        const matchContent = r.content.toLowerCase().includes(kw);
        if (!matchName && !matchContent) return false;
      }
      return true;
    });
  }, [reviews, filterStar, filterStatus, searchKeyword]);

  // ========== Xử lý Trả lời (Reply) ==========
  const handleReplySubmit = async (review: ReviewRecord) => {
    if (!replyText.trim()) {
      toast.error('Vui lòng nhập nội dung trả lời!');
      return;
    }
    
    if (!review.productId) {
      toast.error('Lỗi: Không xác định được sản phẩm của đánh giá này.');
      return;
    }

    setIsSubmitting(true);
    try {
      const reviewRef = doc(db, 'products', review.productId, 'reviews', review.id);
      const replyData = {
        adminReply: replyText.trim(),
        replyTimestamp: Date.now()
      };
      
      await updateDoc(reviewRef, replyData);
      
      // Update local state để UI phản hồi ngay lập tức
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, ...replyData } : r));
      setReplyingId(null);
      setReplyText('');
      toast.success('Gửi phản hồi thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi gửi phản hồi!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <Star key={star} className={`w-4 h-4 ${star <= rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`} />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <div className="p-10 text-center font-bold text-blue-600 animate-pulse">Đang tải danh sách Đánh giá...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER & THỐNG KÊ */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Quản lý Đánh giá</h1>
            <p className="mt-1 text-sm text-slate-600 font-medium">Theo dõi và phản hồi đánh giá của khách hàng</p>
          </div>
          <div className="flex items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
             <div className="text-center px-4 border-r border-slate-200">
               <p className="text-2xl font-black text-amber-500">{reviews.length}</p>
               <p className="text-xs font-bold text-slate-500 uppercase">Tổng số</p>
             </div>
             <div className="text-center px-4">
               <p className="text-2xl font-black text-rose-500">{reviews.filter(r => !r.adminReply).length}</p>
               <p className="text-xs font-bold text-slate-500 uppercase">Chưa phản hồi</p>
             </div>
          </div>
        </div>

        {/* BỘ LỌC (FILTERS) */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-4">
           <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                  type="text" placeholder="Tìm theo tên khách hàng hoặc nội dung..." 
                  value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {/* 🌟 CUSTOM DROPDOWN SIÊU ĐẸP */}
              <div className="relative min-w-[180px]">
                 <button 
                   onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                   className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors outline-none"
                 >
                    <div className="flex items-center gap-2">
                       <Filter className="text-slate-400 w-4 h-4" />
                       <span>
                         {filterStatus === 'ALL' ? 'Tất cả trạng thái' : filterStatus === 'UNREPLIED' ? 'Chưa phản hồi' : 'Đã phản hồi'}
                       </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                 </button>

                 {/* Menu xổ xuống */}
                 {isDropdownOpen && (
                   <>
                     {/* Lớp phủ tàng hình để click ra ngoài thì đóng menu */}
                     <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                     
                     <div className="absolute top-full right-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <button 
                          onClick={() => { setFilterStatus('ALL'); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-50 ${filterStatus === 'ALL' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}
                        >
                          Tất cả trạng thái
                        </button>
                        <button 
                          onClick={() => { setFilterStatus('UNREPLIED'); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-50 border-t border-slate-100 ${filterStatus === 'UNREPLIED' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}
                        >
                          Chưa phản hồi
                        </button>
                        <button 
                          onClick={() => { setFilterStatus('REPLIED'); setIsDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors hover:bg-slate-50 border-t border-slate-100 ${filterStatus === 'REPLIED' ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'}`}
                        >
                          Đã phản hồi
                        </button>
                     </div>
                   </>
                 )}
              </div>
           </div>

           <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setFilterStar('ALL')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${filterStar === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Tất cả Sao</button>
              {[5, 4, 3, 2, 1].map(star => (
                <button key={star} onClick={() => setFilterStar(star)} className={`flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${filterStar === star ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  {star} <Star className={`w-3.5 h-3.5 ${filterStar === star ? 'fill-amber-500 text-amber-500' : 'fill-slate-300 text-slate-300'}`} />
                </button>
              ))}
           </div>
        </div>

        {/* DANH SÁCH ĐÁNH GIÁ */}
        <div className="space-y-4">
          {filteredReviews.length === 0 ? (
             <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm">
                <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-black text-slate-700">Không tìm thấy đánh giá nào</h3>
                <p className="text-slate-500 text-sm mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
             </div>
          ) : (
            filteredReviews.map(review => {
              const product = productsMap[review.productId];
              const isBadReview = review.rating <= 3;
              
              return (
                <div key={review.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-6 hover:shadow-md transition-shadow">
                   
                   {/* Cột trái: Khách hàng & Nội dung */}
                   <div className="flex-1 space-y-4">
                      <div className="flex items-start justify-between">
                         <div className="flex items-center gap-3">
                            <img src={review.avatarUrl || 'https://placehold.co/100x100?text=User'} alt="avatar" className="w-12 h-12 rounded-full border border-slate-200 object-cover" />
                            <div>
                               <p className="font-bold text-slate-900">{review.userName || 'Khách hàng'}</p>
                               <div className="flex items-center gap-2 mt-1">
                                  {renderStars(review.rating)}
                                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3"/> {dayjs(review.timestamp).format('HH:mm DD/MM/YYYY')}</span>
                               </div>
                            </div>
                         </div>
                         {isBadReview && !review.adminReply && (
                            <span className="flex items-center gap-1 bg-rose-50 text-rose-600 px-2.5 py-1 rounded-md text-[10px] font-black uppercase"><AlertCircle className="w-3 h-3"/> Chú ý</span>
                         )}
                      </div>

                      <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{review.content || <span className="italic text-slate-400">Khách không để lại nội dung</span>}</p>

                      {review.mediaUrls && review.mediaUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                           {review.mediaUrls.map((url, idx) => (
                             <a key={idx} href={url} target="_blank" rel="noreferrer" className="relative group rounded-lg overflow-hidden border border-slate-200 block w-16 h-16 cursor-zoom-in">
                               <img src={url} alt="Review img" className="w-full h-full object-cover" />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ImageIcon className="w-4 h-4 text-white" /></div>
                             </a>
                           ))}
                        </div>
                      )}
                   </div>

                   {/* Cột phải: Sản phẩm & Trả lời */}
                   <div className="lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6 flex flex-col gap-4">
                      
                      {/* Box Sản phẩm */}
                      <a href={`/products/${review.productId}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors">
                         <img src={product?.imageUrl || 'https://placehold.co/100x100?text=Product'} className="w-10 h-10 rounded-lg object-cover bg-white border border-slate-200" alt="Product" />
                         <p className="text-xs font-bold text-slate-700 line-clamp-2">{product?.name || 'Sản phẩm đã bị xóa'}</p>
                      </a>

                      {/* Box Trả lời */}
                      <div className="flex-1 flex flex-col">
                        {review.adminReply ? (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex-1">
                             <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-black text-emerald-700 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Shop phản hồi</p>
                                <span className="text-[10px] font-semibold text-emerald-600/70">{dayjs(review.replyTimestamp).format('DD/MM/YYYY')}</span>
                             </div>
                             <p className="text-xs text-emerald-900 leading-relaxed whitespace-pre-wrap">{review.adminReply}</p>
                          </div>
                        ) : (
                          replyingId === review.id ? (
                            <div className="flex-1 flex flex-col gap-2">
                               <textarea 
                                 autoFocus value={replyText} onChange={e => setReplyText(e.target.value)}
                                 placeholder="Nhập nội dung phản hồi khách hàng..."
                                 className="w-full flex-1 min-h-[80px] text-xs p-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                               />
                               <div className="flex gap-2">
                                  <button onClick={() => setReplyingId(null)} className="flex-1 py-2 rounded-lg text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">Hủy</button>
                                  <button onClick={() => handleReplySubmit(review)} disabled={isSubmitting} className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50">Gửi</button>
                               </div>
                            </div>
                          ) : (
                            <button onClick={() => { setReplyingId(review.id); setReplyText(''); }} className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs font-bold hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center gap-1.5 mt-auto">
                               <Reply className="w-4 h-4" /> Phản hồi khách hàng
                            </button>
                          )
                        )}
                      </div>
                   </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}