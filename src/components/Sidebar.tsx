import { LayoutDashboard, ShoppingCart, Package, Users, Settings, LogOut, MessageCircle, TicketPercent, FileText } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { canAccessPath } from '../utils/permissions';

type SidebarProps = {
  activeTab: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  currentUserRole?: string;
};

export default function Sidebar({ activeTab, collapsed = false, onToggleCollapse, currentUserRole = '' }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, to: '/dashboard' },
    { id: 'orders', label: 'Đơn hàng', icon: ShoppingCart, to: '/orders' },
    { id: 'chat', label: 'CSKH Chat', icon: MessageCircle, to: '/chat' },
    { id: 'users', label: 'Người dùng', icon: Users, to: '/users' },
    { id: 'posts', label: 'Bài đăng', icon: FileText, to: '/posts' },
    { id: 'vouchers', label: 'Khuyến mãi', icon: TicketPercent, to: '/vouchers' },
    { id: 'products', label: 'Sản phẩm', icon: Package, to: '/products' },
    { id: 'customers', label: 'Khách hàng', icon: Users, to: '/customers' },
    { id: 'settings', label: 'Cài đặt', icon: Settings, to: '/settings' },
  ].filter((item) => canAccessPath(item.to, currentUserRole));

  return (
    <aside className={`bg-slate-950 text-white flex flex-col shadow-[0_20px_60px_rgba(15,23,42,0.35)] z-10 h-full border-r border-white/10 transition-all duration-300 ${collapsed ? 'w-20' : 'w-72'}`}>
      <button
        type="button"
        onClick={onToggleCollapse}
        className={`h-16 w-full flex items-center border-b border-white/10 bg-white/5 transition-colors hover:bg-white/10 cursor-pointer ${collapsed ? 'justify-center px-2' : 'px-6 justify-start'}`}
        title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
      >
        <span className={`${collapsed ? 'text-lg' : 'text-2xl'} font-black tracking-tight whitespace-nowrap`}>GUNPLA<span className="text-sky-300">STORE</span></span>
      </button>
      
      <nav className={`flex-1 py-6 space-y-1.5 overflow-y-auto custom-scrollbar ${collapsed ? 'px-2' : 'px-3'}`}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <NavLink
              key={item.id} 
              to={item.to}
              className={`w-full flex items-center py-3 rounded-2xl transition-all duration-200 border ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} ${isActive ? 'bg-sky-500/15 text-white font-bold border-sky-400/30 shadow-lg shadow-sky-500/10' : 'text-slate-300 hover:bg-white/5 hover:text-white font-medium border-transparent'}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-sky-300' : 'text-slate-400'}`} />
              {!collapsed && item.label}
            </NavLink>
          )
        })}
      </nav>

      <div className={`border-t border-white/10 bg-white/5 ${collapsed ? 'p-2' : 'p-4'}`}>
        <button className={`w-full flex items-center py-3 text-red-300 hover:bg-red-500/10 rounded-2xl transition-colors font-bold border border-transparent hover:border-red-400/20 ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'}`} title={collapsed ? 'Đăng xuất' : undefined}>
          <LogOut className="w-5 h-5" /> {!collapsed && 'Đăng xuất'}
        </button>
      </div>
    </aside>
  );
}
