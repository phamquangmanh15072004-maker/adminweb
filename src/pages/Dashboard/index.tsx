import { useMemo, useEffect, useState } from 'react';
import { BarChart3, DollarSign, TrendingUp, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

dayjs.extend(relativeTime);
dayjs.locale('vi');

// ============= Types =============
type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED';

interface Order {
  id: string;
  totalPrice: number;
  totalProfit: number;
  status: OrderStatus;
  createdAt: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  sold: number;
  stock: number;
}

// ============= Helper Functions (Business Logic) =============

/**
 * Format tiền tệ VN Đồng
 */
const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);

/**
 * Nhóm orders theo ngày trong 7 ngày gần nhất
 */
const groupOrdersByDateLast7Days = (orders: Order[]) => {
  const data: Array<{
    date: string;
    dateFormatted: string;
    revenue: number;
    profit: number;
  }> = [];

  for (let i = 6; i >= 0; i--) {
    const date = dayjs().subtract(i, 'days').startOf('day');
    const dateStr = date.format('YYYY-MM-DD');
    const dayLabel = date.format('DD/MM');

    const dayOrders = orders.filter(
      (order) =>
        order.status === 'COMPLETED' &&
        dayjs(order.createdAt).startOf('day').format('YYYY-MM-DD') === dateStr
    );

    const revenue = dayOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
    const profit = dayOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);

    data.push({ date: dayLabel, dateFormatted: dayLabel, revenue, profit });
  }

  return data;
};

/**
 * Tính KPI tổng quan từ orders
 */
const calculateKPIs = (orders: Order[]) => {
  const completedOrders = orders.filter((order) => order.status === 'COMPLETED');
  const cancelledOrders = orders.filter((order) => order.status === 'CANCELLED');

  const totalRevenue = completedOrders.reduce((sum, order) => sum + (order.totalPrice || 0), 0);
  const totalProfit = completedOrders.reduce((sum, order) => sum + (order.totalProfit || 0), 0);
  const totalOrders = orders.length;
  const cancellationRate = totalOrders > 0 ? (cancelledOrders.length / totalOrders) * 100 : 0;

  return {
    totalRevenue,
    totalProfit,
    totalOrders,
    cancellationRate,
  };
};

/**
 * Tính tỉ trọng trạng thái đơn hàng
 */
const getOrderStatusDistribution = (orders: Order[]) => {
  const pending = orders.filter((order) => order.status === 'PENDING').length;
  const completed = orders.filter((order) => order.status === 'COMPLETED').length;
  const cancelled = orders.filter((order) => order.status === 'CANCELLED').length;

  return [
    { name: 'Chờ xử lý', value: pending, color: '#f59e0b' },
    { name: 'Hoàn thành', value: completed, color: '#10b981' },
    { name: 'Hủy đơn', value: cancelled, color: '#ef4444' },
  ];
};

/**
 * Lấy top 5 sản phẩm bán chạy nhất
 */
const getTopSellingProducts = (products: Product[], limit: number = 5) => {
  return [...products].sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, limit);
};

/**
 * Lấy sản phẩm tồn kho thấp (< 10)
 */
const getLowStockProducts = (products: Product[]) => {
  return products.filter((product) => (product.stock || 0) < 10).sort((a, b) => (a.stock || 0) - (b.stock || 0));
};

// ============= KPI Card Component =============
function KPICard({
  title,
  value,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <p className="text-2xl font-black text-slate-900 mt-2">{value}</p>
          {trend && <p className="text-xs text-emerald-600 font-semibold mt-2">{trend}</p>}
        </div>
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">{Icon}</div>
      </div>
    </div>
  );
}

