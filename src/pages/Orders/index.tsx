import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ShoppingCart,
  Clock,
  Truck,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  X,
  MapPin,
  Phone,
  User,
  Package,
  RotateCcw,
  Wallet,
  Copy,
  QrCode,
  Building2,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  LayoutList,
  KanbanSquare,
  AlertTriangle,
} from 'lucide-react';
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, updateDoc, where, increment, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../firebase';
import { sendNotificationToAppUser } from '../../services/notificationService';
import { MessageSquare, /* các icon khác giữ nguyên */ } from 'lucide-react';
type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPING'
  | 'COMPLETED'
  | 'RETURN_PENDING'
  | 'RETURN_APPROVED'
  | 'RETURNING'
  | 'RETURN_REJECTED'
  | 'CANCELLED'
  | 'REFUNDING'
  | 'REFUNDED'
  | 'UNKNOWN';

type PaymentStatus = 'PAID' | 'UNPAID';

type ViewMode = 'LIST' | 'KANBAN';

type OrderProduct = {
  name?: string;
  imageUrl?: string;
  category?: string;
  price?: number;
};

type OrderItem = {
  quantity?: number;
  purchasedPrice?: number;
  product?: OrderProduct | null;
  name?: string;
  productName?: string;
  imageUrl?: string;
  category?: string;
  price?: number;
  unitPrice?: number;
};

type OrderRecord = {
  id: string;
  userId?: string;
  userAvatar?: string;
  status?: string;
  paymentStatus?: string;
  customerName?: string;
  userName?: string;
  fullName?: string;
  receiverName?: string;
  phone?: string;
  phoneNumber?: string;
  receiverPhone?: string;
  address?: string;
  shippingAddress?: string;
  paymentMethod?: string;
  discountCode?: string;
  freeshipCode?: string;
  voucherCode?: string;
  voucherName?: string;
  voucherDiscount?: number;
  discountAmount?: number;
  discountValue?: number;
  shippingDiscount?: number;
  freeShip?: boolean;
  isFreeShip?: boolean;
  shippingFeeAfterDiscount?: number;
  createdAt?: any;
  totalAmount?: number;
  totalPrice?: number;
  subTotal?: number;
  shippingFee?: number;
  items?: OrderItem[];
  cartItems?: OrderItem[];
  products?: OrderItem[];
  orderItems?: OrderItem[];
  orderDetails?: OrderItem[];
  itemsList?: OrderItem[];
  productsList?: OrderItem[];
  refundBankBin?: string;
  refundBankShortName?: string;
  refundAccountNumber?: string;
  refundAccountName?: string;
  refundReceiptUrl?: string;
  refundNotifiedAt?: number;
  cancelReason?: string;
  cancelledBy?: string;
  returnReason?: string;
  returnDescription?: string;
  returnImages?: string[];
  returnTrackingCode?: string;
};

type CancelDialogState = {
  order: OrderRecord;
  reason: string;
  customReason: string;
};

const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [8, 16, 24];
const PAGE_SIZE_STORAGE_KEY = 'orders_page_size';
const CANCEL_REASONS = ['Hết hàng / Lỗi kho', 'Nghi ngờ gian lận', 'Khách yêu cầu hủy', 'Lý do khác'] as const;
const OTHER_CANCEL_REASON = 'Lý do khác';

const STATUS_OPTIONS: Array<{ value: OrderStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'CONFIRMED', label: 'Chờ lấy hàng' },
  { value: 'SHIPPING', label: 'Đang giao' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'RETURN_PENDING', label: 'Chờ xử lý trả hàng' },
  { value: 'RETURN_APPROVED', label: 'Chờ khách gửi' },
  { value: 'RETURNING', label: 'Đang hoàn hàng' },
  { value: 'RETURN_REJECTED', label: 'Từ chối trả hàng' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'REFUNDING', label: 'Chờ hoàn tiền' },
  { value: 'REFUNDED', label: 'Đã hoàn tiền' },
];

const KANBAN_COLUMNS: Array<{ status: OrderStatus; label: string }> = [
  { status: 'PENDING', label: 'Chờ duyệt' },
  { status: 'CONFIRMED', label: 'Chờ lấy hàng' },
  { status: 'SHIPPING', label: 'Đang giao' },
  { status: 'COMPLETED', label: 'Hoàn thành' },
  { status: 'RETURN_PENDING', label: 'Chờ xử lý trả hàng' },
  { status: 'RETURN_REJECTED', label: 'Từ chối trả' },
  { status: 'CANCELLED', label: 'Đã hủy' },
  { status: 'REFUNDING', label: 'Chờ hoàn tiền' },
  { status: 'REFUNDED', label: 'Đã hoàn tiền' },
];

const toStatus = (value?: string): OrderStatus => {
  const status = String(value || '').toUpperCase();
  if (
    !status || 
    status === 'NEW' || 
    status === 'PAID' || 
    status === 'SUCCESS' || 
    status === 'PROCESSING' ||
    status === 'AWAITING_PAYMENT'
  ) {
    return 'PENDING';
  }

  if (status === 'REFUND_PENDING') {
    return 'REFUNDING';
  }
  if (
    status === 'PENDING' ||
    status === 'CONFIRMED' ||
    status === 'SHIPPING' ||
    status === 'COMPLETED' ||
    status === 'RETURN_PENDING' ||
    status === 'RETURN_APPROVED' ||
    status === 'RETURNING' ||      
    status === 'RETURN_REJECTED' ||
    status === 'CANCELLED' ||
    status === 'REFUNDING' ||
    status === 'REFUNDED'
  ) {
    return status as OrderStatus;
  }

  return 'UNKNOWN';
};
const toPaymentStatus = (value?: string): PaymentStatus => {
  const status = String(value || '').toUpperCase();
  return status === 'PAID' ? 'PAID' : 'UNPAID';
};

const removeVietnameseTones = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const normalizeText = (value: string) => removeVietnameseTones(String(value || '').toLowerCase().trim());
const getName = (order: OrderRecord) => order.receiverName || order.customerName || order.userName || order.fullName || 'Khách vãng lai';
const getPhone = (order: OrderRecord) => order.receiverPhone || order.phone || order.phoneNumber || 'Chưa cập nhật SĐT';
const getAddress = (order: OrderRecord) => order.address || order.shippingAddress || 'Chưa cập nhật địa chỉ';
const getItems = (order: OrderRecord): OrderItem[] =>
  order.items ||
  order.cartItems ||
  order.products ||
  order.orderItems ||
  order.orderDetails ||
  order.itemsList ||
  order.productsList ||
  [];
const getTotal = (order: OrderRecord) => Number(order.totalAmount || order.totalPrice || 0);
const getSubTotal = (order: OrderRecord) => Number(order.subTotal || order.totalAmount || order.totalPrice || 0);
const getDiscountAmount = (order: OrderRecord) =>
  Number(order.voucherDiscount || order.discountAmount || order.discountValue || order.shippingDiscount || 0);
const getShippingFee = (order: OrderRecord) => Number(order.shippingFeeAfterDiscount ?? order.shippingFee ?? 0);
const isFreeShip = (order: OrderRecord) => Boolean(order.freeshipCode || order.freeShip || order.isFreeShip);
const getVoucherLabel = (order: OrderRecord) => order.voucherCode || order.voucherName || 'Không áp dụng';
const getItemName = (item: OrderItem) => item.product?.name || item.name || item.productName || 'Sản phẩm';
const getItemImage = (item: OrderItem) => item.product?.imageUrl || item.imageUrl;
const getItemCategory = (item: OrderItem) => item.product?.category || item.category;
const getItemPurchasedPrice = (item: OrderItem) =>
  Number(item.purchasedPrice ?? item.price ?? item.unitPrice ?? item.product?.price ?? 0);
