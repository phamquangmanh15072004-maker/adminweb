import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  title: string;
  message: string;
  targetRoles: string[];
  type?: string;
  targetId?: string;
  readBy: string[];
  createdAt: number;
  userId?: string;
}

interface NotificationBellProps {
  currentUserRole: string;
  currentUserId: string;
}

/**
 * Tính toán thời gian tương đối (vd: "5 phút trước", "2 giờ trước")
 */
function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'vừa xảy ra';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  
  const date = new Date(timestamp);
  return date.toLocaleDateString('vi-VN');
}

export default function NotificationBell({ currentUserRole, currentUserId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const previousUnreadCount = useRef(0);
  const hasInitializedUnread = useRef(false);
  const defaultDocumentTitle = useRef(typeof document !== 'undefined' ? document.title : 'Gunpla Store');

  const normalizedUserId = String(currentUserId || '').trim();

  // Đếm số thông báo chưa đọc theo user hiện tại
  const unreadCount = notifications.filter((item) => normalizedUserId && !item.readBy.includes(normalizedUserId)).length;

  // ============================================================================
  // 1️⃣ LẮNG NGHE FIRESTORE - Chỉ lấy thông báo có liên quan đến role của user
  // ============================================================================
  useEffect(() => {
    if (!currentUserRole) {
      setIsLoading(false);
      return;
    }

    const normalizedRole = String(currentUserRole).toUpperCase();

    try {
      // Tạo query: 
      // - Lấy từ collection 'notifications'
      // - Chỉ lấy thông báo có targetRoles chứa role hiện tại
      // - Sắp xếp theo createdAt giảm dần (mới nhất trước)
      const q = query(
        collection(db, 'notifications'),
        where('targetRoles', 'array-contains', normalizedRole),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const data: Notification[] = [];
          snapshot.forEach((doc) => {
            const rawData = doc.data();
            data.push({
              id: doc.id,
              title: String(rawData.title || ''),
              message: String(rawData.message || ''),
              targetRoles: Array.isArray(rawData.targetRoles) ? rawData.targetRoles : [],
              type: String(rawData.type || '').trim() || undefined,
              targetId: rawData.targetId ? String(rawData.targetId).trim() : undefined,
              readBy: Array.isArray(rawData.readBy) ? rawData.readBy.map((value: any) => String(value)) : [],
              createdAt: Number(rawData.createdAt || 0),
              userId: rawData.userId ? String(rawData.userId) : undefined,
            });
          });

          setNotifications(data);
          setIsLoading(false);
        },
        (error) => {
          console.error('Lỗi lắng nghe notification:', error);
          toast.error('Không thể tải thông báo');
          setIsLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Lỗi thiết lập query notification:', error);
      setIsLoading(false);
    }
  }, [currentUserRole]);

  // ============================================================================
  // 2️⃣ ĐÓNG DROPDOWN KHI CLICK BÊN NGOÀI
  // ============================================================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current) return;
      const target = event.target;
      if (target instanceof Node && !notificationRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!hasInitializedUnread.current) {
      previousUnreadCount.current = unreadCount;
      hasInitializedUnread.current = true;
      return;
    }

    if (unreadCount > previousUnreadCount.current) {
      document.title = `(${unreadCount}) Thông báo mới - Gunpla Store`;
      try {
        void new Audio('/sounds/ting.mp3').play();
      } catch (audioError) {
        console.warn('Không thể phát âm thanh thông báo:', audioError);
      }
    }

    if (unreadCount === 0) {
      document.title = defaultDocumentTitle.current;
    }

    previousUnreadCount.current = unreadCount;
  }, [unreadCount]);

  // ============================================================================
  // 3️⃣ XỬ LÝ CLICK VÀO THÔNG BÁO CHƯA ĐỌC - CẬP NHẬT FIRESTORE
  // ============================================================================
  const handleMarkAsRead = async (notificationId: string, isCurrentlyRead: boolean) => {
    if (!normalizedUserId) {
      toast.error('Không xác định được người dùng hiện tại');
      return;
    }

    // Nếu đã đọc rồi, không cần xử lý
    if (isCurrentlyRead) return;

    try {
      const notificationDoc = doc(db, 'notifications', notificationId);
      await updateDoc(notificationDoc, {
        readBy: arrayUnion(normalizedUserId),
      });
      // Toast sẽ tự điều chỉnh khi Firestore update về
      toast.success('Đã đánh dấu làm đã đọc', { duration: 1500 });
    } catch (error) {
      console.error('Lỗi cập nhật notification:', error);
      toast.error('Lỗi cập nhật thông báo');
    }
  };

  const getNotificationRoute = (type?: string, targetId?: string) => {
    const normalizedType = String(type || '').toUpperCase();
    if (normalizedType === 'ORDER' || normalizedType === 'ORDER_UPDATE') {
      return targetId ? `/orders?search=${targetId}` : '/orders';
    }
    if (normalizedType === 'INVENTORY') {
      return targetId ? `/products?search=${targetId}` : '/products';
    }
    if (normalizedType === 'CHAT') {
      return targetId ? `/chat?userId=${targetId}` : '/chat';
    }
    return null;
  };

  const handleNotificationClick = async (notification: Notification) => {
    const isCurrentlyRead = notification.readBy.includes(normalizedUserId);
    void handleMarkAsRead(notification.id, isCurrentlyRead);
    setIsOpen(false);

    const nextRoute = getNotificationRoute(notification.type, notification.targetId);
    if (nextRoute) {
      navigate(nextRoute);
    }
  };

  // ============================================================================
  // 4️⃣ NÚT "ĐÁNH DẤU TẤT CẢ ĐÃ ĐỌC"
  // ============================================================================
  const handleMarkAllAsRead = async () => {
    if (!normalizedUserId) {
      toast.error('Không xác định được người dùng hiện tại');
      return;
    }

    const unreadNotifications = notifications.filter((item) => !item.readBy.includes(normalizedUserId));
    
    if (unreadNotifications.length === 0) {
      toast('Không có thông báo chưa đọc', { duration: 1500 });
      return;
    }

    try {
      const promises = unreadNotifications.map((notification) =>
        updateDoc(doc(db, 'notifications', notification.id), {
          readBy: arrayUnion(normalizedUserId),
        })
      );

      await Promise.all(promises);
      toast.success(`Đã đánh dấu ${unreadNotifications.length} thông báo làm đã đọc`, { duration: 1500 });
    } catch (error) {
      console.error('Lỗi đánh dấu tất cả làm đã đọc:', error);
      toast.error('Lỗi cập nhật thông báo');
    }
  };

  return (
    <div ref={notificationRef} className="relative inline-flex shrink-0 isolate z-40">
      {/* 🔔 NÚT CHUÔNG */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
        title="Thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black grid place-items-center border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {/* 📋 DROPDOWN PANEL */}
      {isOpen && (
        <div
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          className="absolute right-0 top-full mt-2 w-[360px] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl shadow-2xl overflow-hidden z-[70] animate-in fade-in zoom-in-95 duration-150 pointer-events-auto"
        >
          {/* HEADER: Tiêu đề + Số chưa đọc + Nút "Đánh dấu tất cả" */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900">Thông báo</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  title="Đánh dấu tất cả làm đã đọc"
                  className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-800 text-[11px] font-bold transition-colors cursor-pointer"
                >
                  ✓ Tất cả
                </button>
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
                {unreadCount} chưa đọc
              </span>
            </div>
          </div>

          {/* DANH SÁCH THÔNG BÁO */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="px-4 py-8 text-center">
                <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-slate-500">Đang tải thông báo...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <div className="text-3xl mb-2">📭</div>
                <p className="text-xs text-slate-500">Không có thông báo nào</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 border-slate-100 transition-all ${
                      notification.readBy.includes(normalizedUserId)
                      ? 'bg-white hover:bg-slate-50'
                      : 'bg-blue-50/50 hover:bg-blue-50'
                  } cursor-pointer`}
                >
                  <div className="flex items-start gap-3">
                    {/* CHẤM MÀU BÊN CẠNH (Xanh nếu chưa đọc, xám nếu đã đọc) */}
                    <span
                      className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          notification.readBy.includes(normalizedUserId) ? 'bg-slate-300' : 'bg-blue-500'
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      {/* TIÊU ĐỀ (ĐẬM) */}
                      <p className={`text-sm font-bold truncate ${
                          notification.readBy.includes(normalizedUserId) ? 'text-slate-600' : 'text-slate-900'
                      }`}>
                        {notification.title}
                      </p>

                      {/* NỘI DUNG (NHẠT) */}
                      <p className={`mt-1 text-xs leading-relaxed line-clamp-2 ${
                          notification.readBy.includes(normalizedUserId) ? 'text-slate-500' : 'text-slate-700'
                      }`}>
                        {notification.message}
                      </p>

                      {/* THỜI GIAN TƯƠNG ĐỐI */}
                      <p className="mt-1.5 text-[11px] font-semibold text-slate-400">
                        {getRelativeTime(notification.createdAt)}
                      </p>
                    </div>

                    {/* BADGE CHƯA ĐỌC (Nếu chưa đọc) */}
                    {!notification.readBy.includes(normalizedUserId) && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* FOOTER (Optional): Nút xem tất cả */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-center">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-wider transition-colors"
              >
                Xem tất cả →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