// ============= Main Dashboard Component =============
export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.title = "Trang Chủ Thống Kê - Gunpla Store";
  }, []);

  // ========== Lắng nghe dữ liệu Realtime từ Firebase ==========
  useEffect(() => {
    let ordersLoaded = false;
    let productsLoaded = false;

    const stopLoadingIfReady = () => {
      if (ordersLoaded && productsLoaded) {
        setIsLoading(false);
      }
    };

    // Truy vấn Orders: Sắp xếp mới nhất lên đầu để tính toán chính xác
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      try {
        const mappedOrders = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Omit<Order, 'id'>),
        })) as Order[];
        setOrders(mappedOrders);
      } catch (error) {
        console.error("Lỗi parse dữ liệu Orders:", error);
      } finally {
        ordersLoaded = true;
        stopLoadingIfReady();
      }
    }, (error) => {
      console.error("Lỗi lấy Realtime Orders:", error);
      ordersLoaded = true; stopLoadingIfReady();
    });

    // Truy vấn Products
    const productsQuery = query(collection(db, 'products'));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      try {
        const mappedProducts = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...(docSnapshot.data() as Omit<Product, 'id'>),
        })) as Product[];
        setProducts(mappedProducts);
      } catch (error) {
        console.error("Lỗi parse dữ liệu Products:", error);
      } finally {
        productsLoaded = true;
        stopLoadingIfReady();
      }
    }, (error) => {
      console.error("Lỗi lấy Realtime Products:", error);
      productsLoaded = true; stopLoadingIfReady();
    });

    // Cleanup memory chống rò rỉ (Memory Leak)
    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
    };
  }, []);

  // ========== Tối ưu hóa tính toán bằng useMemo ==========
  const kpis = useMemo(() => calculateKPIs(orders), [orders]);
  const chartData = useMemo(() => groupOrdersByDateLast7Days(orders), [orders]);
  const statusDistribution = useMemo(() => getOrderStatusDistribution(orders), [orders]);
  const topProducts = useMemo(() => getTopSellingProducts(products, 5), [products]);
  const lowStockProducts = useMemo(() => getLowStockProducts(products), [products]);

  // Custom Tooltip cho AreaChart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-1">{payload[0].payload.dateFormatted}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs font-semibold" style={{ color: entry.color }}>
              {entry.name}: {formatMoney(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-6 flex flex-col items-center justify-center">
         <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
         <p className="text-slate-500 font-semibold animate-pulse">Đang đồng bộ dữ liệu Realtime...</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* ========== Header ========== */}
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Dashboard Thống kê</h1>
          <p className="mt-1 text-sm text-slate-600 font-medium">
            Tổng quan doanh số và hiệu suất bán hàng của cửa hàng Gunpla
          </p>
        </div>

        {/* ========== Row 1: KPI Cards ========== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Tổng Doanh Thu"
            value={formatMoney(kpis.totalRevenue)}
            icon={<DollarSign size={24} />}
            trend="Từ các đơn đã giao thành công"
          />
          <KPICard
            title="Lợi Nhuận Ròng"
            value={formatMoney(kpis.totalProfit)}
            icon={<TrendingUp size={24} />}
            trend="Margin (Sau khi trừ giá vốn)"
          />
          <KPICard
            title="Tổng Đơn Hàng"
            value={kpis.totalOrders}
            icon={<BarChart3 size={24} />}
            trend={`${orders.filter((o) => o.status === 'COMPLETED').length} đơn đã hoàn thành`}
          />
          <KPICard
            title="Tỉ lệ Hủy Đơn"
            value={`${kpis.cancellationRate.toFixed(1)}%`}
            icon={<Zap size={24} />}
            trend={`${orders.filter((o) => o.status === 'CANCELLED').length} đơn bị hủy/bom hàng`}
          />
        </div>

        {/* ========== Row 2: Charts ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AreaChart - 2/3 chiều rộng */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-black text-slate-900 mb-4">Doanh Thu & Lợi Nhuận (7 ngày gần nhất)</h2>
            <ResponsiveContainer width="100%" height={320}>
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
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px', fontWeight: 600 }} tickLine={false} axisLine={false} dx={-10} tickFormatter={(val) => `${val / 1000000}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '13px', fontWeight: 600, paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Doanh Thu"
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                  name="Lợi Nhuận"
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* PieChart - 1/3 chiều rộng */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col">
            <h2 className="text-lg font-black text-slate-900 mb-4">Trạng Thái Đơn Hàng</h2>
            <div className="flex-1 flex flex-col justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => `${value} đơn`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-6 space-y-3 px-2">
                {statusDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-slate-600">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ========== Row 3: Insights ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <TrendingUp className="text-blue-500" size={20} /> Top 5 Sản Phẩm Bán Chạy
            </h2>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                      <p className="text-xs font-semibold text-slate-500 mt-0.5">{formatMoney(product.price)}</p>
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap ml-3 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <p className="text-sm font-black text-slate-900">{product.sold}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Đã bán</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={20} className="text-rose-500" />
              <h2 className="text-lg font-black text-slate-900">Cảnh Báo Tồn Kho Thấp</h2>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-6 flex flex-col items-center justify-center text-center h-[280px]">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-base font-bold text-emerald-800">Tồn kho ổn định</p>
                <p className="text-xs font-medium text-emerald-600 mt-1">Không có sản phẩm nào dưới 10 chiếc</p>
              </div>
            ) : (
              <div className="space-y-3 h-[280px] overflow-y-auto custom-scrollbar pr-2">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className={`p-3.5 rounded-xl border ${product.stock === 0 ? 'bg-rose-50 border-rose-200' : product.stock < 5 ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate text-sm">{product.name}</p>
                        <p className="text-xs font-semibold text-slate-600 mt-1">ID: {product.id}</p>
                      </div>
                      <div className={`shrink-0 px-3 py-1.5 rounded-lg font-black text-xs ${product.stock === 0 ? 'bg-rose-100 text-rose-700' : product.stock < 5 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                        {product.stock} hộp
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ========== Footer Doanh Nghiệp ==========  */}
        <div className="flex items-center justify-center py-6 gap-2 opacity-60">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
           <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">
             Hệ thống đồng bộ Realtime từ Firebase • Cập nhật lúc {dayjs().format('HH:mm')}
           </p>
        </div>

      </div>
    </div>
  );
}