const formatMoney = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)}đ`;
const formatTime = (timestamp: any) => {
  if (!timestamp) return 'Không rõ thời gian';
  if (timestamp?.toDate) return timestamp.toDate().toLocaleString('vi-VN');
  if (typeof timestamp === 'number') return new Date(timestamp).toLocaleString('vi-VN');
  return new Date(timestamp).toLocaleString('vi-VN');
};

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('LIST');
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState | null>(null);
  const [rejectReturnDialog, setRejectReturnDialog] = useState<{ order: OrderRecord; reason: string } | null>(null);
  const [refundDialog, setRefundDialog] = useState<OrderRecord | null>(null);
  const [refundReceiptFile, setRefundReceiptFile] = useState<File | null>(null);
  const [refundReceiptPreview, setRefundReceiptPreview] = useState('');
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
    const saved = Number(window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY));
    return PAGE_SIZE_OPTIONS.includes(saved) ? saved : DEFAULT_PAGE_SIZE;
  });
  const [goToPageInput, setGoToPageInput] = useState('1');
  const refundIdFromUrl = searchParams.get('refundId');
  const searchFromUrl = searchParams.get('search');

  useEffect(() => {
    document.title = "Quản lý Đơn hàng - Gunpla Store";
  }, []);

  useEffect(() => {
    if (searchFromUrl) {
      setSearchInput(searchFromUrl);
      setSearchTerm(searchFromUrl);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('search');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchFromUrl, searchParams, setSearchParams]);

  const handleCopyAndCatch = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã copy ${label}!`);
    } catch (error) {
      console.error(error);
      toast.error('Không thể copy dữ liệu này!');
    }
  };

  useEffect(() => {
    return () => {
      if (refundReceiptPreview) {
        URL.revokeObjectURL(refundReceiptPreview);
      }
    };
  }, [refundReceiptPreview]);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<OrderRecord, 'id'>),
      }));
      setOrders(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const pending = orders.filter((o) => toStatus(o.status) === 'PENDING').length;
    const shipping = orders.filter((o) => toStatus(o.status) === 'SHIPPING').length;
    const revenue = orders.filter((o) => toStatus(o.status) === 'COMPLETED').reduce((sum, o) => sum + getTotal(o), 0);
    return { pending, shipping, revenue };
  }, [orders]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: orders.length,
      PENDING: 0,
      CONFIRMED: 0,
      SHIPPING: 0,
      COMPLETED: 0,
      RETURN_PENDING: 0,
      RETURN_REJECTED: 0,
      CANCELLED: 0,
      REFUNDING: 0,
      REFUNDED: 0,
    };

    orders.forEach((order) => {
      const status = toStatus(order.status);
      if (counts[status] !== undefined) {
        counts[status] += 1;
      }
    });

    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const keyword = normalizeText(searchTerm);
    return orders.filter((order) => {
      const status = toStatus(order.status);
      const searchable = normalizeText(`${order.id} ${getName(order)} ${getPhone(order)} ${getAddress(order)}`);
      const matchSearch = keyword.length === 0 || searchable.includes(keyword);
      const matchStatus = statusFilter === 'ALL' || status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, pageSize]);

  useEffect(() => {
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    if (isLoading || !refundIdFromUrl || refundDialog) return;
    const orderFromUrl = orders.find((order) => order.id === refundIdFromUrl);
    if (!orderFromUrl) return;

    openRefundDialog(orderFromUrl);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('refundId');
    setSearchParams(nextParams, { replace: true });
  }, [isLoading, refundIdFromUrl, orders, refundDialog, searchParams, setSearchParams]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageOrders = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, safePage, pageSize]);

  useEffect(() => {
    setGoToPageInput(String(safePage));
  }, [safePage]);

  const visibleColumns = useMemo(() => {
    if (statusFilter === 'ALL') return KANBAN_COLUMNS;
    return KANBAN_COLUMNS.filter((col) => col.status === statusFilter);
  }, [statusFilter]);

  const kanbanData = useMemo(() => {
    const grouped: Record<OrderStatus, OrderRecord[]> = {
      PENDING: [],
      CONFIRMED: [],
      SHIPPING: [],
      COMPLETED: [],
      RETURN_PENDING: [],
      RETURN_APPROVED: [], 
      RETURNING: [],     
      RETURN_REJECTED: [],
      CANCELLED: [],
      REFUNDING: [],
      REFUNDED: [],
      UNKNOWN: [],
    };

    pageOrders.forEach((order) => {
      grouped[toStatus(order.status)].push(order);
    });

    return grouped;
  }, [pageOrders]);
  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-bold border border-amber-200"><Clock className="w-3.5 h-3.5" /> Chờ duyệt</span>;
      case 'CONFIRMED':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-200"><Package className="w-3.5 h-3.5" /> Chờ lấy hàng</span>;
      case 'SHIPPING':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200"><Truck className="w-3.5 h-3.5" /> Đang giao</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-bold border border-emerald-200"><CheckCircle className="w-3.5 h-3.5" /> Hoàn thành</span>;
      case 'RETURN_PENDING':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-50 text-orange-600 text-xs font-bold border border-orange-200"><AlertTriangle className="w-3.5 h-3.5" /> Chờ xử lý Trả hàng</span>;
      case 'RETURN_APPROVED': 
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200"><Package className="w-3.5 h-3.5" /> Chờ khách gửi</span>;
      case 'RETURNING': 
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-50 text-cyan-600 text-xs font-bold border border-cyan-200"><Truck className="w-3.5 h-3.5" /> Đang hoàn hàng</span>;
      case 'RETURN_REJECTED':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-200"><XCircle className="w-3.5 h-3.5" /> Từ chối Trả</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-200"><XCircle className="w-3.5 h-3.5" /> Đã hủy</span>;
      case 'REFUNDING':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-fuchsia-50 text-fuchsia-700 text-xs font-bold border border-fuchsia-200"><RotateCcw className="w-3.5 h-3.5" /> Chờ hoàn tiền</span>;
      case 'REFUNDED':
        return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-300"><Wallet className="w-3.5 h-3.5" /> Đã hoàn tiền</span>;
      default:
        return <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200">Không rõ</span>;
    }
  };

  const getSmartPaymentBadge = (order: OrderRecord) => {
    const method = String(order.paymentMethod || '').toUpperCase();
    const paymentStatus = toPaymentStatus(order.paymentStatus);

    if (method === 'COD') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-200">COD - Thanh toán khi nhận hàng</span>;
    }

    if (paymentStatus === 'PAID') {
      return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">Đã thanh toán Online</span>;
    }

    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">Thanh toán Online chưa hoàn tất</span>;
  };

  const getPromoCodeTags = (order: OrderRecord) => {
    const discountCode = order.discountCode || order.voucherCode;
    const freeshipCode = order.freeshipCode;
    if (!discountCode && !freeshipCode) return null;

    return (
      <div className="flex flex-wrap items-center gap-2">
        {discountCode && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
            Voucher: {discountCode}
          </span>
        )}
        {freeshipCode && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200">
            FreeShip: {freeshipCode}
          </span>
        )}
      </div>
    );
  };

  const getDiscountBadge = (order: OrderRecord) => {
    const discountAmount = getDiscountAmount(order);
    if (discountAmount <= 0 && !isFreeShip(order)) return null;

    return (
      <div className="flex flex-wrap items-center gap-2">
        {discountAmount > 0 && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
            Voucher giảm {formatMoney(discountAmount)}
          </span>
        )}
        {isFreeShip(order) && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
            Free ship
          </span>
        )}
      </div>
    );
  };

  const updateOrderStatus = async (
    order: OrderRecord,
    newStatus: Exclude<OrderStatus, 'UNKNOWN'>,
    successMessage = 'Đã cập nhật trạng thái đơn hàng!'
  ) => {
    setIsProcessingId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: newStatus,
        updatedAt: Date.now(),
      });

      if (order.userId) {
        if (newStatus === 'CONFIRMED') {
          await sendNotificationToAppUser(
            order.userId,
            'Đơn hàng đã được duyệt ✅',
            `Đơn hàng #${order.id.slice(-6).toUpperCase()} của bạn đã được xác nhận và đang chờ lấy hàng.`,
            'ORDER_UPDATE',
            order.id
          );
        }
        if (newStatus === 'SHIPPING') {
          await sendNotificationToAppUser(
            order.userId,
            'Đơn hàng đang được vận chuyển 🚚',
            `Đơn hàng #${order.id.slice(-6).toUpperCase()} đang trên đường giao đến bạn.`,
            'ORDER_UPDATE',
            order.id
          );
        }

        if (newStatus === 'COMPLETED') {
          await sendNotificationToAppUser(
            order.userId,
            'Giao hàng thành công 🎉',
            `Đơn hàng #${order.id.slice(-6).toUpperCase()} đã giao thành công. Hãy để lại đánh giá nhé!`,
            'ORDER_UPDATE',
            order.id,
            undefined,
            'NAVIGATE_TO_REVIEW'
          );
        }

        if (newStatus === 'REFUNDING') {
          await sendNotificationToAppUser(
            order.userId,
            'Đồng ý Trả hàng / Hoàn tiền ✅',
            `Shop đã chấp nhận yêu cầu trả hàng của đơn #${order.id.slice(-6).toUpperCase()}. Shop sẽ sớm hoàn tiền cho bạn.`,
            'ORDER_UPDATE',
            order.id
          );
        }
      }

      toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi cập nhật đơn hàng!');
    } finally {
      setIsProcessingId(null);
    }
  };

  const handleConfirmRejectReturn = async () => {
    if (!rejectReturnDialog) return;
    const { order, reason } = rejectReturnDialog;
    
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối!');
      return;
    }

    setIsProcessingId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'RETURN_REJECTED',
        cancelReason: reason.trim(),
        updatedAt: Date.now(),
      });
      
      if (order.userId) {
        await sendNotificationToAppUser(
          order.userId,
          'Từ chối Trả hàng / Hoàn tiền ❌',
          `Shop đã từ chối yêu cầu của bạn. Lý do: ${reason.trim()}`,
          'ORDER_UPDATE',
          order.id
        );
      }
      toast.success('Đã từ chối khiếu nại!');
    } catch (e) {
      console.error(e);
      toast.error('Lỗi khi từ chối!');
    } finally {
      setIsProcessingId(null);
      setRejectReturnDialog(null); // Đóng Dialog
    }
  };
  const jumpToPage = () => {
    const next = Number(goToPageInput);
    if (!Number.isFinite(next)) {
      setGoToPageInput(String(safePage));
      return;
    }
    const clamped = Math.min(totalPages, Math.max(1, Math.floor(next)));
    setCurrentPage(clamped);
    setGoToPageInput(String(clamped));
  };

  const handleConfirmCancel = async () => {
    if (!cancelDialog) return;

    const { order, reason, customReason } = cancelDialog;
    const resolvedReason = reason === OTHER_CANCEL_REASON ? customReason.trim() : reason;
    if (!resolvedReason) {
      toast.error('Vui lòng nhập lý do hủy đơn!');
      return;
    }

    const paymentStatus = toPaymentStatus(order.paymentStatus);
    const nextStatus = paymentStatus === 'PAID' ? 'REFUNDING' : 'CANCELLED';
    const previousStatus = toStatus(order.status);

    const pushAutoSupportMessage = async (targetOrder: OrderRecord, message: string) => {
      if (!targetOrder.userId) {
        throw new Error('Thiếu userId để tạo chat hỗ trợ hoàn tiền');
      }

      const now = Date.now();
      const supportQuery = query(
        collection(db, 'channels'),
        where('userId', '==', targetOrder.userId),
        where('type', '==', 'SUPPORT'),
        limit(1)
      );
      const supportSnap = await getDocs(supportQuery);

      let channelRef = doc(collection(db, 'channels'));
      if (supportSnap.empty) {
        await setDoc(channelRef, {
          id: channelRef.id,
          participants: [targetOrder.userId],
          userId: targetOrder.userId,
          userName: targetOrder.userName || targetOrder.customerName || targetOrder.fullName || getName(targetOrder),
          userAvatar: targetOrder.userAvatar || '',
          receiverId: 'ADMIN',
          receiverName: 'Hỗ trợ Shop',
          lastMessage: '',
          lastUpdated: now,
          status: 'ACTIVE',
          type: 'SUPPORT',
          lastSenderId: 'ADMIN',
        });
      } else {
        channelRef = doc(db, 'channels', supportSnap.docs[0].id);
      }
      const messageRef = doc(collection(channelRef, 'messages'));
      await setDoc(messageRef, {
        id: messageRef.id,
        channelId: channelRef.id,
        senderId: 'ADMIN',
        content: message,
        timestamp: now,
        isAdmin: true,
        type: 'TEXT',
      });

      await updateDoc(channelRef, {
        lastMessage: message,
        lastSenderId: 'ADMIN',
        lastUpdated: now,
        status: 'ACTIVE',
        type: 'SUPPORT',
      });
    };

    setIsProcessingId(order.id);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'orders', order.id), {
        status: nextStatus,
        cancelReason: resolvedReason,
        cancelledBy: 'ADMIN',
        updatedAt: Date.now(),
      });
      const itemsToRestore = getItems(order);
      itemsToRestore.forEach((item: any) => {
        const productId = item.productId || item.product?.id; 
        
        if (productId) {
          batch.update(doc(db, 'products', productId), {
            stock: increment(item.quantity || 1),
            sold: increment(-(item.quantity || 1))
          });
        }
      });
      const restoreVoucher = async (code: string | undefined, userId: string | undefined) => {
        if (!code || !userId) return;
        const globalVoucherQuery = query(collection(db, 'vouchers'), where('code', '==', code), limit(1));
        const globalVoucherSnap = await getDocs(globalVoucherQuery);
        if (!globalVoucherSnap.empty) {
          batch.update(globalVoucherSnap.docs[0].ref, {
            usedCount: increment(-1)
          });
        }
        const userVoucherQuery = query(
          collection(db, 'user_vouchers'),
          where('userId', '==', userId),
          where('voucher.code', '==', code),
          where('status', '==', 'USED'),
          limit(1)
        );
        const userVoucherSnap = await getDocs(userVoucherQuery);
        if (!userVoucherSnap.empty) {
          batch.update(userVoucherSnap.docs[0].ref, {
            status: 'AVAILABLE'
          });
        }
      };
      await restoreVoucher(order.discountCode, order.userId);
      await restoreVoucher(order.freeshipCode, order.userId);
      await batch.commit();
      if (order.userId) {
        if (paymentStatus === 'PAID' && previousStatus !== 'REFUNDING') {
          const notifyMessage = `Hệ thống: Đơn hàng #${order.id.slice(-6).toUpperCase()} đã bị Shop hủy. Lý do: ${resolvedReason}. Vui lòng nhắn tin Số Tài Khoản, Ngân hàng và Tên chủ tài khoản tại đây để Shop hoàn tiền nhé!`;
          await pushAutoSupportMessage(order, notifyMessage);
          
          await sendNotificationToAppUser(
            order.userId,
            'Đơn hàng đã bị hủy & Chờ hoàn tiền 💸',
            `Đơn #${order.id.slice(-6).toUpperCase()} đã bị hủy. Vui lòng kiểm tra mục Chat để cung cấp STK cho Shop.`,
            'ORDER_UPDATE',
            order.id
          );
          toast.success('Đơn đã chuyển sang chờ hoàn tiền, Đã hoàn Voucher và đã báo cho khách!');
        } else {
          await sendNotificationToAppUser(
            order.userId,
            'Đơn hàng đã bị hủy ❌',
            `Đơn #${order.id.slice(-6).toUpperCase()} đã bị hủy. Lý do: ${resolvedReason}`,
            'ORDER_UPDATE',
            order.id
          );
          toast.success('Đã hủy đơn hàng, hoàn tồn kho và hoàn Voucher thành công!');
        }
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi cập nhật đơn hàng hoặc hoàn tồn kho!');
      return;
    } finally {
      setIsProcessingId(null);
    }

    setCancelDialog(null);
  };
  const handleReceiveReturn = async (order: OrderRecord) => {
    setIsProcessingId(order.id);
    try {
      const batch = writeBatch(db);

      batch.update(doc(db, 'orders', order.id), {
        status: 'REFUNDING',
        updatedAt: Date.now(),
      });
      const itemsToRestore = getItems(order);
      itemsToRestore.forEach((item: any) => {
        const productId = item.productId || item.product?.id; 
        if (productId) {
          batch.update(doc(db, 'products', productId), {
            stock: increment(item.quantity || 1),
            sold: increment(-(item.quantity || 1))
          });
        }
      });

      await batch.commit();

      if (order.userId) {
        await sendNotificationToAppUser(
          order.userId,
          'Đã nhận hàng trả & Chờ hoàn tiền 💸',
          `Shop đã nhận được hàng trả của đơn #${order.id.slice(-6).toUpperCase()}. Kế toán sẽ sớm xử lý hoàn tiền cho bạn.`,
          'ORDER_UPDATE',
          order.id
        );
      }
      toast.success('Đã xác nhận nhận hàng và hoàn lại tồn kho thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi xử lý nhận hàng!');
    } finally {
      setIsProcessingId(null);
    }
  };
  const closeRefundDialog = () => {
    if (refundReceiptPreview) {
      URL.revokeObjectURL(refundReceiptPreview);
    }
    setRefundDialog(null);
    setRefundReceiptFile(null);
    setRefundReceiptPreview('');
    setIsSubmittingRefund(false);
  };

  const openRefundDialog = (order: OrderRecord) => {
    if (refundReceiptPreview) {
      URL.revokeObjectURL(refundReceiptPreview);
    }
    setRefundDialog(order);
    setRefundReceiptFile(null);
    setRefundReceiptPreview('');
  };

  const handleRefundReceiptChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh biên lai!');
      event.target.value = '';
      return;
    }

    if (refundReceiptPreview) {
      URL.revokeObjectURL(refundReceiptPreview);
    }

    setRefundReceiptFile(file);
    setRefundReceiptPreview(URL.createObjectURL(file));
  };

  const handleConfirmRefundTransfer = async () => {
    if (!refundDialog) return;
    if (!refundReceiptFile) {
      toast.error('Vui lòng tải lên ảnh biên lai trước khi xác nhận!');
      return;
    }

    const previousStatus = toStatus(refundDialog.status);

    const pushAutoSupportMessage = async (targetOrder: OrderRecord, message: string) => {
      if (!targetOrder.userId) return;

      const now = Date.now();
      const supportQuery = query(
        collection(db, 'channels'),
        where('userId', '==', targetOrder.userId),
        where('type', '==', 'SUPPORT'),
        limit(1)
      );
      const supportSnap = await getDocs(supportQuery);

      let channelRef = doc(collection(db, 'channels'));
      if (supportSnap.empty) {
        await setDoc(channelRef, {
          id: channelRef.id,
          participants: [targetOrder.userId],
          userId: targetOrder.userId,
          userName: targetOrder.userName || targetOrder.customerName || targetOrder.fullName || getName(targetOrder),
          userAvatar: targetOrder.userAvatar || '',
          receiverId: 'ADMIN',
          receiverName: 'Hỗ trợ Shop',
          lastMessage: '',
          lastUpdated: now,
          status: 'ACTIVE',
          type: 'SUPPORT',
          lastSenderId: 'ADMIN',
        });
      } else {
        channelRef = doc(db, 'channels', supportSnap.docs[0].id);
      }

      const messageRef = doc(collection(channelRef, 'messages'));
      await setDoc(messageRef, {
        id: messageRef.id,
        channelId: channelRef.id,
        senderId: 'ADMIN',
        content: message,
        timestamp: now,
        isAdmin: true,
        type: 'TEXT',
      });

      await updateDoc(channelRef, {
        lastMessage: message,
        lastSenderId: 'ADMIN',
        lastUpdated: now,
        status: 'ACTIVE',
        type: 'SUPPORT',
      });
    };

    setIsSubmittingRefund(true);
    try {
      const formData = new FormData();
      formData.append('file', refundReceiptFile);
      formData.append('upload_preset', 'gundame-storepromax');

      const cloudinaryResponse = await fetch('https://api.cloudinary.com/v1_1/djk7z1i0w/image/upload', {
        method: 'POST',
        body: formData,
      });

      if (!cloudinaryResponse.ok) {
        throw new Error('Upload biên lai thất bại');
      }

      const cloudinaryData = await cloudinaryResponse.json();
      const receiptUrl = cloudinaryData?.secure_url;
      if (!receiptUrl) {
        throw new Error('Không nhận được URL biên lai từ Cloudinary');
      }

      await updateDoc(doc(db, 'orders', refundDialog.id), {
        status: 'REFUNDED',
        refundReceiptUrl: receiptUrl,
        updatedAt: Date.now(),
        refundNotifiedAt: Date.now(),
      });

      if (previousStatus !== 'REFUNDED' && !refundDialog.refundNotifiedAt && refundDialog.userId) {
        const refundSuccessMessage = `Hệ thống: Shop đã hoàn tất chuyển khoản hoàn tiền cho đơn hàng #${refundDialog.id.slice(-6).toUpperCase()}. Bạn vui lòng kiểm tra tài khoản ngân hàng nhé! Cảm ơn bạn.`;
        await pushAutoSupportMessage(refundDialog, refundSuccessMessage);
        
        await sendNotificationToAppUser(
          refundDialog.userId, 
          'Đã Hoàn tiền thành công 💰', 
          `Shop đã chuyển khoản hoàn tiền cho đơn #${refundDialog.id.slice(-6).toUpperCase()}. Kiểm tra biên lai trong chi tiết đơn nhé!`, 
          'ORDER_UPDATE', 
          refundDialog.id
        );
      }

      toast.success('Đã xác nhận hoàn tiền và lưu biên lai thành công!');
      closeRefundDialog();
    } catch (error) {
      console.error(error);
      toast.error('Không thể xử lý hoàn tiền. Vui lòng thử lại!');
    } finally {
      setIsSubmittingRefund(false);
    }
  };
