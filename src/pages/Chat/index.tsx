import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  where,
  increment 
} from 'firebase/firestore';
import {
  Search,
  MessageCircle,
  ImagePlus,
  Send,
  UserCircle2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '../../firebase';

// 🌟 1. THÊM UNREADCOUNTS VÀO TYPE
type ChatChannel = {
  id: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  receiverId?: string;
  productName?: string;
  productImage?: string;
  lastMessage?: string;
  lastUpdated?: any;
  status?: string;
  type?: string;
  lastSenderId?: string;
  unreadCounts?: Record<string, number>; // Map đếm tin nhắn
};

type ChatMessage = {
  id: string;
  channelId?: string;
  senderId?: string;
  senderName?: string;
  content?: string;
  timestamp?: any;
  isAdmin?: boolean;
  type?: 'TEXT' | 'IMAGE';
  mediaUrl?: string;
};

const formatChannelTime = (value: any) => {
  if (!value) return '--:--';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  return isToday
    ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(date);
};

const formatMessageTime = (value: any) => {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
};

const orderTokenRegex = /#([A-Za-z0-9]{6,20})/g;

const renderSmartContent = (text: string) => {
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of text.matchAll(orderTokenRegex)) {
    const fullToken = match[0];
    const token = match[1];
    const start = match.index ?? 0;

    if (start > cursor) {
      nodes.push(<span key={`plain-${key++}`}>{text.slice(cursor, start)}</span>);
    }

    nodes.push(
      <Link
        key={`link-${key++}`}
        to={`/orders?refundId=${encodeURIComponent(token)}`}
        className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700 hover:bg-sky-200 hover:underline transition-colors"
      >
        {fullToken}
      </Link>
    );

    cursor = start + fullToken.length;
  }

  if (cursor < text.length) {
    nodes.push(<span key={`plain-${key++}`}>{text.slice(cursor)}</span>);
  }

  return nodes.length > 0 ? nodes : text;
};

type ChannelItemProps = {
  channel: ChatChannel;
  isActive: boolean;
  onSelect: (channel: ChatChannel) => void;
};

