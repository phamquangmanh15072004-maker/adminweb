import { useEffect, useMemo, useState, useRef } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  where,
} from 'firebase/firestore';
import { AlertCircle, AlertTriangle, Edit3, Loader2, Plus, Search, ShieldOff, TicketPercent, Trash2, Filter, ChevronDown, CalendarClock, EyeOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { canManageVouchers } from '../../utils/permissions';

type VoucherType = 'DISCOUNT' | 'FREESHIP';
type DiscountType = 'FIXED' | 'PERCENT';
type FilterStatus = 'ALL' | 'RUNNING' | 'UPCOMING' | 'EXPIRED';

type VoucherRecord = {
  id: string;
  code: string;
  title: string;
  type: VoucherType;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number;
  minOrderValue: number;
  usageLimit: number;
  usedCount: number;
  startDate: number;
  expirationDate: number;
  isActive: boolean;
  isPublic: boolean;
};

type VoucherFormState = {
  code: string;
  title: string;
  type: VoucherType;
  discountType: DiscountType;
  discountValue: string;
  maxDiscount: string;
  minOrderValue: string;
  usageLimit: string;
  startDate: string;
  expirationDate: string;
  isActive: boolean;
  isScheduled: boolean;
  isPublic: boolean;
};

const initialFormState: VoucherFormState = {
  code: '',
  title: '',
  type: 'DISCOUNT',
  discountType: 'FIXED',
  discountValue: '',
  maxDiscount: '',
  minOrderValue: '',
  usageLimit: '',
  startDate: '',
  expirationDate: '',
  isActive: true,
  isScheduled: false,
  isPublic: true,
};

// --- HÀM HELPER XỬ LÝ FORMAT ---
const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);
const formatCompactMoney = (value: number) => {
  if (value >= 1000000) return `${Math.round(value / 1000000)}M`;
  if (value >= 1000) return `${Math.round(value / 1000)}K`;
  return `${value}`;
};
const formatDatetime = (timestamp: number) => {
  if (!timestamp) return 'N/A';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
};

