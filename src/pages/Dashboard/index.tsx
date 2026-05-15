import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  Package,
  TrendingUp,
  Zap,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';

dayjs.extend(relativeTime);
dayjs.locale('vi');

type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'AWAITING_PAYMENT'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'RETURN_PENDING'
  | 'RETURN_REQUESTED'
  | 'RETURN_APPROVED'
  | 'RETURNING'
  | 'RETURN_REJECTED'
  | 'CANCELLED'
  | 'REFUNDING'
  | 'REFUNDED'
  | 'UNKNOWN';

type RevenueRange = '7D' | '30D' | '90D' | 'ALL' | 'CUSTOM';

interface Order {
  id: string;
  totalAmount?: number;
  totalPrice?: number;
  totalProfit?: number;
  paymentStatus?: string;
  status?: string;
  createdAt: any;
}

interface Product {
  id: string;
  sku?: string;
  name: string;
  price: number;
  sold: number;
  stock: number;
  category?: string;
  imageUrl?: string;
  images?: string[];
  isActive?: boolean;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

const toMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value === 'number') return value > 0 && value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toStatus = (value?: string): OrderStatus => {
  const status = String(value || '').toUpperCase();
  if (!status || status === 'NEW' || status === 'PAID' || status === 'SUCCESS' || status === 'PROCESSING') return 'PENDING';
  if (status === 'REFUND_PENDING') return 'REFUNDING';
  if (status === 'RETURN_REQUESTED') return 'RETURN_REQUESTED';
  if (
    [
      'PENDING',
      'CONFIRMED',
      'AWAITING_PAYMENT',
      'SHIPPING',
      'DELIVERED',
      'COMPLETED',
      'RETURN_PENDING',
      'RETURN_APPROVED',
      'RETURNING',
      'RETURN_REJECTED',
      'CANCELLED',
      'REFUNDING',
      'REFUNDED',
    ].includes(status)
  ) {
    return status as OrderStatus;
  }
  return 'UNKNOWN';
};

const REVENUE_RECOGNIZED_STATUSES = new Set<OrderStatus>(['DELIVERED', 'COMPLETED', 'RETURN_REJECTED']);
const isRevenueRecognizedOrder = (order: Order) => REVENUE_RECOGNIZED_STATUSES.has(toStatus(order.status));
const getOrderTotal = (order: Order) => Number(order.totalAmount || order.totalPrice || 0);

const getRangeBounds = (range: RevenueRange, customStart: string, customEnd: string, orders: Order[]) => {
  const todayEnd = dayjs().endOf('day');
  if (range === '7D') return { start: dayjs().subtract(6, 'day').startOf('day'), end: todayEnd };
  if (range === '30D') return { start: dayjs().subtract(29, 'day').startOf('day'), end: todayEnd };
  if (range === '90D') return { start: dayjs().subtract(89, 'day').startOf('day'), end: todayEnd };
  if (range === 'CUSTOM') {
    const start = customStart ? dayjs(customStart).startOf('day') : dayjs().subtract(6, 'day').startOf('day');
    const end = customEnd ? dayjs(customEnd).endOf('day') : todayEnd;
    return { start, end: end.isBefore(start) ? start.endOf('day') : end };
  }

  const minCreatedAt = orders.reduce((min, order) => {
    const createdAt = toMillis(order.createdAt);
    return createdAt > 0 ? Math.min(min, createdAt) : min;
  }, Number.POSITIVE_INFINITY);
  return {
    start: Number.isFinite(minCreatedAt) ? dayjs(minCreatedAt).startOf('day') : dayjs().startOf('day'),
    end: todayEnd,
  };
};

const filterOrdersByRange = (orders: Order[], range: RevenueRange, customStart: string, customEnd: string) => {
  const { start, end } = getRangeBounds(range, customStart, customEnd, orders);
  return orders.filter((order) => {
    const createdAt = toMillis(order.createdAt);
    return createdAt >= start.valueOf() && createdAt <= end.valueOf();
  });
};

