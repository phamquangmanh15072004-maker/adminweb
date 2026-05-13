import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Plus,
  Save,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';

type Banner = {
  id: string;
  imageUrl: string;
  headline: string;
  subHeadline: string;
  targetId: string;
  isActive: boolean;
  priority: number;
};

type BannerField = keyof Pick<Banner, 'imageUrl' | 'headline' | 'subHeadline' | 'targetId' | 'isActive'>;

const createEmptyBanner = (priority: number): Banner => ({
  id: `new_${Date.now()}_${priority}`,
  imageUrl: '',
  headline: '',
  subHeadline: '',
  targetId: '',
  isActive: true,
  priority,
});

const fallbackImage = 'https://placehold.co/900x450/e2e8f0/475569?text=Banner+Preview';

export default function BannerManagerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchBanners = async () => {
      setIsFetching(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'banners'));
        const fetchedBanners: Banner[] = querySnapshot.docs
          .map((snapshot) => {
            const data = snapshot.data();
            return {
              id: snapshot.id,
              imageUrl: String(data.imageUrl || ''),
              headline: String(data.headline || ''),
              subHeadline: String(data.subHeadline || ''),
              targetId: String(data.targetId || ''),
              isActive: data.isActive !== false,
              priority: Number(data.priority || 0),
            };
          })
          .sort((a, b) => a.priority - b.priority);

        setBanners(fetchedBanners.length > 0 ? fetchedBanners : [createEmptyBanner(1)]);
        setCurrentIndex(0);
      } catch (error) {
        console.error('Load banners error:', error);
        toast.error('Không thể tải danh sách banner.');
        setBanners([createEmptyBanner(1)]);
        setCurrentIndex(0);
      } finally {
        setIsFetching(false);
      }
    };

    void fetchBanners();
  }, [isOpen]);

  const currentBanner = banners[currentIndex] || createEmptyBanner(1);
  const activeCount = useMemo(() => banners.filter((banner) => banner.isActive !== false).length, [banners]);
  const isBusy = isFetching || isSaving;

  if (!isOpen) return null;

  const updateCurrentBanner = (field: BannerField, value: string | boolean) => {
    setBanners((prev) =>
      prev.map((banner, index) => (index === currentIndex ? { ...banner, [field]: value } : banner))
    );
  };

  const handleAddBanner = () => {
    setBanners((prev) => {
      const next = [...prev, createEmptyBanner(prev.length + 1)];
      setCurrentIndex(next.length - 1);
      return next;
    });
  };

  const handleDeleteBanner = () => {
    if (banners.length <= 1) {
      toast.error('Phải giữ lại ít nhất 1 banner.');
      return;
    }

    const next = banners
      .filter((_, index) => index !== currentIndex)
      .map((banner, index) => ({ ...banner, priority: index + 1 }));

    setBanners(next);
    setCurrentIndex((prev) => Math.min(prev, next.length - 1));
  };

  const goToPrevious = () => setCurrentIndex((prev) => Math.max(0, prev - 1));
  const goToNext = () => setCurrentIndex((prev) => Math.min(banners.length - 1, prev + 1));

  const handleSaveToFirebase = async () => {
    const invalidIndex = banners.findIndex((banner) => !banner.imageUrl.trim());
    if (invalidIndex >= 0) {
      setCurrentIndex(invalidIndex);
      toast.error(`Banner ${invalidIndex + 1} chưa có link ảnh.`);
      return;
    }

    setIsSaving(true);
    try {
      const bannerCollection = collection(db, 'banners');
      const existingDocs = await getDocs(bannerCollection);
      const batch = writeBatch(db);

      existingDocs.forEach((document) => {
        batch.delete(document.ref);
      });

      banners.forEach((banner, index) => {
        const { id, ...dataToSave } = banner;
        const newDocRef = doc(bannerCollection);
        batch.set(newDocRef, {
          ...dataToSave,
          imageUrl: dataToSave.imageUrl.trim(),
          headline: dataToSave.headline.trim(),
          subHeadline: dataToSave.subHeadline.trim(),
          targetId: dataToSave.targetId.trim(),
          priority: index + 1,
        });
      });

      await batch.commit();
      toast.success(`Đã cập nhật ${banners.length} banner lên app.`);
      onClose();
    } catch (error) {
      console.error('Save banners error:', error);
      toast.error('Không thể lưu banner. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm p-3 sm:p-5 flex items-center justify-center animate-in fade-in duration-150">
      <div className="w-full max-w-6xl max-h-[92vh] rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col">
        <header className="shrink-0 border-b border-slate-100 bg-white px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-600">
              <ImageIcon className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-[0.24em]">Mobile Home</span>
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-black text-slate-900">Quản lý banner app</h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-100">
              {activeCount}/{banners.length} đang bật
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors disabled:opacity-50 grid place-items-center"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_360px] bg-slate-50/70">
          <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-4 min-h-0 flex flex-col">
            <button
              type="button"
              onClick={handleAddBanner}
              disabled={isBusy}
              className="h-11 w-full rounded-xl bg-blue-600 text-white font-bold text-sm inline-flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              Thêm banner
            </button>

            <div className="mt-4 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {banners.map((banner, index) => {
                const isSelected = index === currentIndex;
                return (
                  <button
                    key={banner.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    disabled={isBusy}
                    className={`w-full text-left rounded-2xl border p-2.5 transition-all disabled:opacity-60 ${
                      isSelected
                        ? 'border-blue-300 bg-blue-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {banner.imageUrl ? (
                          <img src={banner.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-900">
                          {banner.headline || `Banner ${index + 1}`}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                          {banner.isActive !== false ? 'Đang bật' : 'Đang tắt'}
                        </p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="relative min-h-0 bg-white p-4 sm:p-6 overflow-y-auto custom-scrollbar">
            {isFetching && (
              <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="mt-3 text-sm font-bold text-slate-500">Đang tải banner...</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Đang chỉnh</p>
                <h3 className="mt-1 text-lg font-black text-slate-900">Banner {currentIndex + 1}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPrevious}
                  disabled={currentIndex === 0 || isBusy}
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 grid place-items-center"
                  title="Banner trước"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="min-w-16 text-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
                  {currentIndex + 1}/{banners.length}
                </span>
                <button
                  type="button"
                  onClick={goToNext}
                  disabled={currentIndex === banners.length - 1 || isBusy}
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 grid place-items-center"
                  title="Banner sau"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Link ảnh <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="url"
                    value={currentBanner.imageUrl}
                    onChange={(event) => updateCurrentBanner('imageUrl', event.target.value)}
                    disabled={isBusy}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    placeholder="https://domain.com/banner.jpg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Tiêu đề chính</label>
                  <input
                    type="text"
                    value={currentBanner.headline}
                    onChange={(event) => updateCurrentBanner('headline', event.target.value)}
                    disabled={isBusy}
                    maxLength={60}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    placeholder="Ví dụ: New Arrival"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Phụ đề</label>
                  <input
                    type="text"
                    value={currentBanner.subHeadline}
                    onChange={(event) => updateCurrentBanner('subHeadline', event.target.value)}
                    disabled={isBusy}
                    maxLength={90}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    placeholder="Mô tả ngắn cho banner"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">ID sản phẩm khi bấm vào</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    type="text"
                    value={currentBanner.targetId}
                    onChange={(event) => updateCurrentBanner('targetId', event.target.value)}
                    disabled={isBusy}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                    placeholder="Không bắt buộc"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">Trạng thái hiển thị</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Banner tắt sẽ được lưu nhưng không nên hiển thị trên app.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => updateCurrentBanner('isActive', currentBanner.isActive === false)}
                  disabled={isBusy}
                  className={`h-10 shrink-0 rounded-xl px-4 text-sm font-bold inline-flex items-center gap-2 border transition-colors disabled:opacity-60 ${
                    currentBanner.isActive !== false
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {currentBanner.isActive !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {currentBanner.isActive !== false ? 'Đang bật' : 'Đang tắt'}
                </button>
              </div>
            </div>
          </main>

          <section className="border-t lg:border-t-0 lg:border-l border-slate-200 bg-slate-100/80 p-5 sm:p-6 flex flex-col items-center justify-center">
            <div className="mb-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <Smartphone className="w-4 h-4" />
              Live preview
            </div>

            <div className={`w-full max-w-[320px] rounded-[2rem] border-[8px] border-slate-900 bg-white shadow-2xl overflow-hidden transition ${currentBanner.isActive === false ? 'opacity-55 grayscale' : ''}`}>
              <div className="h-7 bg-slate-900 relative">
                <div className="absolute left-1/2 top-0 h-4 w-28 -translate-x-1/2 rounded-b-2xl bg-slate-950" />
              </div>
              <div className="p-4">
                <div className="relative aspect-[2/1] overflow-hidden rounded-2xl bg-slate-200 shadow-sm">
                  {currentBanner.imageUrl ? (
                    <img
                      src={currentBanner.imageUrl}
                      alt="Banner preview"
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.src = fallbackImage;
                      }}
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-slate-400">
                      <ImageIcon className="w-10 h-10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <h4 className="line-clamp-2 text-lg font-black leading-tight text-white">
                      {currentBanner.headline || 'Tiêu đề banner'}
                    </h4>
                    <p className="mt-1 line-clamp-1 text-xs font-semibold text-white/90">
                      {currentBanner.subHeadline || 'Phụ đề hiển thị tại đây'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-1.5">
                  {banners.map((_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 rounded-full transition-all ${index === currentIndex ? 'w-5 bg-slate-900' : 'w-1.5 bg-slate-300'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="mt-5 max-w-xs text-center text-xs font-medium text-slate-500">
              Preview mô phỏng tỉ lệ banner trên mobile. Ảnh nên dùng tỉ lệ 2:1 để không bị cắt nội dung chính.
            </p>
          </section>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-5 sm:px-6 py-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={handleDeleteBanner}
            disabled={isBusy || banners.length <= 1}
            className="h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Xóa banner này
          </button>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSaveToFirebase}
              disabled={isBusy}
              className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Đang lưu...' : 'Lưu lên app'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
