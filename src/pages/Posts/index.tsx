import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  EyeOff,
  Image as ImageIcon,
  ChevronDown,
  MessageCircle,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, writeBatch } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { db } from '../../firebase';

dayjs.extend(relativeTime);
dayjs.locale('vi');

type PostStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
type PostTab = 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN' | 'ALL';
type GradeFilter = 'ALL' | 'HG' | 'RG' | 'MG' | 'PG' | 'SD' | 'MB' | 'OTHER';
type ConditionFilter = 'ALL' | 'NEW' | 'LIKE NEW' | 'USED' | 'JUNK';

type PostRecord = {
  id: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  title?: string;
  content?: string;
  price?: number;
  images?: string[];
  condition?: string;
  grade?: string;
  status?: PostStatus;
  rejectionReason?: string;
  createdAt?: number;
  processedAt?: number;
};

const PAGE_SIZE = 9;

const tabs: Array<{ id: PostTab; label: string }> = [
  { id: 'PENDING', label: 'Chờ duyệt' },
  { id: 'APPROVED', label: 'Đã đăng' },
  { id: 'REJECTED', label: 'Bị từ chối' },
  { id: 'HIDDEN', label: 'Đã ẩn' },
  { id: 'ALL', label: 'Tất cả' },
];

const GRADES = ['Tất cả Grade', 'HG', 'RG', 'MG', 'PG', 'SD', 'MB', 'OTHER'] as const;
const CONDITIONS = ['Tất cả tình trạng', 'NEW', 'LIKE NEW', 'USED', 'JUNK'] as const;

const formatMoney = (value?: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Number(value || 0)
  );