function ChannelItem({ channel, isActive, onSelect }: ChannelItemProps) {
  // 🌟 2. CHUẨN HOÁ GIAO DIỆN UNREAD Ở SIDEBAR DỰA VÀO MAP
  const unreadCount = channel.unreadCounts?.['ADMIN'] || 0;
  const hasUnread = unreadCount > 0;

  return (
    <button
      onClick={() => onSelect(channel)}
      className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
        isActive
          ? 'bg-emerald-50 border-emerald-200 shadow-sm'
          : hasUnread
          ? 'bg-sky-50 border-sky-200'
          : 'bg-white border-transparent hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 relative">
          {channel.userAvatar ? (
            <img
              src={channel.userAvatar}
              alt={channel.userName || 'Khách'}
              className="h-10 w-10 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 grid place-items-center text-slate-400">
              <UserCircle2 className="w-6 h-6" />
            </div>
          )}
          {/* Badge báo số lượng tin */}
          {hasUnread && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border border-white shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-sm ${hasUnread ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
              {channel.userName || 'Khách hàng'}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[11px] font-semibold ${hasUnread ? 'text-sky-600' : 'text-slate-400'}`}>
                {formatChannelTime(channel.lastUpdated)}
              </span>
            </div>
          </div>
          <p className={`mt-1 truncate text-xs ${hasUnread ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>
            {channel.lastMessage || 'Chưa có tin nhắn'}
          </p>
        </div>
      </div>
    </button>
  );
}

type MessageBubbleProps = {
  message: ChatMessage;
  currentUserUid?: string;
};

function MessageBubble({ message, currentUserUid }: MessageBubbleProps) {
  const fromAdmin = Boolean(message.isAdmin);
  const senderLabel = message.senderId === currentUserUid
    ? 'Bạn'
    : (message.senderName || 'Admin');

  return (
    <div className={`flex ${fromAdmin ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm border ${
          fromAdmin
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400'
            : 'bg-slate-100 text-slate-800 border-slate-200'
        }`}
      >
        {fromAdmin && (
          <span className="block mb-1 text-[10px] font-semibold opacity-75">
            {senderLabel}
          </span>
        )}
        {message.type === 'IMAGE' && message.mediaUrl ? (
          <img src={message.mediaUrl} alt="Ảnh chat" className="max-h-72 w-full rounded-xl object-contain bg-white/10" />
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{renderSmartContent(message.content || '')}</p>
        )}
        <p className={`mt-1 text-[11px] ${fromAdmin ? 'text-emerald-100' : 'text-slate-400'}`}>{formatMessageTime(message.timestamp)}</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState('');
  const [isChannelsLoaded, setIsChannelsLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const selectedChannelIdFromUrl = searchParams.get('id') || '';
  const urlUserId = searchParams.get('userId') || '';
  const handledUrlUserIdRef = useRef<string | null>(null);

  const handleSelectChannel = (channel: ChatChannel) => {
    setSelectedChannel(channel);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('id', channel.id);
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    document.title = "Chăm Sóc Khách Hàng - Gunpla Store";
  }, []);

  useEffect(() => {
    if (location.state) {
      const { activeChannelId, prefillText } = location.state as any;
      if (prefillText) setMessageInput(prefillText);
      if (activeChannelId) {
        const currentId = searchParams.get('id');
        if (currentId !== activeChannelId) {
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set('id', activeChannelId);
          setSearchParams(nextParams, { replace: true });
        }
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, searchParams, setSearchParams]);

  useEffect(() => {
    const channelsQuery = query(collection(db, 'channels'), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(channelsQuery, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<ChatChannel, 'id'>),
      }));
      setChannels(data);
      setIsChannelsLoaded(true);

      if (data.length === 0) {
        setSelectedChannel(null);
        return;
      }

      setSelectedChannel((prev) => {
        if (prev) {
          const freshSelected = data.find((channel) => channel.id === prev.id);
          if (freshSelected) return freshSelected;
        }
        if (selectedChannelIdFromUrl) {
          const fromUrl = data.find((channel) => channel.id === selectedChannelIdFromUrl);
          if (fromUrl) return fromUrl;
        }
        return data[0];
      });
    });

    return () => unsubscribe();
  }, [selectedChannelIdFromUrl]);

  const isCreatingRef = useRef(false);

  useEffect(() => {
    const checkAndCreateChannel = async () => {
      if (!isChannelsLoaded || !urlUserId) return;
      if (handledUrlUserIdRef.current === urlUserId || isCreatingRef.current) return;

      isCreatingRef.current = true;

      const clearUrlParam = () => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('userId');
        setSearchParams(nextParams, { replace: true });
      };

      try {
        const q = query(
          collection(db, 'channels'),
          where('userId', '==', urlUserId),
          where('type', '==', 'SUPPORT')
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const existingDoc = querySnapshot.docs[0];
          setSelectedChannel({
            id: existingDoc.id,
            ...(existingDoc.data() as Omit<ChatChannel, 'id'>),
          });
          handledUrlUserIdRef.current = urlUserId;
          return;
        }

        const userSnap = await getDoc(doc(db, 'users', urlUserId));
        let realName = 'Khách hàng';
        let realAvatar = '';

        if (userSnap.exists()) {
          const userData = userSnap.data();
          realName = userData?.name || userData?.email || 'Khách hàng';
          realAvatar = userData?.avatarUrl || '';
        }

        const newChannelData = {
          userId: urlUserId,
          participants: [urlUserId],
          userName: realName,
          userAvatar: realAvatar,
          receiverId: 'ADMIN',
          type: 'SUPPORT',
          status: 'PENDING',
          lastMessage: 'Bắt đầu hỗ trợ khách hàng',
          lastUpdated: Date.now(),
          lastSenderId: 'ADMIN',
          // 🌟 KHỞI TẠO MAP UNREAD
          unreadCounts: {
            'ADMIN': 0,
            [urlUserId]: 1
          }
        };

        const channelRef = await addDoc(collection(db, 'channels'), newChannelData);

        await addDoc(collection(db, 'channels', channelRef.id, 'messages'), {
          channelId: channelRef.id,
          senderId: 'SYSTEM',
          content: 'Hệ thống: Bắt đầu hội thoại hỗ trợ.',
          timestamp: Date.now(),
          isAdmin: true,
          type: 'TEXT',
          mediaUrl: '',
        });

        setSelectedChannel({ id: channelRef.id, ...newChannelData });
        handledUrlUserIdRef.current = urlUserId;
      } catch (error) {
        console.error('Failed to create/select support channel:', error);
        handledUrlUserIdRef.current = null;
        toast.error('Không thể tạo hội thoại mới. Vui lòng thử lại.');
      } finally {
        clearUrlParam();
        isCreatingRef.current = false;
      }
    };

    void checkAndCreateChannel();
  }, [channels, isChannelsLoaded, searchParams, setSearchParams, urlUserId]);

  // 🌟 3. RESET TIN NHẮN CHƯA ĐỌC CỦA ADMIN VỀ 0 KHI MỞ CHAT LÊN
  useEffect(() => {
    if (!selectedChannel?.id) {
      setMessages([]);
      return;
    }

    // Update unread count to 0 for ADMIN
    try {
      updateDoc(doc(db, 'channels', selectedChannel.id), {
        'unreadCounts.ADMIN': 0
      });
    } catch (e) {
      console.error(e);
    }

    const messagesQuery = query(collection(db, 'channels', selectedChannel.id, 'messages'));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<ChatMessage, 'id'>),
      }));
      const sortedData = data.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      setMessages(sortedData);
    });

    return () => unsubscribe();
  }, [selectedChannel?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [messages.length, selectedChannel?.id]);

  const filteredChannels = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return channels;
    return channels.filter((channel) => String(channel.userName || '').toLowerCase().includes(keyword));
  }, [channels, searchTerm]);

  const handlePickImage = () => {
    fileInputRef.current?.click();
  };

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'gundame-storepromax');

    const response = await fetch('https://api.cloudinary.com/v1_1/djk7z1i0w/image/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload image failed');
    }

    const payload = await response.json();
    return payload?.secure_url as string;
  };

  const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh hợp lệ.');
      event.target.value = '';
      return;
    }

    try {
      setIsUploadingImage(true);
      const secureUrl = await uploadToCloudinary(file);
      if (!secureUrl) throw new Error('Không nhận được URL ảnh');
      setPendingImageUrl(secureUrl);
      toast.success('Ảnh đã tải lên thành công!');
    } catch (error) {
      console.error(error);
      toast.error('Không thể tải ảnh lên. Vui lòng thử lại.');
    } finally {
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  const sendSingleMessage = async (channelId: string, payload: Omit<ChatMessage, 'id'>) => {
    await addDoc(collection(db, 'channels', channelId, 'messages'), payload);
  };

  const handleSendMessage = async () => {
    if (!selectedChannel) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    const senderId = currentUser.uid;
    const senderName = currentUser.displayName || currentUser.email || 'Admin';

    const text = messageInput.trim();
    const hasText = text.length > 0;
    const hasImage = Boolean(pendingImageUrl);

    if (!hasText && !hasImage) return;

    try {
      const channelRef = doc(db, 'channels', selectedChannel.id);
      let lastMessage = selectedChannel.lastMessage || '';

      if (hasImage) {
        await sendSingleMessage(selectedChannel.id, {
          channelId: selectedChannel.id,
          senderId,
          senderName,
          content: '',
          timestamp: Date.now(),
          isAdmin: true,
          type: 'IMAGE',
          mediaUrl: pendingImageUrl,
        });
        lastMessage = 'Đã gửi ảnh';
      }

      if (hasText) {
        await sendSingleMessage(selectedChannel.id, {
          channelId: selectedChannel.id,
          senderId,
          senderName,
          content: text,
          timestamp: Date.now(),
          isAdmin: true,
          type: 'TEXT',
          mediaUrl: '',
        });
        lastMessage = text;
      }

      // 🌟 4. TĂNG SỐ ĐẾM UNREAD CHO KHÁCH HÀNG KHI ADMIN GỬI
      const customerId = selectedChannel.userId;
      const updateData: any = {
        lastMessage,
        lastUpdated: Date.now(),
        lastSenderId: 'ADMIN',
      };
      
      if (customerId) {
         updateData[`unreadCounts.${customerId}`] = increment(1);
      }

      await updateDoc(channelRef, updateData);

      setMessageInput('');
      setPendingImageUrl('');
    } catch (error) {
      console.error(error);
      toast.error('Không thể gửi tin nhắn. Vui lòng thử lại.');
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm flex">
      <aside className="w-[320px] shrink-0 border-r border-slate-200 bg-slate-50/70 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo tên khách hàng..."
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {filteredChannels.length === 0 ? (
            <div className="h-full grid place-items-center text-center text-slate-400 px-4">
              <div>
                <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">Không tìm thấy hội thoại phù hợp</p>
              </div>
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={selectedChannel?.id === channel.id}
                onSelect={handleSelectChannel}
              />
            ))
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col bg-white">
        {!selectedChannel ? (
          <div className="flex-1 grid place-items-center text-center text-slate-400 px-6">
            <div>
              <MessageCircle className="w-16 h-16 mx-auto mb-3 opacity-35" />
              <p className="text-lg font-bold text-slate-500">Chọn một đoạn hội thoại để bắt đầu</p>
              <p className="text-sm mt-1">Tin nhắn sẽ cập nhật theo thời gian thực.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="shrink-0 border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4 bg-white">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{selectedChannel.userName || 'Khách hàng'}</p>
                {selectedChannel.productName && (
                  <p className="text-xs text-slate-500 truncate">Quan tâm: {selectedChannel.productName}</p>
                )}
              </div>

              {selectedChannel.productImage ? (
                <img
                  src={selectedChannel.productImage}
                  alt={selectedChannel.productName || 'Sản phẩm'}
                  className="h-11 w-11 rounded-xl object-cover border border-slate-200"
                />
              ) : null}
            </header>

            <section className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-gradient-to-b from-white to-slate-50/60">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  currentUserUid={auth.currentUser?.uid || ''}
                />
              ))}

              {pendingImageUrl && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl border border-emerald-200 bg-emerald-50 p-2">
                    <img src={pendingImageUrl} alt="Ảnh chờ gửi" className="max-h-52 w-full rounded-xl object-contain" />
                    <p className="mt-1 text-[11px] font-semibold text-emerald-700">Ảnh đã sẵn sàng để gửi</p>
                  </div>
                </div>
              )}

              <div ref={messageEndRef} />
            </section>

            <footer className="shrink-0 border-t border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelected}
                  className="hidden"
                />

                <button
                  onClick={handlePickImage}
                  disabled={isUploadingImage}
                  className="h-11 w-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 grid place-items-center transition-colors disabled:opacity-60"
                  title="Tải ảnh"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>

                <div className="flex-1 relative">
                  <input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder={isUploadingImage ? 'Đang tải ảnh...' : 'Nhập tin nhắn...'}
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  />
                </div>

                {pendingImageUrl ? (
                  <button
                    onClick={() => setPendingImageUrl('')}
                    className="h-11 w-11 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 grid place-items-center transition-colors"
                    title="Bỏ ảnh"
                  >
                    <X className="w-5 h-5" />
                  </button>
                ) : null}

                <button
                  onClick={() => void handleSendMessage()}
                  disabled={isUploadingImage || (!messageInput.trim() && !pendingImageUrl)}
                  className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm inline-flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Send className="w-4 h-4" /> Gửi
                </button>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}