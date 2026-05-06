import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Mail, Lock, Eye, EyeOff, ShieldAlert, ArrowRight, Loader2, Bot } from 'lucide-react';
import toast from 'react-hot-toast';

type PasswordRobotProps = {
  eyesOpen: boolean;
};

function PasswordRobot({ eyesOpen }: PasswordRobotProps) {
  return (
    <div className="relative w-full h-full min-h-[280px] flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.35),_transparent_45%),linear-gradient(180deg,#0f172a_0%,#020617_100%)]">
      <style>{`
        @keyframes robotFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
      <div className="absolute inset-0 opacity-40 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute -top-24 left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-950 to-transparent" />

      <div className="relative z-10 w-full max-w-sm px-6 py-8">
        <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64" style={{ animation: 'robotFloat 5s ease-in-out infinite' }}>
          <div className="absolute inset-x-1/2 top-1 -translate-x-1/2 h-10 w-1.5 rounded-full bg-sky-300 shadow-[0_0_20px_rgba(125,211,252,0.8)]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-sky-300 shadow-[0_0_25px_rgba(125,211,252,0.95)]" />

          <div className="absolute inset-10 rounded-[2rem] border border-white/10 bg-gradient-to-b from-slate-200 via-slate-300 to-slate-500 shadow-[0_30px_70px_rgba(15,23,42,0.55)]">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.75),transparent_30%),linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.16)_48%,transparent_100%)]" />

            <div className="absolute -top-4 left-1/2 h-8 w-20 -translate-x-1/2 rounded-full border border-white/10 bg-slate-300/90 shadow-inner" />

            <div className="absolute left-1/2 top-8 h-28 w-40 -translate-x-1/2 rounded-[1.5rem] border border-slate-200/80 bg-slate-950/95 shadow-inner overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.22),_transparent_60%)]" />
              <div className={`absolute inset-x-8 top-8 flex items-center justify-between transition-all duration-300 ${eyesOpen ? 'translate-y-0' : 'translate-y-0.5'}`}>
                <div className="relative h-11 w-11 rounded-full bg-slate-100/95 border border-sky-300/30 shadow-[0_0_18px_rgba(125,211,252,0.18)] overflow-hidden">
                  <div className={`absolute inset-0 rounded-full bg-sky-400/90 transition-all duration-300 ${eyesOpen ? 'opacity-100 scale-100' : 'opacity-20 scale-75'}`} />
                  <div className={`absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950 transition-all duration-300 ${eyesOpen ? 'scale-100' : 'scale-0'}`} />
                  <div className={`absolute inset-x-2 top-4 h-1 rounded-full bg-slate-900 transition-all duration-300 ${eyesOpen ? 'opacity-0' : 'opacity-100'}`} />
                </div>

                <div className="relative h-11 w-11 rounded-full bg-slate-100/95 border border-sky-300/30 shadow-[0_0_18px_rgba(125,211,252,0.18)] overflow-hidden">
                  <div className={`absolute inset-0 rounded-full bg-sky-400/90 transition-all duration-300 ${eyesOpen ? 'opacity-100 scale-100' : 'opacity-20 scale-75'}`} />
                  <div className={`absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-950 transition-all duration-300 ${eyesOpen ? 'scale-100' : 'scale-0'}`} />
                  <div className={`absolute inset-x-2 top-4 h-1 rounded-full bg-slate-900 transition-all duration-300 ${eyesOpen ? 'opacity-0' : 'opacity-100'}`} />
                </div>
              </div>

              <div className={`absolute left-1/2 top-[4.75rem] h-5 w-20 -translate-x-1/2 rounded-full border border-sky-300/20 bg-gradient-to-r from-sky-400 to-indigo-500 shadow-[0_0_20px_rgba(59,130,246,0.25)] transition-all duration-300 ${eyesOpen ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`} />

              <div className={`absolute -bottom-5 left-1/2 h-10 w-24 -translate-x-1/2 rounded-b-[1.5rem] rounded-t-lg border border-white/10 bg-slate-300/90 shadow-inner transition-all duration-300 ${eyesOpen ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`} />
              <div className={`absolute bottom-3 left-1/2 h-4 w-28 -translate-x-1/2 rounded-full bg-slate-800 transition-all duration-300 ${eyesOpen ? 'opacity-0 scale-x-75' : 'opacity-90 scale-x-100'}`} />
            </div>

            <div className="absolute left-2 top-16 h-16 w-6 rounded-full bg-slate-400/80 border border-white/10 shadow-inner" />
            <div className="absolute right-2 top-16 h-16 w-6 rounded-full bg-slate-400/80 border border-white/10 shadow-inner" />
          </div>

          <div className="absolute left-1/2 bottom-8 h-5 w-24 -translate-x-1/2 rounded-full bg-sky-400/30 blur-md" />
        </div>

        <div className="mt-6 text-center space-y-2">
          <p className="text-[11px] uppercase tracking-[0.35em] text-sky-300 font-black">Guardian Bot</p>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">GunplaStore</h2>
          <p className="text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            Robot sẽ mở mắt khi bạn xem mật khẩu và nhắm mắt khi bạn ẩn nó.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  useEffect(() => {
    document.title = "Đăng nhập - Store ProMax Admin";
  }, []);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;

        const userData = userDoc.data();
        const allowedRoles = ['ADMIN', 'INVENTORY', 'STAFF'];
        const normalizedRole = String(userData.role || '').toUpperCase();
        const hasAccess = allowedRoles.includes(normalizedRole) && !userData.isLocked;
        if (hasAccess) {
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Login guard error:', error);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setIsLoading(true);

    try {
      // 🛡️ LỚP 1: XÁC THỰC TÀI KHOẢN QUA FIREBASE AUTH
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 🛡️ LỚP 2: LẤY THÔNG TIN USER TỪ FIRESTORE ĐỂ CHECK QUYỀN
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await signOut(auth);
        setErrorMsg('Dữ liệu tài khoản không tồn tại trên hệ thống.');
        setIsLoading(false);
        return;
      }

      const userData = userDoc.data();

      // 🛡️ LỚP 3: KIỂM TRA QUYỀN (ROLE)
      // Cho phép ADMIN, INVENTORY, STAFF truy cập web quản trị
      const allowedRoles = ['ADMIN', 'INVENTORY', 'STAFF'];
      const normalizedRole = String(userData.role || '').toUpperCase();
      if (!allowedRoles.includes(normalizedRole)) {
        await signOut(auth);
        setErrorMsg('Truy cập bị từ chối. Chỉ dành cho Quản trị viên và Nhân viên.');
        setIsLoading(false);
        return;
      }

      // 🛡️ LỚP 4: KIỂM TRA KHÓA TÀI KHOẢN (isLocked)
      if (userData.isLocked) {
        await signOut(auth);
        const reason = userData.lockReason ? `: ${userData.lockReason}` : '';
        setErrorMsg(`Tài khoản của bạn đã bị khóa${reason}. Vui lòng liên hệ Giám đốc.`);
        setIsLoading(false);
        return;
      }

      // ✅ Cập nhật thời gian hoạt động cuối (lastActive)
      await updateDoc(userDocRef, {
        lastActive: Date.now()
      });

      toast.success(`Chào mừng trở lại, ${userData.name || 'Quản trị viên'}!`, {
        icon: '👋',
        duration: 3000,
      });

      // Chuyển hướng vào Dashboard trung tâm sau khi đăng nhập thành công
      navigate('/dashboard', { replace: true });

    } catch (error: any) {
      console.error("Login Error:", error);
      // Dịch lỗi của Firebase sang Tiếng Việt cho mượt
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrorMsg('Email hoặc Mật khẩu không chính xác.');
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMsg('Bạn đã nhập sai quá nhiều lần. Tài khoản tạm khóa, vui lòng thử lại sau.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMsg('Định dạng Email không hợp lệ.');
      } else {
        setErrorMsg('Đã có lỗi xảy ra. Vui lòng thử lại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      
      {/* 🌌 BACKGROUND HIỆU ỨNG VŨ TRỤ / MECHA */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-1/2 w-[1000px] h-[500px] -translate-x-1/2 -translate-y-1/2 bg-blue-600/30 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] bg-indigo-600/20 rounded-full blur-[150px] pointer-events-none" />
        {/* Lưới Grid pattern xịn xò */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      </div>

      {/* 🪟 CARD ĐĂNG NHẬP CHÍNH */}
      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid lg:grid-cols-[1fr_1.05fr] rounded-[2rem] overflow-hidden border border-white/10 bg-white/10 backdrop-blur-2xl shadow-2xl shadow-slate-950/40">
          <div className="hidden lg:block min-h-[620px]">
            <PasswordRobot eyesOpen={showPassword} />
          </div>

          <div className="lg:hidden">
            <PasswordRobot eyesOpen={showPassword} />
          </div>

          <div className="p-6 sm:p-8 lg:p-10 xl:p-12 bg-slate-950/45">
            <div className="mb-8 lg:mb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-sky-300">
                <Bot className="w-4 h-4" /> Secure Access
              </div>
              <h1 className="mt-5 text-3xl sm:text-4xl font-black text-white tracking-tight">Store ProMax</h1>
              <p className="mt-3 text-slate-400 text-sm font-medium max-w-md leading-relaxed">
                Đăng nhập quản trị để quản lý sản phẩm, đơn hàng và kho vận.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
            {/* IN RA LỖI NẾU CÓ */}
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-200 leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {/* EMAIL INPUT */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider ml-1">Email quản trị</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@storepromax.com"
                  required
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder:text-slate-500 font-medium"
                />
              </div>
            </div>

            {/* PASSWORD INPUT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Mật khẩu</label>
                <a href="#" className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">Quên mật khẩu?</a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-11 pr-12 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder:text-slate-500 font-medium tracking-wide"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* NÚT SUBMIT */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  Đăng nhập hệ thống
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            </form>

            <p className="text-center text-slate-500 text-xs mt-8 font-medium">
              Hệ thống Quản trị Nội bộ © 2026 Store ProMax. <br/> Yêu cầu quyền truy cập cấp cao.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}