const groupOrdersForChart = (orders: Order[], range: RevenueRange, customStart: string, customEnd: string) => {
  const { start, end } = getRangeBounds(range, customStart, customEnd, orders);
  const days = Math.max(1, end.diff(start, 'day') + 1);
  const useMonthlyBucket = days > 120;
  const bucketCount = useMonthlyBucket ? Math.max(1, end.diff(start, 'month') + 1) : days;

  return Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = useMonthlyBucket ? start.add(index, 'month').startOf('month') : start.add(index, 'day').startOf('day');
    const bucketEnd = useMonthlyBucket ? bucketStart.endOf('month') : bucketStart.endOf('day');
    const bucketOrders = orders.filter((order) => {
      if (!isRevenueRecognizedOrder(order)) return false;
      const createdAt = toMillis(order.createdAt);
      return createdAt >= bucketStart.valueOf() && createdAt <= bucketEnd.valueOf();
    });

    return {
      date: useMonthlyBucket ? bucketStart.format('MM/YYYY') : bucketStart.format('DD/MM'),
      dateFormatted: useMonthlyBucket ? bucketStart.format('MM/YYYY') : bucketStart.format('DD/MM/YYYY'),
      revenue: bucketOrders.reduce((sum, order) => sum + getOrderTotal(order), 0),
      profit: bucketOrders.reduce((sum, order) => sum + Number(order.totalProfit || 0), 0),
    };
  });
};

const calculateKPIs = (orders: Order[]) => {
  const completedOrders = orders.filter(isRevenueRecognizedOrder);
  const cancelledOrders = orders.filter((order) => toStatus(order.status) === 'CANCELLED');
  const totalRevenue = completedOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const totalProfit = completedOrders.reduce((sum, order) => sum + Number(order.totalProfit || 0), 0);
  const totalOrders = orders.length;
  const cancellationRate = totalOrders > 0 ? (cancelledOrders.length / totalOrders) * 100 : 0;
  return { totalRevenue, totalProfit, totalOrders, cancellationRate, completedCount: completedOrders.length, cancelledCount: cancelledOrders.length };
};

const getOrderStatusDistribution = (orders: Order[]) => {
  const pending = orders.filter((order) => ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'].includes(toStatus(order.status))).length;
  const shipping = orders.filter((order) => toStatus(order.status) === 'SHIPPING').length;
  const completed = orders.filter(isRevenueRecognizedOrder).length;
  const returning = orders.filter((order) => ['RETURN_PENDING', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURNING', 'REFUNDING'].includes(toStatus(order.status))).length;
  const refunded = orders.filter((order) => toStatus(order.status) === 'REFUNDED').length;
  const cancelled = orders.filter((order) => toStatus(order.status) === 'CANCELLED').length;
  return [
    { name: 'Chờ xử lý', value: pending, color: '#f59e0b' },
    { name: 'Đang giao', value: shipping, color: '#0ea5e9' },
    { name: 'Đã ghi nhận doanh thu', value: completed, color: '#10b981' },
    { name: 'Trả hàng/hoàn tiền', value: returning, color: '#8b5cf6' },
    { name: 'Đã hoàn tiền', value: refunded, color: '#64748b' },
    { name: 'Hủy đơn', value: cancelled, color: '#ef4444' },
  ];
};

const getTopSellingProducts = (products: Product[], limit = 5) =>
  [...products].sort((a, b) => Number(b.sold || 0) - Number(a.sold || 0)).slice(0, limit);

const getLowStockProducts = (products: Product[], threshold: number) =>
  products
    .filter((product) => product.isActive !== false && Number(product.stock || 0) <= threshold)
    .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));

function KPICard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <p className="text-2xl font-black text-slate-900 mt-2 truncate">{value}</p>
          {trend && <p className="text-xs text-emerald-600 font-semibold mt-2">{trend}</p>}
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">{icon}</div>
      </div>
    </div>
  );
}

function RangeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-xl px-4 text-sm font-black transition-colors ${
        active ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState<RevenueRange>('30D');
  const [customStart, setCustomStart] = useState(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
  const [customEnd, setCustomEnd] = useState(dayjs().format('YYYY-MM-DD'));
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  useEffect(() => {
    document.title = 'Trang chủ thống kê - Gunpla Store';
  }, []);

  useEffect(() => {
    let ordersLoaded = false;
    let productsLoaded = false;
    const stopLoadingIfReady = () => {
      if (ordersLoaded && productsLoaded) setIsLoading(false);
    };

    const unsubscribeOrders = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setOrders(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<Order, 'id'>) })) as Order[]);
        ordersLoaded = true;
        stopLoadingIfReady();
      },
      (error) => {
        console.error('Lỗi lấy realtime orders:', error);
        ordersLoaded = true;
        stopLoadingIfReady();
      }
    );

    const unsubscribeProducts = onSnapshot(
      query(collection(db, 'products')),
      (snapshot) => {
        setProducts(snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...(docSnapshot.data() as Omit<Product, 'id'>) })) as Product[]);
        productsLoaded = true;
        stopLoadingIfReady();
      },
      (error) => {
        console.error('Lỗi lấy realtime products:', error);
        productsLoaded = true;
        stopLoadingIfReady();
      }
    );

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, []);

  const filteredOrders = useMemo(() => filterOrdersByRange(orders, range, customStart, customEnd), [orders, range, customStart, customEnd]);
  const kpis = useMemo(() => calculateKPIs(filteredOrders), [filteredOrders]);
  const chartData = useMemo(() => groupOrdersForChart(filteredOrders, range, customStart, customEnd), [filteredOrders, range, customStart, customEnd]);
  const statusDistribution = useMemo(() => getOrderStatusDistribution(filteredOrders), [filteredOrders]);
  const topProducts = useMemo(() => getTopSellingProducts(products, 5), [products]);
  const lowStockProducts = useMemo(() => getLowStockProducts(products, lowStockThreshold), [products, lowStockThreshold]);

  const selectedRangeLabel = range === 'ALL' ? 'toàn bộ thời gian' : range === 'CUSTOM' ? `${dayjs(customStart).format('DD/MM/YYYY')} - ${dayjs(customEnd).format('DD/MM/YYYY')}` : `${range.replace('D', '')} ngày gần nhất`;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
        <p className="text-xs font-semibold text-slate-600 mb-1">{payload[0].payload.dateFormatted}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} className="text-xs font-semibold" style={{ color: entry.color }}>
            {entry.name}: {formatMoney(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-6 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-semibold animate-pulse">Đang đồng bộ dữ liệu realtime...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Dashboard thống kê</h1>
            <p className="mt-1 text-sm text-slate-600 font-medium">Doanh thu, lợi nhuận, đơn hàng và cảnh báo tồn kho theo khoảng thời gian.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <RangeButton active={range === '7D'} label="7 ngày" onClick={() => setRange('7D')} />
              <RangeButton active={range === '30D'} label="30 ngày" onClick={() => setRange('30D')} />
              <RangeButton active={range === '90D'} label="90 ngày" onClick={() => setRange('90D')} />
              <RangeButton active={range === 'ALL'} label="Toàn bộ" onClick={() => setRange('ALL')} />
              <RangeButton active={range === 'CUSTOM'} label="Tùy chỉnh" onClick={() => setRange('CUSTOM')} />
            </div>
            {range === 'CUSTOM' && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-400" />
                <span className="text-xs font-bold text-slate-400">đến</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-400" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Doanh thu" value={formatMoney(kpis.totalRevenue)} icon={<DollarSign size={24} />} trend={`Trong ${selectedRangeLabel}`} />
          <KPICard title="Lợi nhuận" value={formatMoney(kpis.totalProfit)} icon={<TrendingUp size={24} />} trend="Theo giá vốn lưu trong đơn" />
          <KPICard title="Tổng đơn" value={kpis.totalOrders} icon={<BarChart3 size={24} />} trend={`${kpis.completedCount} đơn đã ghi nhận doanh thu`} />
          <KPICard title="Tỉ lệ hủy" value={`${kpis.cancellationRate.toFixed(1)}%`} icon={<Zap size={24} />} trend={`${kpis.cancelledCount} đơn bị hủy`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-black text-slate-900">Doanh thu & lợi nhuận</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                <CalendarDays size={14} /> {selectedRangeLabel}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={330}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px', fontWeight: 600 }} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px', fontWeight: 600 }} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `${Number(val) / 1000000}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 600, paddingTop: '10px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Doanh thu" activeDot={{ r: 6, strokeWidth: 0 }} />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" name="Lợi nhuận" activeDot={{ r: 6, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
            <h2 className="text-lg font-black text-slate-900 mb-4">Trạng thái đơn hàng</h2>
            <div className="flex-1 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusDistribution.filter((item) => item.value > 0)} cx="50%" cy="50%" innerRadius={60} outerRadius={88} paddingAngle={3} dataKey="value" stroke="none">
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `${value} đơn`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-6 space-y-3 px-2">
                {statusDistribution.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-slate-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={20} /> Top sản phẩm bán chạy
            </h2>
            <div className="space-y-3">
              {topProducts.length === 0 ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center text-sm font-semibold text-slate-500">Chưa có dữ liệu sản phẩm.</div>
              ) : (
                topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">#{index + 1}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">{formatMoney(product.price)}</p>
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap ml-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                      <p className="text-sm font-black text-slate-900">{Number(product.sold || 0)}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Đã bán</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-rose-500" />
                <h2 className="text-lg font-black text-slate-900">Cảnh báo tồn kho thấp</h2>
              </div>
              <select
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400"
              >
                <option value={5}>Dưới hoặc bằng 5</option>
                <option value={10}>Dưới hoặc bằng 10</option>
                <option value={20}>Dưới hoặc bằng 20</option>
              </select>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-6 flex flex-col items-center justify-center text-center min-h-[280px]">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-base font-bold text-emerald-800">Tồn kho ổn định</p>
                <p className="text-xs font-medium text-emerald-600 mt-1">Không có sản phẩm active nào dưới ngưỡng đã chọn.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-2">
                {lowStockProducts.map((product) => {
                  const stock = Number(product.stock || 0);
                  const image = product.images?.[0] || product.imageUrl || '';
                  const tone = stock === 0 ? 'rose' : stock <= 5 ? 'orange' : 'amber';
                  const progress = Math.min(100, Math.max(0, (stock / lowStockThreshold) * 100));
                  return (
                    <div key={product.id} className={`rounded-2xl border p-3 ${tone === 'rose' ? 'bg-rose-50 border-rose-200' : tone === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        {image ? (
                          <img src={image} alt={product.name} className="h-14 w-14 rounded-xl object-cover border border-white/80 bg-white shrink-0" />
                        ) : (
                          <div className="h-14 w-14 rounded-xl bg-white border border-slate-200 grid place-items-center text-slate-400 shrink-0">
                            <Package size={22} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 truncate text-sm">{product.name}</p>
                              <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate">{product.sku || product.category || product.id}</p>
                            </div>
                            <div className={`shrink-0 px-3 py-1.5 rounded-lg font-black text-xs ${stock === 0 ? 'bg-rose-100 text-rose-700' : stock <= 5 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                              {stock} hộp
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-white/80 overflow-hidden">
                            <div className={`h-full rounded-full ${stock === 0 ? 'bg-rose-500' : stock <= 5 ? 'bg-orange-500' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center py-6 gap-2 opacity-60">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">Realtime Firebase - cập nhật lúc {dayjs().format('HH:mm')}</p>
        </div>
      </div>
    </div>
  );
}