// 🌟 HÀM MỚI: CHUYỂN SANG TRANG CHAT VÀ ĐIỀN SẴN TEXT
  const handleChatWithUser = async (order: OrderRecord) => {
    if (!order.userId) {
      toast.error('Đơn hàng này không có tài khoản người dùng liên kết!');
      return;
    }

    setIsProcessingId('chat_' + order.id);
    try {
      const now = Date.now();
      const supportQuery = query(collection(db, 'channels'), where('userId', '==', order.userId), where('type', '==', 'SUPPORT'), limit(1));
      const supportSnap = await getDocs(supportQuery);
      
      let channelId = '';

      if (supportSnap.empty) {
        const channelRef = doc(collection(db, 'channels'));
        channelId = channelRef.id;
        await setDoc(channelRef, {
          id: channelId,
          participants: [order.userId],
          userId: order.userId,
          userName: getName(order),
          userAvatar: order.userAvatar || '',
          receiverId: 'ADMIN',
          receiverName: 'Hỗ trợ Shop',
          lastMessage: '',
          lastUpdated: now,
          status: 'ACTIVE',
          type: 'SUPPORT',
          lastSenderId: 'ADMIN',
        });
      } else {
        channelId = supportSnap.docs[0].id;
      }

      const itemsText = getItems(order).map(item => `- ${item.quantity || 1}x ${getItemName(item)}`).join('\n');
      const prefillText = `Chào bạn, Shop liên hệ về đơn hàng #${order.id.slice(-6).toUpperCase()}:\n${itemsText}\n\n`;
      navigate(`/chat`, { state: { activeChannelId: channelId, prefillText: prefillText } });

    } catch (error) {
      console.error(error);
      toast.error('Lỗi khi mở Chat!');
    } finally {
      setIsProcessingId(null);
    }
  };
  const renderOrderActions = (order: OrderRecord, status: OrderStatus) => (
    <div className="w-full xl:w-56 shrink-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
      
      {status === 'PENDING' && (
        <>
          {/* 🌟 LOGIC CHẶN LUỒNG: Đơn chuyển khoản nhưng CHƯA thanh toán -> KHÓA NÚT */}
          {order.status === 'AWAITING_PAYMENT' && toPaymentStatus(order.paymentStatus) === 'UNPAID' ? (
            <button
              disabled={true}
              className="min-h-11 py-2.5 px-3 bg-slate-200 text-slate-500 text-sm font-bold rounded-xl border border-slate-300 shadow-inner cursor-not-allowed w-full"
              title="Không thể duyệt. Khách hàng đang trong quá trình chuyển khoản."
            >
              Chờ khách thanh toán...
            </button>
          ) : (
            <button
              disabled={isProcessingId === order.id}
              onClick={() => updateOrderStatus(order, 'CONFIRMED', 'Đã duyệt đơn! Chuyển sang chờ lấy hàng.')}
              className="min-h-11 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 transition-colors disabled:opacity-50 w-full"
            >
              {isProcessingId === order.id ? 'Đang xử lý...' : 'Duyệt đơn (Chờ lấy hàng)'}
            </button>
          )}
        </>
      )}

      {status === 'CONFIRMED' && (
        <button
          disabled={isProcessingId === order.id}
          onClick={() => updateOrderStatus(order, 'SHIPPING', 'Đã giao cho đơn vị vận chuyển!')}
          className="min-h-11 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200 transition-colors disabled:opacity-50"
        >
          {isProcessingId === order.id ? 'Đang xử lý...' : 'Giao cho ĐVVC'}
        </button>
      )}

      {status === 'SHIPPING' && (
        <button
          disabled={isProcessingId === order.id}
          onClick={() => updateOrderStatus(order, 'COMPLETED', 'Đã giao hàng thành công!')}
          className="min-h-11 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-200 transition-colors disabled:opacity-50"
        >
          {isProcessingId === order.id ? 'Đang xử lý...' : 'Hoàn thành (Đã nhận)'}
        </button>
      )}

      {/* 🌟 NÚT XỬ LÝ YÊU CẦU TRẢ HÀNG TỪ KHÁCH (Đã dọn dẹp không còn bị trùng) */}
      {status === 'RETURN_PENDING' && (
        <div className="flex flex-col gap-2 w-full mt-2">
            <button
              disabled={isProcessingId === order.id}
              onClick={() => updateOrderStatus(order, 'RETURN_APPROVED', 'Đã duyệt! Chờ khách gửi trả hàng về Shop.')}
              className="min-h-11 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50"
            >
              Chấp nhận (Chờ gửi trả)
            </button>
            <button
              disabled={isProcessingId === order.id}
              onClick={() => setRejectReturnDialog({ order, reason: '' })}
              className="min-h-11 py-2.5 px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Từ chối khiếu nại
            </button>
        </div>
      )}

      {/* 🌟 NÚT XÁC NHẬN KHI SHOP NHẬN ĐƯỢC HÀNG TRẢ VỀ */}
      {status === 'RETURNING' && (
        <button
          disabled={isProcessingId === order.id}
          onClick={() => handleReceiveReturn(order)}
          className="min-h-11 py-2.5 px-3 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50 mt-2"
        >
          {isProcessingId === order.id ? 'Đang xử lý...' : 'Đã nhận được hàng trả'}
        </button>
      )}

      {['PENDING'].includes(status) && (
        <button
          disabled={isProcessingId === order.id}
          onClick={() => setCancelDialog({ order, reason: CANCEL_REASONS[0], customReason: '' })}
          className="min-h-11 py-2.5 px-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
        >
          Hủy đơn
        </button>
      )}

      {/* 🌟 NÚT NÀY SẼ MỞ RA DIALOG UP BIÊN LAI HOÀN TIỀN (CHUNG CHO CẢ HỦY VÀ TRẢ HÀNG) */}
      {status === 'REFUNDING' && (
        <button
          disabled={isProcessingId === order.id}
          onClick={() => openRefundDialog(order)}
          className="min-h-11 py-2.5 px-3 bg-fuchsia-100 border border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-200 text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
        >
          Xử lý hoàn tiền
        </button>
      )}

      {/* Thay thế nút Chi tiết cũ bằng Cụm 2 nút này */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        <button
          onClick={() => handleChatWithUser(order)}
          disabled={isProcessingId === 'chat_' + order.id}
          className="min-h-11 py-2.5 px-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-[13px] font-bold rounded-xl transition-colors flex justify-center items-center gap-1.5"
        >
          <MessageSquare className="w-4 h-4" /> {isProcessingId === 'chat_' + order.id ? '...' : 'Nhắn tin'}
        </button>

        <button
          onClick={() => setSelectedOrder(order)}
          className="min-h-11 py-2.5 px-2 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-[13px] font-bold rounded-xl transition-colors flex justify-center items-center gap-1.5"
        >
          <Eye className="w-4 h-4" /> Chi tiết
        </button>
      </div>
    </div>
  );

  const refundTotalPrice = refundDialog ? getTotal(refundDialog) : 0;
  const hasBankInfo = Boolean(refundDialog?.refundAccountNumber);
  const refundBankLabel = refundDialog ? refundDialog.refundBankShortName || refundDialog.refundBankBin || 'Chưa cập nhật' : 'Chưa cập nhật';
  const refundBankCode = refundDialog ? String(refundDialog.refundBankBin || refundDialog.refundBankShortName || '').trim() : '';
  const refundAccountName = refundDialog?.refundAccountName || 'Chưa cập nhật';
  const refundAccountNumber = refundDialog?.refundAccountNumber || 'Chưa cập nhật';
  const refundQrSrc =
    hasBankInfo && refundDialog && refundBankCode && refundDialog.refundAccountNumber
      ? `https://img.vietqr.io/image/${refundBankCode}-${refundDialog.refundAccountNumber}-compact2.png?amount=${refundTotalPrice}&addInfo=${encodeURIComponent(`HOAN TIEN DON ${refundDialog.id}`)}&accountName=${encodeURIComponent(refundDialog.refundAccountName || '')}`
      : '';

  return (
    <div className="flex flex-col animate-in fade-in duration-300 relative h-full">
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4">
        <div className="relative px-5 sm:px-6 lg:px-8 py-6 rounded-[28px] border border-slate-900/10 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 text-white mb-6">
          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(52,211,153,0.22), transparent 0), radial-gradient(circle at 80% 0%, rgba(45,212,191,0.18), transparent 0)' }} />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-300 font-black">Xử lý Đơn hàng</p>
              <h1 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">Danh sách Đơn hàng</h1>
              <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">Duyệt đơn, theo dõi vận chuyển và xử lý khiếu nại, hoàn tiền.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[420px]">
              <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">Cần duyệt</p>
                <p className="mt-1 text-2xl font-black text-amber-400">{stats.pending}</p>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">Đang giao</p>
                <p className="mt-1 text-2xl font-black text-blue-300">{stats.shipping}</p>
              </div>
              <div className="rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-slate-300 font-semibold">Tổng doanh thu</p>
                <p className="mt-1 text-xl font-black text-emerald-300">{formatMoney(stats.revenue)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
          <div className="relative w-full xl:w-96">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo mã đơn, tên, SĐT, địa chỉ..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto custom-scrollbar pb-2 xl:pb-0">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap inline-flex items-center gap-2 ${statusFilter === status.value ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {status.label}
                <span className={`min-w-6 h-6 rounded-full text-[11px] inline-flex items-center justify-center ${statusFilter === status.value ? 'bg-white/15 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                  {statusCounts[status.value] ?? 0}
                </span>
              </button>
            ))}
            <div className="ml-2 flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setViewMode('LIST')}
                className={`h-9 w-9 rounded-lg grid place-items-center transition-colors ${viewMode === 'LIST' ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                title="Dạng danh sách"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('KANBAN')}
                className={`h-9 w-9 rounded-lg grid place-items-center transition-colors ${viewMode === 'KANBAN' ? 'bg-white text-emerald-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
                title="Dạng Kanban"
              >
                <KanbanSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center text-emerald-600 font-bold items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin" /> Đang tải dữ liệu đơn hàng...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-20 text-center text-slate-500 font-medium flex flex-col items-center">
            <ShoppingCart className="w-12 h-12 mb-4 text-slate-300" />
            Không tìm thấy đơn hàng nào phù hợp.
          </div>
        ) : (
          <>
            {viewMode === 'LIST' ? (
              <div className="grid grid-cols-1 gap-4 pb-6">
                {pageOrders.map((order) => {
                  const status = toStatus(order.status);
                  const items = getItems(order);
                  return (
                    <div key={order.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
                      <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">#{order.id.slice(-6).toUpperCase()}</span>
                            {getStatusBadge(status)}
                            {getSmartPaymentBadge(order)}
                            {getDiscountBadge(order) && <div>{getDiscountBadge(order)}</div>}
                          </div>
                          <p className="font-black text-slate-900 text-lg">{getName(order)}</p>
                          <p className="text-sm font-semibold text-slate-500 mt-1">{getPhone(order)}</p>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1" title={getAddress(order)}>{getAddress(order)}</p>
                        </div>

                        <div className="md:border-l border-slate-100 md:pl-6">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Sản phẩm ({items.length})</p>
                          <div className="space-y-1.5">
                            {items.slice(0, 2).map((item, idx) => (
                              <p key={idx} className="text-sm text-slate-700 truncate font-medium">
                                <span className="font-bold text-blue-600">{item.quantity || 1}x</span> {getItemName(item)}
                              </p>
                            ))}
                            {items.length > 2 && <p className="text-xs font-bold text-slate-400 italic">...và {items.length - 2} sản phẩm khác</p>}
                          </div>
                        </div>

                        <div className="md:border-l border-slate-100 md:pl-6 flex flex-col justify-center">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng cộng</p>
                          <p className="text-xl font-black text-emerald-600 mb-2">{formatMoney(getTotal(order))}</p>
                          <p className="text-xs font-medium text-slate-400">{formatTime(order.createdAt)}</p>
                        </div>
                      </div>

                      {renderOrderActions(order, status)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="pb-6 overflow-x-auto custom-scrollbar">
                <div className="grid grid-flow-col auto-cols-[300px] gap-4 min-w-max">
                  {visibleColumns.map((column) => {
                    const columnOrders = kanbanData[column.status];
                    return (
                      <div key={column.status} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(column.status)}
                          </div>
                          <span className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-lg">{columnOrders.length}</span>
                        </div>

                        <div className="space-y-3 max-h-[560px] overflow-y-auto custom-scrollbar pr-1">
                          {columnOrders.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500 text-center">Không có đơn trong cột này</div>
                          ) : (
                            columnOrders.map((order) => {
                              const items = getItems(order);
                              return (
                                <div key={order.id} className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">#{order.id.slice(-6).toUpperCase()}</span>
                                    {getSmartPaymentBadge(order)}
                                    {getDiscountBadge(order) && <div>{getDiscountBadge(order)}</div>}
                                  </div>
                                  {getPromoCodeTags(order) && <div className="mb-2">{getPromoCodeTags(order)}</div>}
                                  <p className="text-sm font-black text-slate-900">{getName(order)}</p>
                                  <p className="text-xs text-slate-500 mt-1">{getPhone(order)}</p>
                                  <p className="text-xs text-slate-400 mt-1 line-clamp-1">{getAddress(order)}</p>
                                  <p className="text-sm font-black text-emerald-600 mt-2">{formatMoney(getTotal(order))}</p>
                                  <p className="text-[11px] text-slate-400 mt-1">{formatTime(order.createdAt)}</p>
                                  <div className="mt-2 space-y-1">
                                    {items.slice(0, 2).map((item, idx) => (
                                      <p key={idx} className="text-xs text-slate-600 truncate">
                                        <span className="font-bold text-blue-600">{item.quantity || 1}x</span> {getItemName(item)}
                                      </p>
                                    ))}
                                  </div>
                                  <div className="mt-3">
                                    {renderOrderActions(order, column.status)}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 mb-8">
              <p className="text-sm font-semibold text-slate-600">
                Hiển thị {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredOrders.length)} / {filteredOrders.length} đơn hàng
              </p>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100"
                  title="Số dòng mỗi trang"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}/trang
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    value={goToPageInput}
                    onChange={(e) => setGoToPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') jumpToPage();
                    }}
                    className="h-10 w-16 text-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100"
                    title="Đi tới trang"
                  />
                  <button
                    onClick={jumpToPage}
                    className="h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-semibold text-slate-700"
                  >
                    Đi
                  </button>
                </div>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safePage === 1}
                  className="h-10 w-10 grid place-items-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                  title="Trang đầu"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-10 w-10 grid place-items-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                  title="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 text-sm font-bold text-slate-700">{safePage}/{totalPages}</span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-10 w-10 grid place-items-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                  title="Trang sau"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="h-10 w-10 grid place-items-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
                  title="Trang cuối"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><ShoppingCart className="w-5 h-5" /></div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-2 flex-wrap">
                    Đơn hàng #{selectedOrder.id.slice(-6).toUpperCase()}
                    {getStatusBadge(toStatus(selectedOrder.status))}
                    {getSmartPaymentBadge(selectedOrder)}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500">{formatTime(selectedOrder.createdAt)}</p>
                </div>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
              
              {/* 🌟 KHU VỰC KHIẾU NẠI TRẢ HÀNG */}
              {['RETURN_PENDING', 'RETURN_APPROVED', 'RETURNING', 'RETURN_REJECTED', 'REFUNDING', 'REFUNDED'].includes(toStatus(selectedOrder.status)) && selectedOrder.returnReason && (
                <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4">
                  <h4 className="text-xs font-black uppercase tracking-widest text-orange-800 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Yêu cầu Trả hàng / Khiếu nại từ khách</h4>
                  <p className="font-bold text-slate-900">Lý do: <span className="text-orange-700">{selectedOrder.returnReason}</span></p>
                  <p className="text-sm text-slate-700 mt-1">Chi tiết: {selectedOrder.returnDescription}</p>
                  
                  {selectedOrder.returnImages && selectedOrder.returnImages.length > 0 && (
                    <div className="flex gap-3 mt-3 overflow-x-auto">
                      {selectedOrder.returnImages.map((img, idx) => (
                        <a key={idx} href={img} target="_blank" rel="noreferrer" title="Click để phóng to">
                          <img src={img} alt="Bằng chứng" className="w-24 h-24 object-cover rounded-xl border border-orange-200 shadow-sm hover:scale-105 transition-transform" />
                        </a>
                      ))}
                    </div>
                  )}

                  {toStatus(selectedOrder.status) === 'RETURN_REJECTED' && selectedOrder.cancelReason && (
                     <div className="mt-3 pt-3 border-t border-orange-200">
                        <p className="text-sm font-bold text-red-600">Shop từ chối: {selectedOrder.cancelReason}</p>
                     </div>
                  )}
                  {/* 🌟 THÊM: Hiển thị mã vận đơn nếu khách đã nhập */}
                  {selectedOrder.returnTrackingCode && (
                    <div className="mt-3 pt-3 border-t border-orange-200">
                        <p className="text-sm font-bold text-slate-800">Mã vận đơn hoàn hàng (Khách gửi): <span className="text-cyan-700">{selectedOrder.returnTrackingCode}</span></p>
                    </div>
                  )}
                </div>
              )}

              {/* 🌟 KHU VỰC HỦY ĐƠN */}
              {['CANCELLED'].includes(toStatus(selectedOrder.status)) && selectedOrder.cancelReason && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-widest text-red-600 mb-1">Lý do hủy đơn</p>
                  <p className="text-sm font-semibold text-red-800">{selectedOrder.cancelReason}</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Khách hàng</h4>
                    <p className="font-bold text-slate-900 mb-1">{getName(selectedOrder)}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> {getPhone(selectedOrder)}</div>
                    <div className="flex items-start gap-2 text-sm text-slate-600"><MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" /> <span>{getAddress(selectedOrder)}</span></div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Wallet className="w-4 h-4" /> Thanh toán</h4>
                    {getPromoCodeTags(selectedOrder) && <div className="mb-3">{getPromoCodeTags(selectedOrder)}</div>}
                    {getDiscountBadge(selectedOrder) && <div className="mb-3">{getDiscountBadge(selectedOrder)}</div>}
                    <div className="flex justify-between items-center text-sm font-medium text-slate-600 mb-2">
                      <span>Trạng thái:</span>
                      {getSmartPaymentBadge(selectedOrder)}
                    </div>
                    {['CANCELLED', 'REFUNDING', 'REFUNDED'].includes(toStatus(selectedOrder.status)) && selectedOrder.cancelReason && (
                      <p className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                        Lý do: {selectedOrder.cancelReason} (Bởi: {String(selectedOrder.cancelledBy || '').toUpperCase() === 'ADMIN' ? 'Shop' : 'Khách hàng'})
                      </p>
                    )}
                    <div className="flex justify-between items-center text-sm font-medium text-slate-600 mb-2">
                      <span>Phương thức:</span>
                      <span className="text-slate-900 font-bold">{selectedOrder.paymentMethod || 'COD (Tiền mặt)'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium text-slate-600 mb-2">
                      <span>Tạm tính:</span>
                      <span>{formatMoney(getSubTotal(selectedOrder))}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium text-slate-600 mb-2">
                      <span>Voucher:</span>
                      <span className="text-slate-900 font-bold">{getVoucherLabel(selectedOrder)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium text-slate-600 mb-2">
                      <span>Giảm giá:</span>
                      <span className="text-rose-600 font-bold">-{formatMoney(getDiscountAmount(selectedOrder))}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium text-slate-600 mb-3 pb-3 border-b border-slate-200">
                      <span>Phí ship:</span>
                      <span>{isFreeShip(selectedOrder) ? 'Miễn phí' : formatMoney(getShippingFee(selectedOrder))}</span>
                    </div>
                    <div className="flex justify-between items-center text-base">
                      <span className="font-bold text-slate-900">Tổng cộng:</span>
                      <span className="font-black text-emerald-600 text-lg">{formatMoney(getTotal(selectedOrder))}</span>
                    </div>
                  </div>

                  {/* 🌟 KHU VỰC THÔNG TIN HOÀN TIỀN CÓ MÃ VIETQR */}
                  {toStatus(selectedOrder.status) === 'REFUNDING' && selectedOrder.refundAccountNumber && (
                    <div className="bg-fuchsia-50 rounded-2xl p-4 border border-fuchsia-100 animate-in slide-in-from-bottom-2">
                      <h4 className="text-xs font-black uppercase tracking-widest text-fuchsia-800 mb-4 flex items-center gap-2">
                        <Building2 className="w-4 h-4" /> Thông tin hoàn tiền
                      </h4>
                      <div className="flex flex-col xl:flex-row gap-4 items-center">
                        <div className="flex-1 space-y-3 w-full">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-fuchsia-600/70 mb-0.5">Ngân hàng</p>
                            <p className="text-sm font-bold text-fuchsia-950">{selectedOrder.refundBankShortName || selectedOrder.refundBankBin}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-fuchsia-600/70 mb-0.5">Chủ tài khoản</p>
                            <p className="text-sm font-bold text-fuchsia-950 uppercase">{selectedOrder.refundAccountName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-fuchsia-600/70 mb-0.5">Số tài khoản</p>
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-black text-fuchsia-700 tracking-wider">{selectedOrder.refundAccountNumber}</p>
                              <button onClick={() => handleCopyAndCatch(selectedOrder.refundAccountNumber || '', 'Số tài khoản')} className="p-1.5 bg-white border border-fuchsia-200 hover:bg-fuchsia-100 text-fuchsia-600 rounded-lg transition-colors shadow-sm" title="Copy STK">
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="shrink-0 p-2 bg-white rounded-xl border border-fuchsia-200 shadow-sm flex flex-col items-center">
                          <img
                            src={`https://img.vietqr.io/image/${selectedOrder.refundBankBin || selectedOrder.refundBankShortName}-${selectedOrder.refundAccountNumber}-compact2.png?amount=${getTotal(selectedOrder)}&addInfo=HOAN TIEN DON ${selectedOrder.id.slice(-6).toUpperCase()}&accountName=${encodeURIComponent(selectedOrder.refundAccountName || '')}`}
                            alt="VietQR"
                            className="w-32 h-32 object-contain"
                          />
                          <p className="text-[10px] font-bold text-slate-500 mt-2 flex items-center gap-1"><QrCode className="w-3 h-3"/> Quét để chuyển khoản</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Package className="w-4 h-4" /> Chi tiết sản phẩm</h4>
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
                          <th className="p-4 w-12 text-center">SL</th>
                          <th className="p-4">Sản phẩm</th>
                          <th className="p-4 text-right">Đơn giá</th>
                          <th className="p-4 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {getItems(selectedOrder).map((item, idx) => {
                          const qty = Number(item.quantity || 1);
                          const purchasedPrice = getItemPurchasedPrice(item);
                          const itemName = getItemName(item);
                          const itemImage = getItemImage(item);
                          const itemCategory = getItemCategory(item);
                          return (
                            <tr key={idx} className="group hover:bg-slate-50/80 transition-all duration-200">
                              <td className="p-4 text-center">
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700 font-black">{qty}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  {itemImage ? (
                                    <img
                                      src={itemImage}
                                      alt={itemName}
                                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm group-hover:scale-105 transition-transform"
                                    />
                                  ) : (
                                    <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 grid place-items-center text-slate-400">
                                      <Package className="w-5 h-5" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-bold text-slate-900 text-sm line-clamp-2">{itemName}</p>
                                    {itemCategory && <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md mt-1 inline-block font-semibold">{itemCategory}</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-right text-sm font-semibold text-slate-700">{formatMoney(purchasedPrice)}</td>
                              <td className="p-4 text-right text-sm font-black text-emerald-600">{formatMoney(purchasedPrice * qty)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setSelectedOrder(null)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors cursor-pointer">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {refundDialog && (
        <div className="fixed inset-0 z-[130] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-fuchsia-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-fuchsia-50 to-indigo-50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900">Xử lý Hoàn Tiền</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Đơn #{refundDialog.id.slice(-6).toUpperCase()}</p>
              </div>
              <button
                onClick={closeRefundDialog}
                disabled={isSubmittingRefund}
                className="p-2 rounded-full hover:bg-white/80 text-slate-500 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-y-auto custom-scrollbar">
              <div className={`space-y-4 ${hasBankInfo ? '' : 'lg:col-span-2'}`}>
                <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 p-4">
                  <p className="text-xs uppercase tracking-widest font-bold text-fuchsia-600">Tổng tiền cần hoàn</p>
                  <p className="mt-1 text-2xl font-black text-fuchsia-700">{formatMoney(refundTotalPrice)}</p>
                </div>

                {hasBankInfo ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <h4 className="text-xs uppercase tracking-widest font-black text-slate-500">Thông tin ngân hàng khách</h4>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Ngân hàng</p>
                      <p className="text-sm font-bold text-slate-900">{refundBankLabel}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Tên tài khoản</p>
                      <p className="text-sm font-bold text-slate-900">{refundAccountName}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase">Số tài khoản</p>
                      <p className="text-base font-black text-slate-900 tracking-wide">{refundAccountNumber}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-widest text-amber-700 mb-1">Thiếu thông tin ngân hàng</p>
                    <p className="text-sm font-semibold text-amber-900">
                      Đơn hàng do Shop hủy hoặc Khách chưa cung cấp thẻ. Vui lòng check tin nhắn Chat để lấy Số tài khoản chuyển khoản.
                    </p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-widest font-black text-slate-500 mb-2">Upload biên lai chuyển khoản</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleRefundReceiptChange}
                    disabled={isSubmittingRefund}
                    className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-fuchsia-100 file:text-fuchsia-700 hover:file:bg-fuchsia-200 cursor-pointer"
                  />
                  {refundReceiptPreview && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2 inline-block">
                      <img src={refundReceiptPreview} alt="Biên lai" className="w-full max-h-48 object-contain rounded-lg" />
                    </div>
                  )}
                </div>
              </div>

              {hasBankInfo && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col">
                  <h4 className="text-xs uppercase tracking-widest font-black text-slate-500 mb-3">Mã VietQR</h4>
                  <div className="flex-1 rounded-xl border border-fuchsia-100 bg-white p-3 flex flex-col items-center justify-center">
                    <img src={refundQrSrc} alt="VietQR hoàn tiền" className="w-64 max-w-full aspect-square object-contain" />
                    <p className="mt-2 text-xs font-semibold text-slate-500 text-center">Quét mã để chuyển khoản nhanh cho khách</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={closeRefundDialog}
                disabled={isSubmittingRefund}
                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Đóng
              </button>
              <button
                onClick={handleConfirmRefundTransfer}
                disabled={isSubmittingRefund}
                className="px-5 py-2.5 rounded-xl bg-fuchsia-600 text-white font-bold hover:bg-fuchsia-700 transition-colors disabled:opacity-60"
              >
                {isSubmittingRefund ? 'Đang xử lý...' : 'Xác nhận Đã Chuyển Khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelDialog && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-100 text-red-600 grid place-items-center mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-center text-xl font-black text-slate-900">Xác nhận hủy đơn hàng?</h3>
              <p className="mt-2 text-center text-sm text-slate-600">
                Đơn #{cancelDialog.order.id.slice(-6).toUpperCase()} sẽ được xử lý theo trạng thái thanh toán hiện tại.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {getStatusBadge(toStatus(cancelDialog.order.status))}
                {getSmartPaymentBadge(cancelDialog.order)}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Lý do hủy đơn</p>
                <div className="space-y-2">
                  {CANCEL_REASONS.map((reason) => (
                    <label key={reason} className="flex items-center gap-3 text-sm font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason}
                        checked={cancelDialog.reason === reason}
                        onChange={() =>
                          setCancelDialog((prev) =>
                            prev ? { ...prev, reason } : prev
                          )
                        }
                        className="h-4 w-4 accent-red-600"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>

                {cancelDialog.reason === OTHER_CANCEL_REASON && (
                  <input
                    type="text"
                    value={cancelDialog.customReason}
                    onChange={(e) =>
                      setCancelDialog((prev) =>
                        prev ? { ...prev, customReason: e.target.value } : prev
                      )
                    }
                    placeholder="Nhập lý do cụ thể..."
                    className="mt-3 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 text-sm font-medium"
                  />
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setCancelDialog(null)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={
                  isProcessingId === cancelDialog.order.id ||
                  (cancelDialog.reason === OTHER_CANCEL_REASON && cancelDialog.customReason.trim().length === 0)
                }
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {isProcessingId === cancelDialog.order.id ? 'Đang xử lý...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 🌟 DIALOG TỪ CHỐI KHIẾU NẠI MỚI */}
      {rejectReturnDialog && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-red-100 text-red-600 grid place-items-center mb-4">
                <XCircle className="w-7 h-7" />
              </div>
              <h3 className="text-center text-xl font-black text-slate-900">Từ chối khiếu nại?</h3>
              <p className="mt-2 text-center text-sm text-slate-600">
                Yêu cầu trả hàng của đơn #{rejectReturnDialog.order.id.slice(-6).toUpperCase()} sẽ bị từ chối và đơn hàng sẽ được đóng lại.
              </p>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Lý do từ chối</p>
                <input
                  type="text"
                  value={rejectReturnDialog.reason}
                  onChange={(e) =>
                    setRejectReturnDialog((prev) =>
                      prev ? { ...prev, reason: e.target.value } : prev
                    )
                  }
                  placeholder="Ví dụ: Sản phẩm hỏng do lỗi người dùng..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 text-sm font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setRejectReturnDialog(null)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmRejectReturn}
                disabled={isProcessingId === rejectReturnDialog.order.id || rejectReturnDialog.reason.trim() === ''}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {isProcessingId === rejectReturnDialog.order.id ? 'Đang xử lý...' : 'Xác nhận Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}