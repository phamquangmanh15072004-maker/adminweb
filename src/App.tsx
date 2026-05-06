import { LayoutGrid, ChevronRight, LogOut, Package, ShoppingCart, Users, ArrowRight, ArrowLeft, MessageCircle, TicketPercent, FileText, TrendingUp, Star, MonitorPlay } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useState, type ReactElement } from 'react';
import ProductsPage from './pages/Products';
import { Toaster, ToastBar, toast } from 'react-hot-toast';
import { subscribeProducts } from './services/productService';
import OrdersPage from './pages/Orders/index';
import ChatPage from './pages/Chat';
import UsersPage from './pages/Users/index';
import VouchersPage from './pages/Vouchers';
import PostsPage from './pages/Posts';
import DashboardPage from './pages/Dashboard';
import NotificationBell from './components/NotificationBell';
// Thêm MonitorPlay vào danh sách import lucide-react hiện có của bạn
// Import Component BannerManagerModal (Đảm bảo đường dẫn file đúng với project của bạn)
import BannerManagerModal from './pages/Banner/index';
// 🌟 THÊM IMPORT FIREBASE ĐỂ LÀM TRẠM GÁC
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase'; 

// Lazy load các trang
const ProductDetail = lazy(() => import('./pages/Products/ProductDetail'));
const Login = lazy(() => import('./pages/login')); 
const NotificationsPage = lazy(() => import('./pages/Notifications'));
const ReviewsPage = lazy(() => import('./pages/Reviews'));
// ============================================================================
// 🛡️ TRẠM GÁC BẢO MẬT (PROTECTED ROUTE) - CHECK QUYỀN ĐA TẦNG
// ============================================================================
const ProtectedRoute = ({ children }: { children: ReactElement }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [hasShownForceLogoutToast, setHasShownForceLogoutToast] = useState(false);

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (user) {
        try {
          const initialDoc = await getDoc(doc(db, 'users', user.uid));
          const initialData = initialDoc.exists() ? initialDoc.data() : {};
          const sessionForceLogoutAt = Number(initialData.forceLogoutAt || 0);

          unsubscribeUserDoc = onSnapshot(doc(db, 'users', user.uid), async (userSnapshot) => {
            if (!userSnapshot.exists()) {
              setIsAuthorized(false);
              setIsChecking(false);
              return;
            }

            const userData = userSnapshot.data();
            const allowedRoles = ['ADMIN', 'INVENTORY', 'STAFF'];
            const normalizedRole = String(userData.role || '').toUpperCase();
            const currentForceLogoutAt = Number(userData.forceLogoutAt || 0);

            if (currentForceLogoutAt > sessionForceLogoutAt) {
              if (!hasShownForceLogoutToast) {
                toast.error('Quyền truy cập đã thay đổi. Vui lòng đăng nhập lại.');
                setHasShownForceLogoutToast(true);
              }
              await signOut(auth);
              setIsAuthorized(false);
              setIsChecking(false);
              return;
            }

            if (allowedRoles.includes(normalizedRole) && !userData.isLocked) {
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
            }

            setIsChecking(false);
          });
        } catch (error) {
          console.error("Lỗi xác thực:", error);
          setIsAuthorized(false);
          setIsChecking(false);
        }
      } else {
        setIsAuthorized(false);
        setHasShownForceLogoutToast(false);
        setIsChecking(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-blue-400 font-bold tracking-widest uppercase text-xs animate-pulse">Đang kiểm tra quyền truy cập...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

type ModuleCard = {
  title: string;
  subtitle: string;
  path: string;
  icon: ReactElement;
  accent: string;
};

type RecentModule = {
  path: string;
  title: string;
  visitedAt: number;
};

const RECENT_MODULES_KEY = 'admin_recent_modules';

const moduleTitleByPath: Record<string, string> = {
  '/dashboard': 'Bản điều khiển',
  '/stats': 'Thống kê kế toán',
  '/products': 'Quản lý kho',
  '/orders': 'Đơn hàng',
  '/chat': 'Chăm sóc khách hàng',
  '/users': 'Quản lý người dùng',
  '/notifications': 'Trung tâm thông báo',
  '/posts': 'Quản lý bài đăng',
  '/vouchers': 'Khuyến mãi',
  '/reviews': 'Quản lý Đánh giá' // 🌟 THAY THẾ SETTINGS BẰNG REVIEWS
};

const moduleCards: ModuleCard[] = [
  {
    title: 'Thống kê Kế toán',
    subtitle: 'Theo dõi doanh thu, lợi nhuận, trạng thái đơn hàng và sản phẩm bán chạy.',
    path: '/stats',
    icon: <TrendingUp className="w-6 h-6" />,
    accent: 'from-indigo-600 to-purple-500'
  },
  {
    title: 'Quản lý kho',
    subtitle: 'Theo dõi tồn kho, chỉnh sửa thông tin và vận hành danh mục sản phẩm.',
    path: '/products',
    icon: <Package className="w-6 h-6" />,
    accent: 'from-blue-600 to-cyan-500'
  },
  {
    title: 'Đơn hàng',
    subtitle: 'Kiểm soát trạng thái đơn, xử lý vận chuyển và thống kê doanh số.',
    path: '/orders',
    icon: <ShoppingCart className="w-6 h-6" />,
    accent: 'from-emerald-600 to-teal-500'
  },
  {
    title: 'CSKH Chat',
    subtitle: 'Theo dõi hội thoại thời gian thực, xử lý hoàn tiền và phản hồi khách nhanh chóng.',
    path: '/chat',
    icon: <MessageCircle className="w-6 h-6" />,
    accent: 'from-sky-600 to-blue-500'
  },
  {
    title: 'Quản lý người dùng',
    subtitle: 'Cấp quyền truy cập, khóa tài khoản và quản lý quyền hề thống.',
    path: '/users',
    icon: <Users className="w-6 h-6" />,
    accent: 'from-violet-600 to-purple-500'
  },
  {
    title: 'Quản lý bài đăng',
    subtitle: 'Duyệt bài, ẩn nội dung vi phạm và theo dõi tiến trình kiểm duyệt theo thời gian thực.',
    path: '/posts',
    icon: <FileText className="w-6 h-6" />,
    accent: 'from-teal-600 to-cyan-500'
  },
  {
    title: 'Khuyến mãi',
    subtitle: 'Tạo voucher, hẹn giờ chạy tự động và theo dõi hiệu suất sử dụng mã.',
    path: '/vouchers',
    icon: <TicketPercent className="w-6 h-6" />,
    accent: 'from-rose-600 to-orange-500'
  },
  {
    title: 'Quản lý Đánh giá', // 🌟 CẬP NHẬT CARD NÀY
    subtitle: 'Đọc, theo dõi sức khỏe thương hiệu và phản hồi đánh giá của khách hàng.',
    path: '/reviews',
    icon: <Star className="w-6 h-6" />, // 🌟 ICON NGÔI SAO
    accent: 'from-amber-400 to-orange-500' // 🌟 MÀU VÀNG CAM ĐẶC TRƯNG CỦA REVIEW
  }
];

function DashboardHub() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [recentModules, setRecentModules] = useState<RecentModule[]>([]);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  useEffect(() => {
    const unsubscribe = subscribeProducts((data) => setProducts(data));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_MODULES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RecentModule[];
      if (Array.isArray(parsed)) {
        setRecentModules(parsed.slice(0, 4));
      }
    } catch {
      setRecentModules([]);
    }
  }, []);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((item) => Boolean(item.isActive)).length;
    const has3D = products.filter((item) => Boolean(item.has3D || String(item.model3DUrl || '').trim())).length;
    const lowStock = products.filter((item) => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= 5).length;
    return { total, active, has3D, lowStock };
  }, [products]);

  const rememberModule = (path: string) => {
    const title = moduleTitleByPath[path];
    if (!title) return;

    const nextItem: RecentModule = { path, title, visitedAt: Date.now() };
    const merged = [nextItem, ...recentModules.filter((item) => item.path !== path)].slice(0, 4);
    setRecentModules(merged);
    localStorage.setItem(RECENT_MODULES_KEY, JSON.stringify(merged));
  };

  const handleGoModule = (path: string) => {
    rememberModule(path);
    navigate(path);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 backdrop-blur-xl p-6 sm:p-7 shadow-[0_18px_50px_rgba(30,41,59,0.08)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          
          {/* Cụm Text bên trái */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-blue-500 font-black">Trung tâm điều khiển</p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Dashboard vận hành GunplaStore</h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
              Chọn một module để xử lý nhanh tác vụ theo đúng nghiệp vụ. Thiết kế tập trung theo dashboard giúp thao tác trực quan, dễ nhớ và không bị rối điều hướng.
            </p>
          </div>

          {/* NÚT BẤM GỌI MODAL BÊN PHẢI */}
          <button
            onClick={() => setIsBannerModalOpen(true)}
            className="group flex items-center gap-2.5 px-5 py-3 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-bold text-sm transition-all duration-300 shadow-[0_10px_20px_rgba(15,23,42,0.15)] hover:shadow-[0_10px_25px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 shrink-0"
          >
            <MonitorPlay className="w-5 h-5 text-blue-400 group-hover:text-white transition-colors" />
            <span>Cập nhật Banner App</span>
          </button>
          
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Tổng sản phẩm</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Đang mở bán</p>
            <p className="mt-2 text-2xl font-black text-emerald-600">{stats.active}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Có mô hình 3D</p>
            <p className="mt-2 text-2xl font-black text-indigo-600">{stats.has3D}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Sắp hết hàng</p>
            <p className="mt-2 text-2xl font-black text-amber-600">{stats.lowStock}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {moduleCards.map((item, index) => (
            <button
              key={item.path}
              type="button"
              onClick={() => handleGoModule(item.path)}
              className="group text-left rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_35px_rgba(15,23,42,0.06)] hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_24px_55px_rgba(37,99,235,0.14)] transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-3"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.accent} text-white flex items-center justify-center shadow-lg`}>
                  {item.icon}
                </div>
                <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
              <h2 className="mt-5 text-xl font-black text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.subtitle}</p>
            </button>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200/70 bg-white p-5 sm:p-6 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base sm:text-lg font-black text-slate-900">Truy cập gần đây</h3>
            <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Quick Resume</span>
          </div>
          {recentModules.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Bạn chưa truy cập module nào gần đây. Hãy chọn một card ở trên để bắt đầu.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recentModules.map((item) => (
                <button
                  key={`${item.path}-${item.visitedAt}`}
                  type="button"
                  onClick={() => handleGoModule(item.path)}
                  className="text-left rounded-2xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 px-4 py-3 transition-all cursor-pointer"
                >
                  <p className="text-sm font-bold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.visitedAt).toLocaleString('vi-VN')}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      {/* 🌟 THÊM ĐÚNG 4 DÒNG NÀY VÀO ĐÂY */}
      <BannerManagerModal 
        isOpen={isBannerModalOpen} 
        onClose={() => setIsBannerModalOpen(false)} 
      />
    </div>
  );
}

// ============================================================================
// 🌟 COMPONENT LAYOUT: Header + Dashboard Flow
// ============================================================================
function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    role: string;
    avatarUrl?: string;
  } | null>(null);

  const roleMetaByRole: Record<string, { label: string; className: string }> = {
    ADMIN: { label: 'Quản trị viên cấp cao', className: 'text-purple-600' },
    INVENTORY: { label: 'Thủ kho vận hành', className: 'text-orange-600' },
    STAFF: { label: 'Nhân viên CSKH', className: 'text-cyan-600' },
  };

  const normalizedRole = String(currentUser?.role || '').toUpperCase();
  const roleMeta =
    roleMetaByRole[normalizedRole] ||
    ({ label: 'Tài khoản nội bộ', className: 'text-slate-500' } as const);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.exists() ? userDoc.data() : {};

        setCurrentUser({
          id: user.uid,
          name: String(data.name || user.displayName || 'Tài khoản quản trị'),
          role: String(data.role || '').toUpperCase(),
          avatarUrl: String(data.avatarUrl || '').trim() || undefined,
        });
      } catch (error) {
        console.error('Load current user error:', error);
        setCurrentUser({
          id: user.uid,
          name: String(user.displayName || 'Tài khoản quản trị'),
          role: '',
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const title = moduleTitleByPath[location.pathname];
    if (!title) return;

    const current: RecentModule = {
      path: location.pathname,
      title,
      visitedAt: Date.now(),
    };

    try {
      const raw = localStorage.getItem(RECENT_MODULES_KEY);
      const parsed = raw ? (JSON.parse(raw) as RecentModule[]) : [];
      const merged = [current, ...parsed.filter((item) => item.path !== current.path)].slice(0, 4);
      localStorage.setItem(RECENT_MODULES_KEY, JSON.stringify(merged));
    } catch {
      localStorage.setItem(RECENT_MODULES_KEY, JSON.stringify([current]));
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Đã đăng xuất an toàn!");
    } catch (error) {
      toast.error("Lỗi đăng xuất!");
    }
  };

  // Xác định Tab đang active
  const currentPath = location.pathname;
  let activeTab = 'dashboard';
  if (currentPath.includes('/products')) activeTab = 'products';
  if (currentPath.includes('/orders')) activeTab = 'orders';
  if (currentPath.includes('/chat')) activeTab = 'chat';
  if (currentPath.includes('/users')) activeTab = 'users';
  if (currentPath.includes('/notifications')) activeTab = 'notifications';
  if (currentPath.includes('/posts')) activeTab = 'posts';
  if (currentPath.includes('/vouchers')) activeTab = 'vouchers';
  if (currentPath.includes('/stats')) activeTab = 'stats';
  if (currentPath.includes('/reviews')) activeTab = 'reviews'; // 🌟 THÊM TAB REVIEWS

  const getTabTitle = (tab: string) => {
    const titles: Record<string, string> = {
      'products': 'Quản lý kho Gunpla',
      'orders': 'Danh sách đơn hàng',
      'chat': 'Trung tâm CSKH Chat',
      'users': 'Quản lý người dùng',
      'notifications': 'Trung tâm thông báo',
      'posts': 'Quản lý bài đăng',
      'vouchers': 'Quản lý khuyến mãi',
      'stats': 'Thống kê & Phân tích KPI',
      'reviews': 'Quản lý Đánh giá', // 🌟 THÊM TITLE
      'dashboard': 'Tổng quan hệ thống'
    };
    return titles[tab] || tab;
  };

  const isDashboardPage = activeTab === 'dashboard';

  const handleBack = () => {
    if (currentPath.startsWith('/products/')) {
      navigate('/products', { replace: true });
      return;
    }

    if (currentPath !== '/dashboard') {
      navigate('/dashboard', { replace: true });
    }
  };

  return (
    <div className="h-screen bg-transparent font-sans text-gray-900 overflow-hidden">
      <main className="h-full flex flex-col min-w-0 bg-transparent">
        <header className="h-16 bg-white/70 backdrop-blur-xl border-b border-white/60 flex items-center justify-between px-5 lg:px-6 sticky top-0 z-30 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-2 text-gray-400">
               {!isDashboardPage && (
                 <button
                   type="button"
                   onClick={handleBack}
                   className="inline-flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-wider text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all cursor-pointer"
                 >
                   <ArrowLeft className="w-3.5 h-3.5" />
                   Back
                 </button>
               )}
               <LayoutGrid className="w-4 h-4" />
               <ChevronRight className="w-4 h-4" />
               <h2 className="text-sm font-black text-blue-600 uppercase tracking-[0.18em]">
                 {getTabTitle(activeTab)}
               </h2>
            </div>

            <div className="flex items-center gap-4">
              <NotificationBell currentUserRole={normalizedRole} currentUserId={currentUser?.id || ''} />
              
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200/80">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-black text-slate-800 leading-none truncate max-w-[170px]">{currentUser?.name || 'Tài khoản quản trị'}</p>
                  <p className={`text-[10px] font-bold mt-1 uppercase ${roleMeta.className}`}>{roleMeta.label}</p>
                </div>
                
                <button 
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="relative w-10 h-10 bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 ring-2 ring-white hover:scale-105 hover:shadow-blue-400 transition-all cursor-pointer group overflow-hidden"
                >
                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt={currentUser.name || 'Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-black">{(currentUser?.name || 'A').charAt(0).toUpperCase()}</span>
                  )}
                  <span className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/40 transition-colors" />
                  <LogOut className="absolute w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
        </header>

        <div className="flex-1 min-h-0 relative">
           <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardHub />} />
              <Route path="/stats" element={<div className="h-full min-h-0 overflow-y-auto custom-scrollbar"><DashboardPage /></div>} />
              <Route path="/products" element={<div className="h-full min-h-0 overflow-y-auto custom-scrollbar"><ProductsPage /></div>} />
              <Route path="/orders" element={<div className="h-full min-h-0 overflow-y-auto custom-scrollbar"><OrdersPage /></div>} />
              <Route path="/chat" element={<div className="h-full min-h-0 overflow-hidden"><ChatPage /></div>} />
              <Route path="/users" element={<div className="h-full min-h-0 overflow-y-auto custom-scrollbar"><UsersPage /></div>} />
              <Route path="/notifications" element={<div className="h-full min-h-0 overflow-y-auto custom-scrollbar"><NotificationsPage /></div>} />
              <Route path="/posts" element={<div className="h-full min-h-0 overflow-y-auto custom-scrollbar"><PostsPage /></div>} />
              <Route path="/vouchers" element={<div className="h-full min-h-0 overflow-y-auto custom-scrollbar"><VouchersPage /></div>} />
              
              {/* 🌟 ROUTE QUẢN LÝ ĐÁNH GIÁ MỚI */}
              <Route path="/reviews" element={<div className="h-full min-h-0 overflow-y-auto custom-scrollbar"><ReviewsPage /></div>} />
              
              <Route path="/customers" element={<UnderConstruction title="Khách hàng" />} />
           </Routes>
        </div>
      </main>
    </div>
  );
}

// Màn hình chờ
const UnderConstruction = ({ title }: { title: string }) => (
  <div className="h-full p-4 sm:p-6 lg:p-8">
    <div className="w-full h-full rounded-3xl border border-slate-200 bg-white/80 backdrop-blur-xl shadow-[0_20px_60px_rgba(15,23,42,0.08)] flex flex-col items-center justify-center text-slate-400">
      <div className="p-4 bg-slate-50 rounded-2xl mb-4 border border-slate-200">
        <LayoutGrid className="w-12 h-12 text-slate-200" />
      </div>
      <span className="text-lg font-bold text-slate-300 uppercase tracking-widest text-center px-4">
        Tính năng <span className="text-blue-500">{title}</span> đang phát triển
      </span>
    </div>
  </div>
);

// ============================================================================
// 🌟 HẠT NHÂN CỦA ỨNG DỤNG BỌC TRONG BROWSER ROUTER
// ============================================================================
export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-bold uppercase tracking-widest text-xs animate-pulse">Đang tải hệ thống...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/products/new" element={ <ProtectedRoute><ProductDetail /></ProtectedRoute> } />
          <Route path="/products/:id" element={ <ProtectedRoute><ProductDetail /></ProtectedRoute> } />
          <Route path="/*" element={ <ProtectedRoute><AdminLayout /></ProtectedRoute> } />
        </Routes>
      </Suspense>
      
      <Toaster position="top-center" reverseOrder={false} gutter={8} containerStyle={{ top: 10 }} toastOptions={{ duration: 2800 }}>
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-md">
                <span>{icon}</span>
                <span className="text-sm font-semibold text-slate-700">{message}</span>
                <button type="button" onClick={() => toast.dismiss(t.id)} className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer">
                  x
                </button>
              </div>
            )}
          </ToastBar>
        )}
      </Toaster>
    </BrowserRouter>
  );
}