const formatForInput = (timestamp: number) => {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

const parseFromInput = (val: string) => {
  if (!val) return '';
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? '' : parsed.toString();
};

// 🌟 THÊM HÀM FORMAT TIỀN TỆ KHI NHẬP LIỆU (1000000 -> 1.000.000)
const formatNumberInput = (value: string) => {
  if (!value) return '';
  // Chỉ lấy các ký tự số
  const digits = value.replace(/\D/g, '');
  // Thêm dấu chấm phân cách hàng nghìn
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const getStatusMeta = (voucher: VoucherRecord) => {
  const now = Date.now();
  if (!voucher.isActive) return { key: 'DISABLED', label: 'Đã vô hiệu hóa', className: 'bg-slate-100 text-slate-700' };
  if (voucher.usedCount >= voucher.usageLimit) return { key: 'EXHAUSTED', label: 'Đã hết lượt', className: 'bg-slate-100 text-slate-700' };
  if (now < voucher.startDate) return { key: 'UPCOMING', label: 'Sắp diễn ra', className: 'bg-amber-100 text-amber-700' };
  if (now > voucher.expirationDate) return { key: 'ENDED', label: 'Đã kết thúc', className: 'bg-red-100 text-red-700' };
  return { key: 'RUNNING', label: 'Đang diễn ra', className: 'bg-emerald-100 text-emerald-700' };
};

// --- COMPONENT DÙNG CHUNG CHUẨN UI ---
const ToggleSwitch = ({ checked, onChange, label, description, colorClass = "bg-blue-600" }: any) => (
  <label className="flex items-center justify-between cursor-pointer p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
    <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <div className="pr-4">
      <p className="text-sm font-bold text-slate-800">{label}</p>
      {description && <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{description}</p>}
    </div>
    <div className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ease-in-out focus:outline-none ${checked ? colorClass : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </div>
  </label>
);

function CustomFormDropdown({ value, options, onChange }: { value: string, options: {label: string, value: string}[], onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedLabel = options.find(o => o.value === value)?.label || '';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-12 flex items-center justify-between px-4 rounded-xl border bg-white text-sm font-semibold focus:ring-2 focus:ring-blue-100 outline-none transition-all ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-300 text-slate-900 hover:bg-slate-50'
        }`}
      >
        <span>{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+8px)] left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-[60] overflow-hidden"
          >
            {options.map(opt => (
              <button
                key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors hover:bg-slate-50 border-b border-slate-50 last:border-0 ${
                  value === opt.value ? 'text-blue-600 bg-blue-50/50' : 'text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeleteConfirmModal({ open, voucher, isDeleting, onCancel, onConfirm }: any) {
  if (!open || !voucher) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-black/45 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-xl font-black text-slate-900">Xác nhận xóa Voucher</h3>
          <p className="mt-2 text-sm text-slate-600 font-medium leading-relaxed">
            Bạn có chắc chắn muốn xóa mã <span className="font-black uppercase text-slate-900">{voucher.code}</span>? Hành động này không thể hoàn tác.
          </p>
        </div>
        <div className="px-6 py-4 flex justify-end gap-3 bg-slate-50/50">
          <button type="button" onClick={onCancel} disabled={isDeleting} className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition disabled:opacity-60">Hủy</button>
          <button type="button" onClick={() => void onConfirm()} disabled={isDeleting} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition disabled:opacity-60 shadow-sm shadow-red-200">
            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currentUser } = useAuth();
  const isSuperAdmin = canManageVouchers(currentUser?.role);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<VoucherRecord | null>(null);
  const [formState, setFormState] = useState<VoucherFormState>(initialFormState);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState<VoucherRecord | null>(null);
  const [isDeletingVoucher, setIsDeletingVoucher] = useState(false);
  
  const stableNow = useMemo(() => Date.now(), [isModalOpen]); 

  useEffect(() => { document.title = "Quản lý Khuyến mãi - Gunpla Store"; }, []);

  useEffect(() => {
    if (!isModalOpen) { document.body.style.overflow = 'unset'; return; }
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  useEffect(() => {
    setIsLoading(true);
    const voucherQuery = query(collection(db, 'vouchers'), orderBy('startDate', 'desc'));
    const unsubscribe = onSnapshot(
      voucherQuery,
      (snapshot) => {
        const data: VoucherRecord[] = snapshot.docs.map((item) => {
          const raw = item.data() as Partial<VoucherRecord>;
          return {
            id: item.id, code: String(raw.code || ''), title: String(raw.title || ''),
            type: (raw.type as VoucherType) || 'DISCOUNT', discountType: (raw.discountType as DiscountType) || 'FIXED',
            discountValue: Number(raw.discountValue || 0), maxDiscount: Number(raw.maxDiscount || 0),
            minOrderValue: Number(raw.minOrderValue || 0), usageLimit: Number(raw.usageLimit || 0),
            usedCount: Number(raw.usedCount || 0), startDate: Number(raw.startDate || 0),
            expirationDate: Number(raw.expirationDate || 0), 
            isActive: Boolean(raw.isActive !== false), 
            isPublic: Boolean(raw.isPublic !== false), 
          };
        });
        setVouchers(data); setIsLoading(false);
      },
      (error) => { console.error(error); toast.error('Lỗi mạng: Không thể tải danh sách voucher.'); setIsLoading(false); }
    );
    return unsubscribe;
  }, []);

  const filteredVouchers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return vouchers.filter((voucher) => {
      const status = getStatusMeta(voucher);
      const matchesSearch = !keyword || voucher.code.toLowerCase().includes(keyword) || voucher.title.toLowerCase().includes(keyword);
      const matchesFilter = filterStatus === 'ALL' || (filterStatus === 'RUNNING' && status.key === 'RUNNING') ||
        (filterStatus === 'UPCOMING' && status.key === 'UPCOMING') || (filterStatus === 'EXPIRED' && ['ENDED', 'EXHAUSTED', 'DISABLED'].includes(status.key));
      return matchesSearch && matchesFilter;
    });
  }, [vouchers, searchTerm, filterStatus]);

  const openCreateModal = () => {
    setEditingVoucher(null);
    setFormState({ ...initialFormState, isScheduled: false });
    setIsModalOpen(true);
  };

  const openEditModal = (voucher: VoucherRecord) => {
    setEditingVoucher(voucher);
    const isScheduled = voucher.startDate > Date.now();
    setFormState({
      code: voucher.code, title: voucher.title, type: voucher.type,
      discountType: voucher.discountType, discountValue: String(voucher.discountValue),
      maxDiscount: String(voucher.maxDiscount || ''), minOrderValue: String(voucher.minOrderValue || ''),
      usageLimit: String(voucher.usageLimit || ''), startDate: String(voucher.startDate),
      expirationDate: String(voucher.expirationDate), isActive: voucher.isActive, 
      isScheduled: isScheduled, isPublic: voucher.isPublic
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false); setEditingVoucher(null); setFormState(initialFormState);
  };

  const handleFormChange = (field: keyof VoucherFormState, value: string | boolean) => {
    setFormState((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'code' && typeof value === 'string') next.code = value.toUpperCase().replace(/\s+/g, '');
      if (field === 'discountType' && value === 'FIXED') next.maxDiscount = '';
      return next;
    });
  };

  const getDiscountDisplay = (voucher: VoucherRecord) => {
    if (voucher.discountType === 'FIXED') return `Giảm ${formatCompactMoney(voucher.discountValue)} (${formatMoney(voucher.discountValue)})`;
    const percentText = `Giảm ${voucher.discountValue}%`;
    if (voucher.maxDiscount > 0) return `${percentText} (Tối đa ${formatCompactMoney(voucher.maxDiscount)})`;
    return percentText;
  };

  const handleSubmitVoucher = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isSuperAdmin) { toast.error('⛔ Lỗi phân quyền: Chỉ Admin mới có quyền thao tác.'); return; }

    const code = formState.code.trim().toUpperCase();
    const title = formState.title.trim();
    const discountValue = Number(formState.discountValue || 0);
    const maxDiscount = formState.discountType === 'PERCENT' ? Number(formState.maxDiscount || 0) : 0;
    const minOrderValue = Number(formState.minOrderValue || 0);
    const usageLimit = Number(formState.usageLimit || 0);
    
    let finalStartDate = Number(formState.startDate);
    if (!formState.isScheduled) {
      finalStartDate = editingVoucher ? editingVoucher.startDate : Date.now();
    }
    const expirationDate = Number(formState.expirationDate);

    // 🌟 VALIDATION TIẾNG VIỆT CHUẨN UX
    if (!code) { toast.error('🏷️ Vui lòng nhập Mã Code cho Voucher.'); return; }
    if (!title) { toast.error('📝 Vui lòng nhập Tên chương trình.'); return; }
    if (!finalStartDate || !expirationDate || Number.isNaN(finalStartDate) || Number.isNaN(expirationDate)) { 
      toast.error('📅 Vui lòng thiết lập đầy đủ thời gian bắt đầu và kết thúc.'); return; 
    }
    if (expirationDate <= finalStartDate) { toast.error('⏳ Ngày kết thúc phải diễn ra sau ngày bắt đầu.'); return; }
    
    if (discountValue <= 0) { toast.error('💰 Giá trị giảm phải lớn hơn 0.'); return; }
    if (formState.discountType === 'PERCENT' && discountValue > 100) { toast.error('❌ Mức giảm theo phần trăm không được vượt quá 100%.'); return; }
    if (formState.discountType === 'PERCENT' && discountValue === 100 && maxDiscount === 0) {
      toast.error('⚠️ Bạn đang set giảm 100% nhưng chưa đặt mức giảm tối đa, điều này có thể gây thất thoát doanh thu!'); return;
    }

    if (minOrderValue < 0) { toast.error('🛒 Giá trị đơn tối thiểu không hợp lệ.'); return; }
    if (usageLimit <= 0) { toast.error('🎟️ Tổng số lượng phát hành phải lớn hơn 0.'); return; }

    setIsSubmitting(true);
    try {
      const q = query(collection(db, 'vouchers'), where('code', '==', code));
      const querySnapshot = await getDocs(q);
      const isDuplicate = !querySnapshot.empty && querySnapshot.docs.some((item) => item.id !== editingVoucher?.id);
      if (isDuplicate) { toast.error('⚠️ Mã Voucher này đã tồn tại trong hệ thống!'); setIsSubmitting(false); return; }

      const payload = {
        code, title, type: formState.type, discountType: formState.discountType,
        discountValue, maxDiscount, minOrderValue, usageLimit, usedCount: editingVoucher?.usedCount || 0,
        startDate: finalStartDate, expirationDate, 
        isActive: formState.isActive, 
        isPublic: formState.isPublic, 
      };

      if (editingVoucher) {
        await updateDoc(doc(db, 'vouchers', editingVoucher.id), payload);
        toast.success('✅ Cập nhật voucher thành công.');
      } else {
        await addDoc(collection(db, 'vouchers'), payload);
        toast.success('✅ Tạo voucher mới thành công.');
      }
      closeModal();
    } catch (error: any) { 
      console.error(error); 
      // 🌟 TRANSLATE FIREBASE ERRORS SANG TIẾNG VIỆT
      const msg = error?.message || '';
      if (msg.includes('permission-denied')) {
        toast.error('⛔ Lỗi bảo mật: Bạn không có quyền ghi dữ liệu.');
      } else if (msg.includes('unavailable') || msg.includes('network')) {
        toast.error('🌐 Lỗi mạng: Vui lòng kiểm tra lại đường truyền internet.');
      } else {
        toast.error('❌ Lỗi hệ thống: Không thể lưu voucher lúc này.');
      }
    } 
    finally { setIsSubmitting(false); }
  };

  const handleToggleActive = async (voucher: VoucherRecord) => {
    if (!isSuperAdmin) { toast.error('⛔ Chỉ Admin mới có quyền thao tác.'); return; }
    try {
      await updateDoc(doc(db, 'vouchers', voucher.id), { isActive: !voucher.isActive });
      toast.success(voucher.isActive ? '🔒 Đã vô hiệu hóa voucher.' : '🔓 Đã kích hoạt lại voucher.');
    } catch (error) { toast.error('❌ Lỗi hệ thống: Không thể cập nhật trạng thái.'); }
  };

  const handleOpenDeleteModal = (voucher: VoucherRecord) => {
    if (!isSuperAdmin) { toast.error('⛔ Chỉ Admin mới có quyền xóa.'); return; }
    setVoucherToDelete(voucher); setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (isDeletingVoucher) return;
    setDeleteModalOpen(false); setVoucherToDelete(null);
  };

  const handleConfirmDeleteVoucher = async () => {
    if (!isSuperAdmin || !voucherToDelete) return;
    try {
      setIsDeletingVoucher(true);
      await deleteDoc(doc(db, 'vouchers', voucherToDelete.id));
      toast.success('🗑️ Đã xóa Voucher thành công');
      setDeleteModalOpen(false); setVoucherToDelete(null);
    } catch (error) { toast.error('❌ Lỗi hệ thống: Không thể xóa voucher lúc này.'); } 
    finally { setIsDeletingVoucher(false); }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Quản lý Khuyến mãi</h1>
            <p className="mt-2 text-sm text-slate-600 font-medium">
              Quản trị mã giảm giá và miễn phí vận chuyển theo lịch chạy tự động.
            </p>
          </div>
          {isSuperAdmin && (
            <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-sm shadow-blue-200">
              <Plus size={18} /> Tạo Voucher mới
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative md:col-span-2">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm theo mã hoặc tên chương trình..."
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full h-12 flex items-center justify-between bg-white border border-slate-300 rounded-xl px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
              >
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span>
                    {filterStatus === 'ALL' ? 'Tất cả trạng thái' : filterStatus === 'RUNNING' ? 'Đang chạy' : filterStatus === 'UPCOMING' ? 'Sắp tới' : 'Hết hạn / Vô hiệu'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute top-full right-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {(['ALL', 'RUNNING', 'UPCOMING', 'EXPIRED'] as FilterStatus[]).map((status) => (
                      <button
                        key={status} onClick={() => { setFilterStatus(status); setIsDropdownOpen(false); }}
                        className={`w-full text-left px-4 py-3 text-sm font-bold transition-colors hover:bg-slate-50 border-b border-slate-50 last:border-0 ${filterStatus === status ? 'text-blue-600 bg-blue-50/50' : 'text-slate-600'}`}
                      >
                        {status === 'ALL' ? 'Tất cả trạng thái' : status === 'RUNNING' ? 'Đang chạy' : status === 'UPCOMING' ? 'Sắp tới' : 'Hết hạn / Vô hiệu'}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((item) => <div key={item} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : filteredVouchers.length === 0 ? (
            <div className="p-10 text-center">
              <TicketPercent className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-base font-bold text-slate-700">Không tìm thấy voucher phù hợp</p>
              <p className="text-sm text-slate-500 mt-1">Thử thay đổi từ khóa hoặc bộ lọc trạng thái</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Mã code</th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Tên chương trình</th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Loại giảm giá</th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Đơn tối thiểu</th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Đã dùng</th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Thời gian</th>
                    <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Trạng thái</th>
                    {isSuperAdmin && <th className="px-5 py-4 text-left text-xs font-black uppercase tracking-wider text-slate-500">Hành động</th>}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredVouchers.map((voucher) => {
                    const status = getStatusMeta(voucher);
                    return (
                      <tr key={voucher.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-800">{voucher.code}</span>
                          {!voucher.isPublic && (
                             <span className="block mt-1 text-[10px] font-bold text-rose-500 flex items-center gap-1">
                               <EyeOff size={10} /> Đang Ẩn
                             </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-slate-800">{voucher.title}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{voucher.type === 'FREESHIP' ? 'Miễn phí vận chuyển' : 'Giảm giá đơn hàng'}</p>
                        </td>
                        <td className="px-5 py-4"><span className="text-sm font-semibold text-slate-700">{getDiscountDisplay(voucher)}</span></td>
                        <td className="px-5 py-4"><span className="text-sm font-semibold text-slate-700">{formatMoney(voucher.minOrderValue)}</span></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (voucher.usedCount / voucher.usageLimit) * 100)}%` }} /></div>
                            <span className="text-xs font-bold text-slate-600">{voucher.usedCount}/{voucher.usageLimit}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600 font-medium">
                          <p>{formatDatetime(voucher.startDate)}</p>
                          <p className="text-xs text-slate-400 mt-0.5">đến {formatDatetime(voucher.expirationDate)}</p>
                        </td>
                        <td className="px-5 py-4"><span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${status.className.replace('bg-', 'border-').replace('100', '200')} ${status.className}`}>{status.label}</span></td>
                        {isSuperAdmin && (
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => openEditModal(voucher)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition" title="Sửa"><Edit3 size={16} /></button>
                              <button onClick={() => handleToggleActive(voucher)} className={`p-1.5 rounded-lg transition ${voucher.isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`} title={voucher.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}><ShieldOff size={16} /></button>
                              <button onClick={() => handleOpenDeleteModal(voucher)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition" title="Xóa"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="shrink-0 px-8 py-6 border-b border-slate-100 bg-white">
              <h2 className="text-2xl font-black text-slate-900">
                {editingVoucher ? 'Chỉnh sửa Voucher' : 'Tạo Voucher mới'}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 font-medium">Thiết lập các thông số giảm giá và lên lịch chạy chiến dịch.</p>
            </div>

            {/* 🌟 THÊM noValidate để chặn tooltip báo lỗi tiếng Anh mặc định của HTML5 */}
            <form onSubmit={handleSubmitVoucher} noValidate className="flex flex-col min-h-0 bg-slate-50/30">
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <label className="space-y-2">
                    <span className="text-sm font-bold text-slate-700">Mã Code</span>
                    <input
                      value={formState.code}
                      onChange={(event) => { event.target.value = event.target.value.toUpperCase(); handleFormChange('code', event.target.value); }}
                      placeholder="VD: SALE50K"
                      className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-black uppercase tracking-wider focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:font-medium placeholder:normal-case placeholder:tracking-normal"
                    />
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-bold text-slate-700">Tên chương trình hiển thị cho khách</span>
                    <input
                      value={formState.title}
                      onChange={(event) => handleFormChange('title', event.target.value)}
                      placeholder="VD: Siêu Sale Cuối Tuần Giảm 50K"
                      className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                    />
                  </label>
                </div>

                <div className="h-px w-full bg-slate-200/60" />

                <div className="space-y-5">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Thiết lập mức giảm</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <label className="space-y-2 block relative z-20">
                      <span className="text-sm font-bold text-slate-700">Loại Voucher</span>
                      <CustomFormDropdown
                        value={formState.type}
                        onChange={(val) => handleFormChange('type', val)}
                        options={[
                          { label: 'Giảm giá đơn hàng', value: 'DISCOUNT' },
                          { label: 'Miễn phí vận chuyển', value: 'FREESHIP' }
                        ]}
                      />
                    </label>

                    <label className="space-y-2 block relative z-10">
                      <span className="text-sm font-bold text-slate-700">Hình thức giảm</span>
                      <CustomFormDropdown
                        value={formState.discountType}
                        onChange={(val) => handleFormChange('discountType', val)}
                        options={[
                          { label: 'Giảm theo số tiền (VNĐ)', value: 'FIXED' },
                          { label: 'Giảm theo phần trăm (%)', value: 'PERCENT' }
                        ]}
                      />
                    </label>

                    {/* 🌟 ĐỔI type="number" THÀNH type="text" VÀ DÙNG HÀM FORMAT */}
                    <label className="space-y-2">
                      <span className="text-sm font-bold text-slate-700">Mức giảm {formState.discountType === 'PERCENT' ? '(%)' : '(VNĐ)'}</span>
                      <input
                        type="text"
                        value={formatNumberInput(formState.discountValue)} 
                        onChange={(event) => {
                          const rawValue = event.target.value.replace(/\D/g, ''); // Loại bỏ chữ, chỉ giữ số
                          handleFormChange('discountValue', rawValue);
                        }}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                      />
                    </label>

                    {formState.discountType === 'PERCENT' ? (
                      <label className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <span className="text-sm font-bold text-slate-700">Mức giảm tối đa (VNĐ)</span>
                        <input
                          type="text"
                          value={formatNumberInput(formState.maxDiscount)} 
                          onChange={(event) => {
                            const rawValue = event.target.value.replace(/\D/g, '');
                            handleFormChange('maxDiscount', rawValue);
                          }}
                          className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                        />
                      </label>
                    ) : (
                      <div className="hidden md:block" />
                    )}
                  </div>
                </div>

                <div className="h-px w-full bg-slate-200/60" />

                <div className="space-y-5">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Điều kiện & Lượt dùng</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {/* 🌟 ÁP DỤNG FORMAT TIỀN TỆ Ở ĐÂY TƯƠNG TỰ */}
                    <label className="space-y-2">
                      <span className="text-sm font-bold text-slate-700">Giá trị đơn tối thiểu (VNĐ)</span>
                      <input
                        type="text" 
                        value={formatNumberInput(formState.minOrderValue)} 
                        onChange={(event) => {
                          const rawValue = event.target.value.replace(/\D/g, '');
                          handleFormChange('minOrderValue', rawValue);
                        }}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                      />
                    </label>

                    <label className="space-y-2">
                      <span className="text-sm font-bold text-slate-700">Tổng số lượng phát hành</span>
                      <input
                        type="text" 
                        value={formatNumberInput(formState.usageLimit)} 
                        onChange={(event) => {
                          const rawValue = event.target.value.replace(/\D/g, '');
                          handleFormChange('usageLimit', rawValue);
                        }}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                      />
                    </label>
                  </div>
                </div>

                <div className="h-px w-full bg-slate-200/60" />

                <div className="space-y-5">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <CalendarClock size={16} className="text-blue-600"/> Thời gian áp dụng & Trạng thái
                  </h3>

                  <ToggleSwitch 
                    checked={formState.isScheduled} 
                    onChange={(val: boolean) => handleFormChange('isScheduled', val)} 
                    label="Lên lịch phát hành (Hẹn giờ)" 
                    description="Bật tính năng này nếu bạn muốn mã giảm giá chỉ bắt đầu có hiệu lực từ một thời điểm trong tương lai. Nếu tắt, mã sẽ áp dụng ngay lập tức."
                  />

                  <div className="grid grid-cols-2 gap-6 p-4 rounded-2xl bg-white border border-slate-200">
                    {/* NGÀY BẮT ĐẦU */}
                    {formState.isScheduled ? (
                      <label className="space-y-2 block animate-in fade-in">
                        <span className="text-sm font-bold text-slate-700">Thời gian bắt đầu</span>
                        <input
                          type="datetime-local"
                          value={formatForInput(Number(formState.startDate))}
                          onChange={(e) => handleFormChange('startDate', parseFromInput(e.target.value))}
                          min={formatForInput(stableNow)}
                          className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                        />
                      </label>
                    ) : (
                      <div className="flex flex-col justify-center h-full pt-6 px-2 animate-in fade-in">
                        <span className="text-sm font-bold text-blue-600">Phát hành ngay lập tức</span>
                        <span className="text-xs font-medium text-slate-500 mt-1">Mã sẽ có hiệu lực ngay khi bấm Lưu.</span>
                      </div>
                    )}

                    {/* NGÀY KẾT THÚC */}
                    <label className="space-y-2 block">
                      <span className="text-sm font-bold text-slate-700">Thời gian kết thúc</span>
                      <input
                        type="datetime-local"
                        value={formatForInput(Number(formState.expirationDate))}
                        onChange={(e) => handleFormChange('expirationDate', parseFromInput(e.target.value))}
                        min={formState.isScheduled ? formatForInput(Number(formState.startDate)) : formatForInput(stableNow)}
                        className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                      />
                    </label>
                  </div>

                  <ToggleSwitch 
                    checked={formState.isActive} 
                    onChange={(val: boolean) => handleFormChange('isActive', val)} 
                    label="Trạng thái Hoạt động" 
                    description="Nếu tắt, mã này sẽ bị vô hiệu hóa hoàn toàn, khách hàng không thể sử dụng mã này."
                    colorClass="bg-emerald-500"
                  />

                  <ToggleSwitch 
                    checked={!formState.isPublic} 
                    onChange={(val: boolean) => handleFormChange('isPublic', !val)} 
                    label="Tạo làm Mã Ẩn (Voucher tặng riêng / Đền bù)" 
                    description="Nếu bật, mã sẽ KHÔNG hiển thị trên trang chủ App. Khách hàng phải tự gõ tay Code này để áp dụng."
                    colorClass="bg-rose-500"
                  />
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 mt-6">
                  <AlertCircle size={20} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 font-medium leading-relaxed">
                    <strong className="font-bold">Lưu ý:</strong> Mã code sẽ tự động được viết hoa. Khi khách hàng bấm "LƯU" trên App, hệ thống sẽ tự động ghim mã vào giỏ hàng của họ và trừ đi 1 lượt tại kho.
                  </p>
                </div>

              </div>

              <div className="shrink-0 px-8 py-5 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <button
                  type="button" onClick={closeModal} disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition disabled:opacity-60"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit" disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition disabled:opacity-60 shadow-md shadow-blue-200 flex items-center gap-2"
                >
                  {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Đang lưu...</> : (editingVoucher ? 'Cập nhật Voucher' : 'Tạo Voucher')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmModal open={deleteModalOpen} voucher={voucherToDelete} isDeleting={isDeletingVoucher} onCancel={handleCloseDeleteModal} onConfirm={handleConfirmDeleteVoucher} />
    </div>
  );
}
