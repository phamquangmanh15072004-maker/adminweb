import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Lock,
  Unlock,
  MessageCircle,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Shield,
  Box,
  Users,
  User,
  Check,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { auth, db } from '../../firebase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

// ============================================================================
// 📅 HELPER: Format Last Active (Có hiệu ứng Đang hoạt động)
// ============================================================================
function formatRelativeTime(dateString?: string | number): React.ReactNode {
  if (!dateString) return <span className="text-slate-400">N/A</span>;

  try {
    const timeValue = typeof dateString === 'string' ? Number(dateString) : dateString;
    const date = new Date(timeValue);
    const now = new Date();

    if (isNaN(date.getTime())) return <span className="text-slate-400">N/A</span>;

    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Dưới 5 phút (300s) -> Chắc chắn đang onl app hoặc web
    if (seconds < 300) {
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          Đang hoạt động
        </span>
      );
    }

    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;

    return date.toLocaleDateString('vi-VN');
  } catch {
    return <span className="text-slate-400">N/A</span>;
  }
}

// ============================================================================
// ⏳ LOADING SKELETON
// ============================================================================
function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-slate-100 rounded-2xl animate-pulse">
          <div className="w-10 h-10 bg-slate-200 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-1/4" />
            <div className="h-2 bg-slate-200 rounded w-1/3" />
          </div>
          <div className="h-6 bg-slate-200 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// TYPES
// ============================================================================
interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: 'USER' | 'ADMIN' | 'INVENTORY' | 'STAFF';
  isLocked?: boolean;
  lockReason?: string;
  lockedAt?: string;
  lastActive?: string | number; // Support both format from Web and App
  createdAt?: string;
}

type SortField = 'name' | 'email' | 'lastActive';
type SortOrder = 'asc' | 'desc';
type FilterRole = 'ALL' | 'USER' | 'ADMIN' | 'INVENTORY' | 'STAFF';
// Nâng cấp: Tách bạch rõ ràng logic Locked/Active và Online
type FilterStatus = 'ALL' | 'ACCOUNT_ACTIVE' | 'ACCOUNT_LOCKED' | 'ONLINE_NOW';

const ROLE_OPTIONS: Array<UserRecord['role']> = ['ADMIN', 'INVENTORY', 'STAFF', 'USER'];

const getRoleIcon = (role: UserRecord['role']) => {
  if (role === 'ADMIN') return <Shield size={14} className="text-purple-700" />;
  if (role === 'INVENTORY') return <Box size={14} className="text-orange-700" />;
  if (role === 'STAFF') return <Users size={14} className="text-cyan-700" />;
  return <User size={14} className="text-slate-700" />;
};

const getRoleBadgeClass = (role: UserRecord['role']) => {
  if (role === 'ADMIN') return 'bg-purple-100 text-purple-700';
  if (role === 'INVENTORY') return 'bg-orange-100 text-orange-700';
  if (role === 'STAFF') return 'bg-cyan-100 text-cyan-700';
  return 'bg-slate-100 text-slate-700';
};

const getRoleSoftClass = (role: UserRecord['role']) => {
  if (role === 'ADMIN') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (role === 'INVENTORY') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (role === 'STAFF') return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
};

// ============================================================================
// 🎭 DIALOG COMPONENTS (Giữ nguyên của em)
// ============================================================================
interface ChangeRoleDialogProps { user: UserRecord; newTargetRole: UserRecord['role']; isSubmitting: boolean; onConfirm: () => void; onCancel: () => void; }
function ChangeRoleDialog({ user, newTargetRole, isSubmitting, onConfirm, onCancel }: ChangeRoleDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><AlertCircle className="w-5 h-5 text-amber-600" /></div>
          <h2 className="text-xl font-bold text-slate-900">Xác nhận đổi quyền</h2>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 space-y-2">
          <p className="text-sm"><span className="font-semibold text-slate-700">Người dùng:</span> <span className="text-slate-600">{user.name}</span></p>
          <p className="text-sm"><span className="font-semibold text-slate-700">Email:</span> <span className="text-slate-600">{user.email}</span></p>
          <p className="text-sm pt-2 border-t border-slate-200">
            <span className="font-semibold text-slate-700">Vai trò hiện tại:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${getRoleBadgeClass(user.role)}`}>{user.role}</span>
          </p>
          <p className="text-sm">
            <span className="font-semibold text-slate-700">Vai trò mới:</span>
            <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${getRoleBadgeClass(newTargetRole)}`}>{newTargetRole}</span>
          </p>
        </div>
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700">Sau khi xác nhận, tài khoản này sẽ bị đăng xuất khỏi phiên hiện tại để áp dụng quyền mới.</div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition font-semibold">Hủy</button>
          <button onClick={onConfirm} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-semibold">{isSubmitting ? 'Đang xử lý...' : 'Xác nhận & đăng xuất'}</button>
        </div>
      </div>
    </div>
  );
}

