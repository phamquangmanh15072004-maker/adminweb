import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Bell, CheckCheck, Filter, Inbox, Loader2, Search, Package, ShoppingCart, Settings2, CircleDot } from 'lucide-react';
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

type NotificationType = 'ORDER' | 'INVENTORY' | 'CHAT' | 'SYSTEM' | 'PROMO' | string;

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type?: NotificationType;
  targetId?: string;
  targetRoles: string[];
  readBy: string[];
  createdAt: number;
};

type FilterType = 'ALL' | 'ORDER' | 'INVENTORY' | 'SYSTEM';

const TAB_OPTIONS: Array<{ value: FilterType; label: string; icon: ReactNode }> = [
  { value: 'ALL', label: 'Tất cả', icon: <Filter className="w-4 h-4" /> },
  { value: 'ORDER', label: 'Đơn hàng', icon: <ShoppingCart className="w-4 h-4" /> },
  { value: 'INVENTORY', label: 'Kho hàng', icon: <Package className="w-4 h-4" /> },
  { value: 'SYSTEM', label: 'Hệ thống', icon: <Settings2 className="w-4 h-4" /> },
];

const formatRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return new Date(timestamp).toLocaleString('vi-VN');
};

const isUnreadForUser = (notification: NotificationItem, userId: string) => !notification.readBy.includes(userId);

const getTypeBadgeClasses = (type?: NotificationType) => {
  switch (String(type || '').toUpperCase()) {
    case 'ORDER':
      return 'bg-emerald-100 text-emerald-700';
    case 'INVENTORY':
      return 'bg-orange-100 text-orange-700';
    case 'CHAT':
      return 'bg-blue-100 text-blue-700';
    case 'SYSTEM':
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const currentUserId = String(currentUser?.uid || '').trim();
  const currentUserRole = String(currentUser?.role || '').toUpperCase();
  useEffect(() => {
    document.title = "Thông Báo - Gunpla Store";
  }, []);
  useEffect(() => {
    if (!currentUserRole) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('targetRoles', 'array-contains', currentUserRole),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: NotificationItem[] = snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            title: String(data.title || ''),
            message: String(data.message || ''),
            type: String(data.type || '').trim() || undefined,
            targetId: String(data.targetId || '').trim() || undefined,
            targetRoles: Array.isArray(data.targetRoles) ? data.targetRoles.map((role: any) => String(role)) : [],
            readBy: Array.isArray(data.readBy) ? data.readBy.map((value: any) => String(value)) : [],
            createdAt: Number(data.createdAt || 0),
          };
        });

        setNotifications(items);
        setIsLoading(false);
      },
      (error) => {
        console.error('Load notifications error:', error);
        toast.error('Không thể tải danh sách thông báo');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUserRole]);

  const filteredNotifications = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return notifications.filter((notification) => {
      const type = String(notification.type || '').toUpperCase();
      const matchType =
        activeFilter === 'ALL' ||
        (activeFilter === 'ORDER' && type === 'ORDER') ||
        (activeFilter === 'INVENTORY' && type === 'INVENTORY') ||
        (activeFilter === 'SYSTEM' && type === 'SYSTEM') ||
        (activeFilter === 'SYSTEM' && type === 'PROMO');

      const searchable = `${notification.title} ${notification.message}`.toLowerCase();
      const matchKeyword = !keyword || searchable.includes(keyword);

      return matchType && matchKeyword;
    });
  }, [activeFilter, notifications, searchTerm]);

  const unreadCount = useMemo(() => {
    return notifications.filter((notification) => isUnreadForUser(notification, currentUserId)).length;
  }, [currentUserId, notifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!currentUserId) return;
    await updateDoc(doc(db, 'notifications', notificationId), {
      readBy: arrayUnion(currentUserId),
    });
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    void handleMarkAsRead(notification.id);

    switch (notification.type) {
      case 'ORDER':
        navigate(notification.targetId ? `/orders?search=${notification.targetId}` : '/orders');
        break;
      case 'INVENTORY':
        navigate(notification.targetId ? `/products?search=${notification.targetId}` : '/products');
        break;
      case 'CHAT':
        navigate(notification.targetId ? `/chat?userId=${notification.targetId}` : '/chat');
        break;
      default:
        break;
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUserId) return;

    const unreadItems = notifications.filter((notification) => isUnreadForUser(notification, currentUserId));
    if (unreadItems.length === 0) {
      toast('Không có thông báo chưa đọc', { duration: 1500 });
      return;
    }

    try {
      await Promise.all(
        unreadItems.map((notification) =>
          updateDoc(doc(db, 'notifications', notification.id), {
            readBy: arrayUnion(currentUserId),
          })
        )
      );
      toast.success('Đã đánh dấu tất cả là đã đọc');
    } catch (error) {
      console.error('Mark all notifications error:', error);
      toast.error('Không thể cập nhật thông báo');
    }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-3xl border border-slate-200/70 bg-white/85 backdrop-blur-xl p-5 sm:p-6 shadow-[0_18px_50px_rgba(30,41,59,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-600">
                <Bell className="w-5 h-5" />
                <span className="text-[11px] uppercase tracking-[0.3em] font-black">Trung tâm thông báo</span>
              </div>
              <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">Trung tâm Thông báo</h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-3xl leading-relaxed">
                Theo dõi toàn bộ thông báo theo thời gian thực, lọc theo loại và cập nhật trạng thái đã đọc ngay trên một màn hình.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Đánh dấu tất cả là đã đọc
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/70 bg-white/85 backdrop-blur-xl p-4 sm:p-5 shadow-[0_18px_50px_rgba(30,41,59,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveFilter(tab.value)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                    activeFilter === tab.value
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-96">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm theo tiêu đề hoặc nội dung..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm font-medium"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200/70 bg-white/85 backdrop-blur-xl shadow-[0_18px_50px_rgba(30,41,59,0.08)] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div>
              <h2 className="text-lg font-black text-slate-900">Danh sách thông báo</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">{filteredNotifications.length} thông báo phù hợp</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">
              <CircleDot className="w-3.5 h-3.5" />
              {unreadCount} chưa đọc
            </div>
          </div>

          <div className="p-1">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                <p className="mt-3 text-sm font-semibold">Đang tải thông báo...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                <Inbox className="w-12 h-12 mb-3" />
                <p className="text-sm font-semibold">Không có thông báo nào phù hợp</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => {
                  const unread = isUnreadForUser(notification, currentUserId);
                  const typeBadgeClasses = getTypeBadgeClasses(notification.type);
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full relative overflow-hidden text-left rounded-2xl border px-5 py-5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        unread
                          ? 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                          : 'bg-slate-50/50 border-slate-200/60 opacity-75 hover:opacity-100 hover:bg-slate-50'
                      }`}
                    >
                      {unread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 h-3.5 w-3.5 rounded-full shrink-0 ${unread ? 'bg-blue-500' : 'bg-slate-300'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className={`text-base font-black ${unread ? 'text-slate-900' : 'text-slate-700'}`}>
                              {notification.title}
                            </h3>
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${unread ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                              {unread ? 'Chưa đọc' : 'Đã đọc'}
                            </span>
                          </div>
                          <p className={`mt-2 text-sm leading-relaxed ${unread ? 'text-slate-700' : 'text-slate-500'}`}>
                            {notification.message}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${typeBadgeClasses}`}>
                              {notification.type || 'SYSTEM'}
                            </span>
                            <span>{formatRelativeTime(notification.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}