const contentClampStyle: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const statusMeta: Record<PostStatus, { label: string; className: string }> = {
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' },
  APPROVED: { label: 'Đã đăng', className: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' },
  REJECTED: { label: 'Từ chối', className: 'bg-rose-100 text-rose-700 ring-1 ring-rose-200' },
  HIDDEN: { label: 'Đã ẩn', className: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' },
};

const normalizePostStatus = (value?: string): PostStatus => {
  const status = String(value || '').toUpperCase();
  if (status === 'APPROVED' || status === 'REJECTED' || status === 'HIDDEN') return status;
  return 'PENDING';
};

const normalizeGrade = (value?: string) => {
  const grade = String(value || 'OTHER').trim().toUpperCase();
  return ['HG', 'RG', 'MG', 'PG', 'SD', 'MB'].includes(grade) ? grade : 'OTHER';
};

const normalizeCondition = (value?: string) => {
  const condition = String(value || 'USED').trim().toUpperCase();
  return condition === 'NEW' || condition === 'LIKE NEW' || condition === 'USED' || condition === 'JUNK'
    ? condition
    : 'USED';
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMillis = (value: any, fallback = Date.now()) => {
  if (!value) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPostImages = (raw: any) => {
  const candidates = raw.images || raw.imageUrls || raw.photoUrls || raw.photos;
  if (Array.isArray(candidates)) return candidates.map((image) => String(image || '').trim()).filter(Boolean);
  const singleImage = String(raw.imageUrl || raw.thumbnailUrl || '').trim();
  return singleImage ? [singleImage] : [];
};

function ImagePreviewModal({
  open,
  images,
  initialIndex,
  onClose,
}: {
  open: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (event.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      } else if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, images.length, onClose]);

  if (!open || !images.length) return null;

  const currentImage = images[currentIndex];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white grid place-items-center transition-all duration-200"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <div className="absolute top-6 left-6 bg-black/40 px-4 py-2 rounded-full text-white text-sm font-semibold text-shadow">
            {currentIndex + 1} / {images.length}
          </div>

          <motion.img
            key={currentIndex}
            src={currentImage}
            alt={`Image ${currentIndex + 1}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[85vh] max-w-[95vw] object-contain rounded-xl shadow-2xl"
          />

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/30 text-white grid place-items-center transition-all duration-200"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 hover:bg-white/30 text-white grid place-items-center transition-all duration-200"
                aria-label="Next image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PostImageGrid({
  images,
  title,
  onPreview,
}: {
  images: string[];
  title: string;
  onPreview: (index: number) => void;
}) {
  if (!images.length) {
    return (
      <div className="w-full aspect-video rounded-xl bg-slate-100 border border-slate-200 grid place-items-center text-slate-400">
        <div className="text-center">
          <ImageIcon className="w-6 h-6 mx-auto mb-1" />
          <p className="text-xs font-semibold">Không có ảnh</p>
        </div>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="overflow-hidden rounded-xl group bg-slate-100">
        <button
          type="button"
          onClick={() => onPreview(0)}
          className="relative w-full aspect-video cursor-pointer"
        >
          <img
            src={images[0]}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </button>
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden">
        {images.map((image, index) => (
          <div key={index} className="overflow-hidden group bg-slate-100">
            <button
              type="button"
              onClick={() => onPreview(index)}
              className="relative w-full aspect-square cursor-pointer"
            >
              <img
                src={image}
                alt={`${title} ${index + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden h-[200px]">
        <div className="overflow-hidden group bg-slate-100 row-span-2">
          <button
            type="button"
            onClick={() => onPreview(0)}
            className="relative w-full h-full cursor-pointer"
          >
            <img
              src={images[0]}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </button>
        </div>

        {images.slice(1).map((image, index) => (
          <div key={index + 1} className="overflow-hidden group bg-slate-100">
            <button
              type="button"
              onClick={() => onPreview(index + 1)}
              className="relative w-full h-full cursor-pointer"
            >
              <img
                src={image}
                alt={`${title} ${index + 2}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden h-[200px]">
      <div className="overflow-hidden group bg-slate-100 row-span-2">
        <button
          type="button"
          onClick={() => onPreview(0)}
          className="relative w-full h-full cursor-pointer"
        >
          <img
            src={images[0]}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </button>
      </div>

      <div className="overflow-hidden group bg-slate-100">
        <button
          type="button"
          onClick={() => onPreview(1)}
          className="relative w-full h-full cursor-pointer"
        >
          <img
            src={images[1]}
            alt={`${title} 2`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </button>
      </div>

      <div className="overflow-hidden group bg-slate-100 relative">
        <button
          type="button"
          onClick={() => onPreview(2)}
          className="relative w-full h-full cursor-pointer"
        >
          <img
            src={images[2]}
            alt={`${title} 3`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {images.length > 3 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">+{images.length - 3}</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

function RejectDialog({
  open,
  post,
  reason,
  setReason,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  post: PostRecord | null;
  reason: string;
  setReason: (value: string) => void;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-[65] bg-black/45 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-900">Từ chối bài đăng</h3>
          <p className="text-sm text-slate-500 mt-1">Vui lòng nhập lý do để người dùng hiểu tại sao bài bị từ chối.</p>
        </div>

        <div className="p-5 space-y-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-sm font-bold text-slate-800">{post.title || 'Bài đăng không tiêu đề'}</p>
            <p className="text-xs text-slate-500 mt-1">Người đăng: {post.userName || 'Người dùng ẩn danh'}</p>
          </div>

          <label className="space-y-1 block">
            <span className="text-sm font-semibold text-slate-700">Lý do từ chối</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ví dụ: Nội dung chưa rõ ràng, ảnh không hợp lệ, giá sai định dạng..."
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
            />
          </label>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={isSubmitting || !reason.trim()}
            className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-60"
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PostsPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [activeTab, setActiveTab] = useState<PostTab>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('ALL');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingPost, setRejectingPost] = useState<PostRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const deferredSearchKeyword = useDeferredValue(searchKeyword.trim().toLowerCase());
  useEffect(() => {
    document.title = "Quản lý Bài Viết - Gunpla Store";
  }, []);
  useEffect(() => {
    setIsLoading(true);
    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const data: PostRecord[] = snapshot.docs.map((item) => {
          const raw = item.data() as any;
          return {
            id: item.id,
            userId: raw.userId ? String(raw.userId) : undefined,
            userName: String(raw.userName || raw.authorName || raw.displayName || 'Người dùng ẩn danh'),
            userAvatar: String(raw.userAvatar || raw.authorAvatar || raw.avatarUrl || ''),
            title: String(raw.title || raw.name || ''),
            content: String(raw.content || raw.description || ''),
            price: toNumber(raw.price),
            images: getPostImages(raw),
            condition: normalizeCondition(raw.condition),
            grade: normalizeGrade(raw.grade),
            status: normalizePostStatus(raw.status),
            rejectionReason: String(raw.rejectionReason || ''),
            createdAt: toMillis(raw.createdAt),
            processedAt: toMillis(raw.processedAt, 0),
          };
        });

        setPosts(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error loading posts:', error);
        toast.error('Không thể tải danh sách bài đăng.');
        setIsLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const normalizedPosts = useMemo(() => {
    return posts.map((post) => ({
      ...post,
      _searchText: [post.title, post.content, post.userName, post.grade, post.condition]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return normalizedPosts.filter((post) => {
      if (activeTab !== 'ALL' && post.status !== activeTab) return false;
      if (gradeFilter !== 'ALL' && (post.grade || 'N/A') !== gradeFilter) return false;
      if (conditionFilter !== 'ALL' && (post.condition || 'USED') !== conditionFilter) return false;
      if (deferredSearchKeyword && !post._searchText.includes(deferredSearchKeyword)) return false;
      return true;
    });
  }, [normalizedPosts, activeTab, gradeFilter, conditionFilter, deferredSearchKeyword]);

  const visiblePosts = useMemo(() => filteredPosts.slice(0, currentPage * PAGE_SIZE), [filteredPosts, currentPage]);
  const hasMore = visiblePosts.length < filteredPosts.length;

  const tabCount = useMemo(() => {
    return posts.reduce(
      (acc, post) => {
        if (post.status === 'PENDING') acc.PENDING += 1;
        if (post.status === 'APPROVED') acc.APPROVED += 1;
        if (post.status === 'REJECTED') acc.REJECTED += 1;
        if (post.status === 'HIDDEN') acc.HIDDEN += 1;
        acc.ALL += 1;
        return acc;
      },
      { PENDING: 0, APPROVED: 0, REJECTED: 0, HIDDEN: 0, ALL: 0 }
    );
  }, [posts]);

  const selectedPosts = useMemo(() => posts.filter((post) => selectedPostIds.has(post.id)), [posts, selectedPostIds]);
  const selectedPendingCount = useMemo(() => selectedPosts.filter((post) => post.status === 'PENDING').length, [selectedPosts]);
  const selectedApprovedCount = useMemo(() => selectedPosts.filter((post) => post.status === 'APPROVED').length, [selectedPosts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, gradeFilter, conditionFilter, deferredSearchKeyword]);

  useEffect(() => {
    setSelectedPostIds((prev) => {
      if (!prev.size) return prev;

      const visibleIdSet = new Set(filteredPosts.map((post) => post.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIdSet.has(id)) next.add(id);
      });
      return next;
    });
  }, [filteredPosts]);

  const actionableVisibleIds = useMemo(
    () => visiblePosts.filter((post) => post.status === 'PENDING' || post.status === 'APPROVED').map((post) => post.id),
    [visiblePosts]
  );

  const allActionableVisibleSelected = useMemo(() => {
    if (!actionableVisibleIds.length) return false;
    return actionableVisibleIds.every((id) => selectedPostIds.has(id));
  }, [actionableVisibleIds, selectedPostIds]);

  const hasActiveFilters = Boolean(searchKeyword.trim()) || gradeFilter !== 'ALL' || conditionFilter !== 'ALL';

  const updatePostStatus = async (post: PostRecord, nextStatus: PostStatus, extraFields?: Partial<PostRecord>) => {
    try {
      setProcessingIds((prev) => new Set(prev).add(post.id));
      await updateDoc(doc(db, 'posts', post.id), {
        status: nextStatus,
        processedAt: Date.now(),
        ...(extraFields || {}),
      });

      if (nextStatus === 'APPROVED') toast.success('Đã duyệt bài đăng thành công.');
      if (nextStatus === 'HIDDEN') toast.success('Đã ẩn bài đăng.');
      if (nextStatus === 'REJECTED') toast.success('Đã từ chối bài đăng.');
    } catch (error) {
      console.error('Error updating post status:', error);
      toast.error('Không thể cập nhật trạng thái bài đăng.');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  const updateSelectedPosts = async (targetStatus: 'APPROVED' | 'HIDDEN') => {
    const ids = selectedPosts
      .filter((post) => (targetStatus === 'APPROVED' ? post.status === 'PENDING' : post.status === 'APPROVED'))
      .map((post) => post.id);

    if (!ids.length) {
      toast.error(targetStatus === 'APPROVED' ? 'Không có bài chờ duyệt được chọn.' : 'Không có bài đã duyệt được chọn.');
      return;
    }

    try {
      setIsBulkProcessing(true);
      const batch = writeBatch(db);
      const now = Date.now();

      ids.forEach((id) => {
        const payload: Record<string, unknown> = {
          status: targetStatus,
          processedAt: now,
        };

        if (targetStatus === 'APPROVED') payload.rejectionReason = '';
        batch.update(doc(db, 'posts', id), payload);
      });

      await batch.commit();
      setSelectedPostIds(new Set());
      toast.success(
        targetStatus === 'APPROVED'
          ? `Đã duyệt ${ids.length} bài đăng thành công.`
          : `Đã ẩn ${ids.length} bài đăng thành công.`
      );
    } catch (error) {
      console.error('Error updating selected posts:', error);
      toast.error('Không thể xử lý hàng loạt. Vui lòng thử lại.');
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleApprove = async (post: PostRecord) => {
    await updatePostStatus(post, 'APPROVED', { rejectionReason: '' });
  };

  const handleHide = async (post: PostRecord) => {
    await updatePostStatus(post, 'HIDDEN');
  };

  const handleOpenRejectDialog = (post: PostRecord) => {
    setRejectingPost(post);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const toggleSelection = (postId: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (allActionableVisibleSelected) {
        actionableVisibleIds.forEach((id) => next.delete(id));
      } else {
        actionableVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleChatWithAuthor = (post: PostRecord) => {
    if (!post.userId) {
      toast.error('Bài đăng này chưa có userId để mở chat.');
      return;
    }

    navigate(`/chat?userId=${encodeURIComponent(post.userId)}`);
  };

  const handleConfirmReject = async () => {
    if (!rejectingPost) return;

    const reason = rejectionReason.trim();
    if (!reason) {
      toast.error('Vui lòng nhập lý do từ chối.');
      return;
    }

    await updatePostStatus(rejectingPost, 'REJECTED', { rejectionReason: reason });
    setRejectDialogOpen(false);
    setRejectingPost(null);
    setRejectionReason('');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 pt-5 border-b border-slate-100">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">Quản lý bài đăng</h1>
                <p className="mt-1 text-sm text-slate-600 font-medium">Duyệt bài nhanh, theo dõi trạng thái và kiểm soát chất lượng nội dung chợ đồ chơi.</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-6 overflow-x-auto custom-scrollbar">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative pb-3 text-sm font-bold whitespace-nowrap transition-colors ${
                      isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {tabCount[tab.id]}
                    </span>
                    <span className={`absolute left-0 right-0 -bottom-[1px] h-0.5 rounded-full transition-all ${isActive ? 'bg-blue-600 opacity-100' : 'bg-transparent opacity-0'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <label className="relative flex-1 w-full min-w-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="Tìm theo tiêu đề, nội dung"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </label>

              <div className="relative w-full md:w-48">
                <select
                  value={gradeFilter}
                  onChange={(event) => setGradeFilter(event.target.value as GradeFilter)}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium cursor-pointer"
                >
                  {GRADES.map((grade) => {
                    const value = grade === 'Tất cả Grade' ? 'ALL' : (grade as GradeFilter);
                    return (
                      <option key={grade} value={value}>
                        {grade}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <div className="relative w-full md:w-48">
                <select
                  value={conditionFilter}
                  onChange={(event) => setConditionFilter(event.target.value as ConditionFilter)}
                  className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2.5 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium cursor-pointer"
                >
                  {CONDITIONS.map((condition) => {
                    const value = condition === 'Tất cả tình trạng' ? 'ALL' : (condition as ConditionFilter);
                    return (
                      <option key={condition} value={value}>
                        {condition}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setSearchKeyword('');
                  setGradeFilter('ALL');
                  setConditionFilter('ALL');
                }}
                className={`text-sm font-semibold text-rose-500 hover:text-rose-600 px-2 flex items-center gap-1 cursor-pointer transition-colors ${
                  hasActiveFilters ? '' : 'pointer-events-none opacity-40'
                }`}
                disabled={!hasActiveFilters}
                aria-label="Reset bộ lọc"
                title="Reset"
              >
                <RotateCcw size={14} />
                <span>Xóa lọc</span>
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-slate-500 font-medium">
                Hiển thị <span className="text-slate-900 font-bold">{visiblePosts.length}</span> / {filteredPosts.length} bài đăng phù hợp
              </p>
            </div>
          </div>
        </div>

        {!!actionableVisibleIds.length && (
          <div className="bg-blue-50/80 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="px-3 py-2 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-blue-700 text-sm font-bold"
              >
                {allActionableVisibleSelected ? 'Bỏ chọn trang hiện tại' : 'Chọn trang hiện tại'}
              </button>
              <p className="text-sm text-blue-900 font-semibold">Đã chọn {selectedPostIds.size} bài để xử lý hàng loạt</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!selectedPendingCount || isBulkProcessing}
                onClick={() => void updateSelectedPosts('APPROVED')}
                className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
              >
                {isBulkProcessing ? 'Đang xử lý...' : `Duyệt ${selectedPendingCount} bài`}
              </button>
              <button
                type="button"
                disabled={!selectedApprovedCount || isBulkProcessing}
                onClick={() => void updateSelectedPosts('HIDDEN')}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-60"
              >
                {isBulkProcessing ? 'Đang xử lý...' : `Ẩn ${selectedApprovedCount} bài`}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div key={item} className="h-80 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-3 text-sm font-semibold text-slate-600">Không có bài đăng nào trong mục này</p>
          </div>
        ) : (
          <>
            <motion.div layout className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {visiblePosts.map((post) => {
                  const images = (post.images || []).filter(Boolean).slice(0, 4);
                  const currentStatus = statusMeta[post.status || 'PENDING'];
                  const isProcessing = processingIds.has(post.id);

                  return (
                    <motion.article
                      key={post.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
                    >
                      <div className="p-4 pb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {post.userAvatar ? (
                            <img src={post.userAvatar} alt={post.userName} className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100" />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-slate-100 grid place-items-center text-slate-500 font-black ring-2 ring-slate-100">
                              {(post.userName || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">{post.userName || 'Người dùng ẩn danh'}</p>
                            <p className="text-xs text-slate-500">{dayjs(post.createdAt).fromNow()}</p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${currentStatus.className}`}>{currentStatus.label}</span>
                      </div>

                      <div className="px-4 pb-4 space-y-3">
                        <div>
                          <p className="text-lg font-bold text-slate-900 leading-snug">{post.title || 'Bài đăng không tiêu đề'}</p>
                          <div className="mt-1 flex items-center gap-3 flex-wrap">
                            <p className="text-xl font-black text-rose-600">{formatMoney(post.price)}</p>
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">{post.grade || 'N/A'}</span>
                            <span className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-xs font-bold">{post.condition || 'USED'}</span>
                          </div>
                        </div>

                        <PostImageGrid
                          images={images}
                          title={post.title || 'Bài đăng'}
                          onPreview={(index) => {
                            setPreviewImages(post.images || []);
                            setPreviewIndex(index);
                            setImageModalOpen(true);
                          }}
                        />

                        <p style={contentClampStyle} className="text-sm text-slate-600 leading-relaxed">
                          {post.content || 'Không có mô tả.'}
                        </p>

                        {post.status === 'REJECTED' && post.rejectionReason ? (
                          <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                            <p className="text-xs font-bold text-rose-700">Lý do từ chối</p>
                            <p className="mt-1 text-xs text-rose-600 leading-relaxed">{post.rejectionReason}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="px-4 py-4 border-t border-slate-100 bg-slate-50/60">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <button
                            type="button"
                            onClick={() => handleChatWithAuthor(post)}
                            disabled={!post.userId}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 disabled:opacity-50"
                          >
                            <MessageCircle size={14} /> Nhắn tin cho người đăng
                          </button>

                          {(post.status === 'PENDING' || post.status === 'APPROVED') && (
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 select-none">
                              <input
                                type="checkbox"
                                checked={selectedPostIds.has(post.id)}
                                onChange={() => toggleSelection(post.id)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-300"
                              />
                              Chọn
                            </label>
                          )}
                        </div>

                        {post.status === 'PENDING' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => void handleApprove(post)}
                              disabled={isProcessing || isBulkProcessing}
                              className="inline-flex justify-center items-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"
                            >
                              <CheckCircle2 size={16} /> Duyệt Bài
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRejectDialog(post)}
                              disabled={isProcessing || isBulkProcessing}
                              className="inline-flex justify-center items-center gap-1.5 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold disabled:opacity-60"
                            >
                              <XCircle size={16} /> Từ Chối
                            </button>
                          </div>
                        ) : post.status === 'APPROVED' ? (
                          <button
                            type="button"
                            onClick={() => void handleHide(post)}
                            disabled={isProcessing || isBulkProcessing}
                            className="w-full inline-flex justify-center items-center gap-1.5 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-60"
                          >
                            <EyeOff size={16} /> Ẩn Bài
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-2 text-xs text-slate-500 font-semibold">
                            <ShieldAlert size={14} /> Bài đăng đã xử lý
                          </div>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {hasMore && (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 text-sm font-bold"
                >
                  Tải thêm bài đăng
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <RejectDialog
        open={rejectDialogOpen}
        post={rejectingPost}
        reason={rejectionReason}
        setReason={setRejectionReason}
        isSubmitting={processingIds.size > 0 || isBulkProcessing}
        onCancel={() => {
          if (processingIds.size > 0 || isBulkProcessing) return;
          setRejectDialogOpen(false);
          setRejectingPost(null);
          setRejectionReason('');
        }}
        onConfirm={handleConfirmReject}
      />

      <ImagePreviewModal
        open={imageModalOpen}
        images={previewImages}
        initialIndex={previewIndex}
        onClose={() => {
          setImageModalOpen(false);
          setPreviewImages([]);
          setPreviewIndex(0);
        }}
      />
    </div>
  );
}