interface LockUserDialogProps { user: UserRecord; lockReason: string; isSubmitting: boolean; onReasonChange: (reason: string) => void; onConfirm: () => void; onCancel: () => void; }
function LockUserDialog({ user, lockReason, isSubmitting, onReasonChange, onConfirm, onCancel }: LockUserDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><Lock className="w-5 h-5 text-red-600" /></div>
          <h2 className="text-xl font-bold text-slate-900">Khóa tài khoản người dùng</h2>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-4 space-y-2">
          <p className="text-sm"><span className="font-semibold text-slate-700">Người dùng:</span> <span className="text-slate-600">{user.name}</span></p>
          <p className="text-sm"><span className="font-semibold text-slate-700">Email:</span> <span className="text-slate-600">{user.email}</span></p>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Lý do khóa (tuỳ chọn):</label>
          <textarea value={lockReason} onChange={(e) => onReasonChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={3} />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition font-semibold">Hủy</button>
          <button onClick={onConfirm} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold">{isSubmitting ? 'Đang xử lý...' : 'Khóa'}</button>
        </div>
      </div>
    </div>
  );
}

interface UnlockUserDialogProps { user: UserRecord; isSubmitting: boolean; onConfirm: () => void; onCancel: () => void; }
function UnlockUserDialog({ user, isSubmitting, onConfirm, onCancel }: UnlockUserDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-slate-200/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><Unlock className="w-5 h-5 text-emerald-600" /></div>
          <h2 className="text-xl font-bold text-slate-900">Mở khóa tài khoản người dùng</h2>
        </div>
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl mb-6 space-y-3">
          <p className="text-sm"><span className="font-semibold text-slate-700">Người dùng:</span> <span className="text-slate-600">{user.name}</span></p>
          <p className="text-sm"><span className="font-semibold text-slate-700">Email:</span> <span className="text-slate-600">{user.email}</span></p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition font-semibold">Hủy</button>
          <button onClick={onConfirm} disabled={isSubmitting} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold">{isSubmitting ? 'Đang xử lý...' : 'Mở khóa'}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 🎯 MAIN PAGE COMPONENT
// ============================================================================
export default function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<FilterRole>('ALL');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [sortField, setSortField] = useState<SortField>('lastActive');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [dialogType, setDialogType] = useState<'lock' | 'unlock' | 'changeRole' | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [roleMenuOpenUserId, setRoleMenuOpenUserId] = useState<string | null>(null);
  const [roleMenuPosition, setRoleMenuPosition] = useState<{ left: number; top: number; openUp: boolean } | null>(null);
  const [newTargetRole, setNewTargetRole] = useState<UserRecord['role'] | null>(null);
  const [isRoleFilterOpen, setIsRoleFilterOpen] = useState(false);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const roleFilterRef = useRef<HTMLDivElement | null>(null);
  const statusFilterRef = useRef<HTMLDivElement | null>(null);

  const roleFilterLabel = filterRole === 'ALL' ? 'Tất cả Vai trò' : filterRole;

  // 🌟 Logic hiển thị Tên của nút Lọc Trạng thái
  const statusFilterLabel =
    filterStatus === 'ALL' ? 'Tất cả Trạng thái' :
      filterStatus === 'ACCOUNT_ACTIVE' ? 'TK Bình thường' :
        filterStatus === 'ACCOUNT_LOCKED' ? 'TK Đã khóa' : 'Đang Online 🟢';

  useEffect(() => {
    document.title = "Quản lý Người Dùng - Gunpla Store";
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) setIsSuperAdmin(user.email === 'admin@storepromax.com');
    });
    return unsubscribe;
  }, []);

  // 💓 WEB HEARTBEAT: Máy đo nhịp tim cho Admin trên Web
  useEffect(() => {
    const updateWebHeartbeat = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          lastActive: Date.now() // Cập nhật thời gian thành mili-giây
        });
      } catch (error) {
        console.error("Lỗi cập nhật heartbeat Web:", error);
      }
    };

    updateWebHeartbeat(); // Bắn 1 nhịp khi vừa mở trang
    const intervalId = setInterval(updateWebHeartbeat, 5 * 60 * 1000); // 5 phút đập 1 lần
    return () => clearInterval(intervalId); // Tắt nhịp tim khi thoát trang
  }, []);

  useEffect(() => {
    const handleGlobalPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (roleFilterRef.current && !roleFilterRef.current.contains(target)) setIsRoleFilterOpen(false);
      if (statusFilterRef.current && !statusFilterRef.current.contains(target)) setIsStatusFilterOpen(false);

      if (!target.closest('[data-role-menu-root="true"]') && !target.closest('[data-role-floating-menu="true"]')) {
        setRoleMenuOpenUserId(null);
        setRoleMenuPosition(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsRoleFilterOpen(false);
      setIsStatusFilterOpen(false);
      setRoleMenuOpenUserId(null);
      setRoleMenuPosition(null);
    };

    window.addEventListener('mousedown', handleGlobalPointerDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleGlobalPointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // 📡 Real-time listeners for users
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: UserRecord[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as UserRecord);
      });
      setUsers(usersData);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      toast.error('Lỗi tải danh sách người dùng');
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // 🔎 🌟 BỘ LỌC VÀ SẮP XẾP ĐÃ ĐƯỢC NÂNG CẤP
  const filteredUsers = users
    .filter((user) => {
      // Lọc theo text search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!user.name.toLowerCase().includes(term) && !user.email.toLowerCase().includes(term) && !(user.phone?.toLowerCase().includes(term))) {
          return false;
        }
      }

      // Lọc theo Role
      if (filterRole !== 'ALL' && user.role !== filterRole) return false;

      // 🌟 Lọc theo Status (Bao gồm cả tính năng đang Online)
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'ACCOUNT_LOCKED' && !user.isLocked) return false;
        if (filterStatus === 'ACCOUNT_ACTIVE' && user.isLocked) return false;
        if (filterStatus === 'ONLINE_NOW') {
          const timeValue = typeof user.lastActive === 'string' ? Number(user.lastActive) : (user.lastActive || 0);
          const isOnline = (Date.now() - timeValue) < 300000; // Nhỏ hơn 5 phút (300.000 ms)
          if (!isOnline) return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      // 🌟 LUẬT ƯU TIÊN SỐ 1: LUÔN GHIM ADMIN LÊN ĐẦU
      if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
      if (a.role !== 'ADMIN' && b.role === 'ADMIN') return 1;

      // 🌟 LUẬT SỐ 2: Sắp xếp theo thao tác của người dùng
      let aVal, bVal;
      if (sortField === 'name') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
      } else if (sortField === 'email') {
        aVal = a.email.toLowerCase();
        bVal = b.email.toLowerCase();
      } else {
        aVal = new Date(a.lastActive || 0).getTime();
        bVal = new Date(b.lastActive || 0).getTime();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('desc'); }
  };

  const handleOpenDialog = (user: UserRecord, action: 'lock' | 'unlock' | 'changeRole', targetRole?: UserRecord['role']) => {
    if (!isSuperAdmin) { toast.error('Bạn không có quyền thực hiện hành động này'); return; }
    if (auth.currentUser?.email === user.email) {
      if (action === 'changeRole') { toast.error('Bạn không thể hạ quyền cho chính mình'); return; }
      if (action === 'lock' || action === 'unlock') { toast.error('Bạn không thể khóa/mở khóa chính mình'); return; }
    }
    setSelectedUser(user);
    setDialogType(action);
    setNewTargetRole(action === 'changeRole' && targetRole ? targetRole : null);
    setLockReason('');
    setRoleMenuOpenUserId(null);
    setRoleMenuPosition(null);
  };

  const handleConfirmAction = async () => {
    if (!selectedUser || !dialogType) return;
    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', selectedUser.id);
      if (dialogType === 'lock') {
        await updateDoc(userRef, { isLocked: true, lockReason: lockReason || 'Không có lý do', lockedAt: new Date().toISOString() });
        toast.success(`✅ Đã khóa người dùng: ${selectedUser.name}`);
      } else if (dialogType === 'unlock') {
        await updateDoc(userRef, { isLocked: false, lockReason: '', lockedAt: '' });
        toast.success(`🔓 Đã mở khóa người dùng: ${selectedUser.name}`);
      } else if (dialogType === 'changeRole') {
        if (!newTargetRole) { toast.error('Thiếu vai trò đích'); return; }
        await updateDoc(userRef, { role: newTargetRole, forceLogoutAt: Date.now() });
        toast.success(`👤 Đã cập nhật quyền: ${selectedUser.name} → ${newTargetRole}`);
      }
      setDialogType(null); setSelectedUser(null); setNewTargetRole(null);
    } catch (error) { toast.error('❌ Lỗi cập nhật người dùng'); }
    finally { setIsSubmitting(false); }
  };

  const getRoleBadge = (role: UserRecord['role']) => (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getRoleBadgeClass(role)}`}>{role}</span>
  );

  const getStatusBadge = (isLocked?: boolean) => {
    if (isLocked) return <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700"><Lock size={12} /> Locked</div>;
    return <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">Active</span>;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp size={16} className="text-slate-300" />;
    return sortOrder === 'asc' ? <ChevronUp size={16} className="text-blue-600" /> : <ChevronDown size={16} className="text-blue-600" />;
  };

  if (isLoading) return <div className="h-full overflow-y-auto custom-scrollbar"><TableSkeleton /></div>;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 bg-slate-50">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-slate-900">Quản lý Người dùng</h1>
        <p className="text-sm text-slate-600 mt-2 font-medium">Cấp quyền truy cập, khóa tài khoản và quản lý quyền hệ thống</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search size={18} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, email hoặc SĐT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Bộ lọc Role */}
          <div ref={roleFilterRef} className="relative">
            <button onClick={() => { setIsRoleFilterOpen(!isRoleFilterOpen); setIsStatusFilterOpen(false); }} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 hover:bg-white font-semibold text-slate-700 text-sm inline-flex items-center justify-between transition">
              <span className="truncate">{roleFilterLabel}</span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${isRoleFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            {isRoleFilterOpen && (
              <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                {(['ALL', 'ADMIN', 'INVENTORY', 'STAFF', 'USER'] as FilterRole[]).map((roleOption) => (
                  <button
                    key={roleOption}
                    onClick={() => { setFilterRole(roleOption); setIsRoleFilterOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${filterRole === roleOption ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {roleOption === 'ALL' ? 'Tất cả Vai trò' : <span className="inline-flex items-center gap-2">{getRoleIcon(roleOption)} {roleOption}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 🌟 Bộ lọc Trạng thái (Đã nâng cấp) */}
          <div ref={statusFilterRef} className="relative">
            <button onClick={() => { setIsStatusFilterOpen(!isStatusFilterOpen); setIsRoleFilterOpen(false); }} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl bg-slate-50 hover:bg-white font-semibold text-slate-700 text-sm inline-flex items-center justify-between transition">
              <span className="truncate">{statusFilterLabel}</span>
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${isStatusFilterOpen ? 'rotate-180' : ''}`} />
            </button>
            {isStatusFilterOpen && (
              <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                {([
                  { value: 'ALL', label: 'Tất cả Trạng thái' },
                  { value: 'ACCOUNT_ACTIVE', label: 'TK Bình thường' },
                  { value: 'ACCOUNT_LOCKED', label: 'TK Đã khóa' },
                  { value: 'ONLINE_NOW', label: 'Đang Online 🟢' }, // Lựa chọn mới
                ] as Array<{ value: FilterStatus; label: string }>).map((statusOption) => (
                  <button
                    key={statusOption.value}
                    onClick={() => { setFilterStatus(statusOption.value); setIsStatusFilterOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition ${filterStatus === statusOption.value ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {statusOption.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Người dùng</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Liên hệ</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Vai trò</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Trạng thái</th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('lastActive')}>
                  <div className="flex items-center gap-2">Hoạt động <SortIcon field="lastActive" /></div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-black text-slate-700 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition duration-150" onMouseEnter={() => setHoveredUserId(user.id)} onMouseLeave={() => setHoveredUserId(null)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img className="w-10 h-10 rounded-full object-cover" src={user.avatarUrl} alt={user.name} />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">{user.name.charAt(0).toUpperCase()}</div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4"><span className="text-sm text-slate-600 font-medium">{user.phone || 'N/A'}</span></td>
                  <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-6 py-4">{getStatusBadge(user.isLocked)}</td>

                  {/* 🌟 Hiển thị thời gian/trạng thái bằng component formatRelativeTime */}
                  <td className="px-6 py-4 text-sm font-medium">
                    {formatRelativeTime(user.lastActive)}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const currentUser = auth.currentUser;
                        const canChat = Boolean(currentUser) && user.role !== 'ADMIN' && user.id !== currentUser?.uid && user.email !== currentUser?.email;
                        return (
                          <div className="relative inline-block">
                            <button onClick={() => canChat && navigate(`/chat?userId=${user.id}`)} disabled={!canChat} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${canChat ? 'bg-sky-100 text-sky-700 hover:bg-sky-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'}`}>
                              <MessageCircle size={14} /> Chat
                            </button>
                          </div>
                        );
                      })()}
                      <div className="relative inline-block" data-role-menu-root="true">
                        <button onClick={(event) => {
                          if (!isSuperAdmin) return;
                          if (roleMenuOpenUserId === user.id) { setRoleMenuOpenUserId(null); setRoleMenuPosition(null); return; }
                          const rect = event.currentTarget.getBoundingClientRect();
                          const openUp = window.innerHeight - rect.bottom < 220;
                          setRoleMenuOpenUserId(user.id);
                          setRoleMenuPosition({ left: Math.max(12, Math.min(rect.right - 228, window.innerWidth - 228 - 12)), top: openUp ? rect.top - 8 : rect.bottom + 8, openUp });
                        }} disabled={!isSuperAdmin} className={`inline-flex items-center justify-between gap-2 w-[140px] px-3 py-1.5 text-xs font-bold rounded-lg border transition ${isSuperAdmin ? `${getRoleSoftClass(user.role)} hover:brightness-[0.98] cursor-pointer` : 'bg-amber-50 text-amber-500 border-amber-200 opacity-50 cursor-not-allowed'}`}>
                          <span className="inline-flex items-center justify-center min-w-[94px] tracking-wide">{user.role}</span>
                          <ChevronDown size={14} className={`transition-transform ${roleMenuOpenUserId === user.id ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      <div className="relative inline-block">
                        <button onClick={() => handleOpenDialog(user, user.isLocked ? 'unlock' : 'lock')} disabled={!isSuperAdmin} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition ${isSuperAdmin ? (user.isLocked ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer' : 'bg-red-100 text-red-700 hover:bg-red-200 cursor-pointer') : ('opacity-50 cursor-not-allowed ' + (user.isLocked ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'))}`}>
                          {user.isLocked ? (<><Unlock size={14} /> Unlock</>) : (<><Lock size={14} /> Lock</>)}
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">Không tìm thấy người dùng nào</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-600 font-medium">Hiển thị <span className="font-bold text-slate-900">{filteredUsers.length}</span> người dùng</p>
        {(searchTerm || filterRole !== 'ALL' || filterStatus !== 'ALL') && (
          <button onClick={() => { setSearchTerm(''); setFilterRole('ALL'); setFilterStatus('ALL'); }} className="text-xs font-bold text-blue-600 hover:text-blue-700 underline">Xóa bộ lọc</button>
        )}
      </div>

      {/* Floating Menu Dialog */}
      {isSuperAdmin && roleMenuOpenUserId && roleMenuPosition && (
        <div data-role-floating-menu="true" className="fixed z-40 w-[228px] bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 animate-in fade-in zoom-in-95 duration-150" style={{ left: roleMenuPosition.left, top: roleMenuPosition.top, transform: roleMenuPosition.openUp ? 'translateY(-100%)' : 'translateY(0)' }}>
          {(() => {
            const menuUser = filteredUsers.find((u) => u.id === roleMenuOpenUserId);
            if (!menuUser) return null;
            return ROLE_OPTIONS.map((roleOption) => {
              const isCurrent = roleOption === menuUser.role;
              return (
                <button key={roleOption} type="button" onClick={() => handleOpenDialog(menuUser, 'changeRole', roleOption)} disabled={isCurrent} className={`w-full px-2.5 py-2 rounded-lg text-left text-xs font-bold transition-colors inline-flex items-center justify-between ${isCurrent ? `${getRoleSoftClass(roleOption)} cursor-not-allowed` : 'text-slate-700 hover:bg-slate-100 cursor-pointer'}`}>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${getRoleSoftClass(roleOption)}`}><span className="w-[78px] text-left">{roleOption}</span></span>
                  {isCurrent && <Check size={14} className="text-slate-500" />}
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* Hành động Dialogs */}
      {dialogType === 'changeRole' && selectedUser && newTargetRole && <ChangeRoleDialog user={selectedUser} newTargetRole={newTargetRole} isSubmitting={isSubmitting} onConfirm={handleConfirmAction} onCancel={() => { setDialogType(null); setSelectedUser(null); setNewTargetRole(null); }} />}
      {dialogType === 'lock' && selectedUser && <LockUserDialog user={selectedUser} lockReason={lockReason} isSubmitting={isSubmitting} onReasonChange={setLockReason} onConfirm={handleConfirmAction} onCancel={() => { setDialogType(null); setSelectedUser(null); setNewTargetRole(null); }} />}
      {dialogType === 'unlock' && selectedUser && <UnlockUserDialog user={selectedUser} isSubmitting={isSubmitting} onConfirm={handleConfirmAction} onCancel={() => { setDialogType(null); setSelectedUser(null); setNewTargetRole(null); }} />}
    </div>
  );
}