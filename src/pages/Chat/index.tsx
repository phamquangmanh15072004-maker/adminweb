import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  ImagePlus,
  Loader2,
  MessageCircle,
  Search,
  Send,
  UserCircle2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auth, db } from '../../firebase';
import { sendNotificationToAppUser } from '../../services/notificationService';

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
  unreadCounts?: Record<string, number>;
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

type LocalMessageStatus = 'sending' | 'failed';

type LocalChatMessage = ChatMessage & {
  id: string;
  channelId: string;
  customerId?: string;
  localPreviewUrl?: string;
  file?: File;
  status: LocalMessageStatus;
  errorMessage?: string;
};

const NETWORK_TIMEOUT_MS = 15_000;
const IMAGE_UPLOAD_TIMEOUT_MS = 45_000;
const ADMIN_LABEL = 'Chăm sóc khách hàng';

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
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

const getMessageMillis = (value: any) => {
  if (!value) return 0;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const isSameDay = (first: any, second: any) => {
  const firstDate = new Date(getMessageMillis(first));
  const secondDate = new Date(getMessageMillis(second));
  return (
    firstDate.getDate() === secondDate.getDate() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getFullYear() === secondDate.getFullYear()
  );
};

const formatDateSeparator = (value: any) => {
  const date = new Date(getMessageMillis(value));
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'Hôm nay';
  if (isSameDay(date, yesterday)) return 'Hôm qua';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date);
};

const newLocalMessageId = () => {
  if (window.crypto?.randomUUID) return `local-${window.crypto.randomUUID()}`;
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function ChannelItem({
  channel,
  isActive,
  onSelect,
}: {
  channel: ChatChannel;
  isActive: boolean;
  onSelect: (channel: ChatChannel) => void;
}) {
  const unreadCount = channel.unreadCounts?.ADMIN || 0;
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
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
            <span className={`text-[11px] font-semibold shrink-0 ${hasUnread ? 'text-sky-600' : 'text-slate-400'}`}>
              {formatChannelTime(channel.lastUpdated)}
            </span>
          </div>
          <p className={`mt-1 truncate text-xs ${hasUnread ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}`}>
            {channel.lastMessage || 'Chưa có tin nhắn'}
          </p>
        </div>
      </div>
    </button>
  );
}

function DateSeparator({ timestamp }: { timestamp: any }) {
  const label = formatDateSeparator(timestamp);
  if (!label) return null;

  return (
    <div className="flex justify-center py-2">
      <span className="rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-bold text-slate-500">
        {label}
      </span>
    </div>
  );
}

function MessageBubble({
  message,
  currentUserUid,
  isTimeVisible,
  onToggleTime,
  onRetry,
  onDismiss,
}: {
  message: ChatMessage | LocalChatMessage;
  currentUserUid?: string;
  isTimeVisible: boolean;
  onToggleTime: () => void;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  const fromAdmin = Boolean(message.isAdmin);
  const senderLabel = message.senderId === currentUserUid ? 'Bạn' : message.senderName || 'Admin';
  const localStatus = 'status' in message ? message.status : undefined;
  const mediaUrl = 'localPreviewUrl' in message && message.localPreviewUrl ? message.localPreviewUrl : message.mediaUrl;
  const isSending = localStatus === 'sending';
  const isFailed = localStatus === 'failed';

  return (
    <div className={`flex flex-col ${fromAdmin ? 'items-end' : 'items-start'}`}>
      <button
        type="button"
        onClick={onToggleTime}
        className={`max-w-[80%] text-left rounded-2xl shadow-sm border overflow-hidden ${
          message.type === 'IMAGE'
            ? fromAdmin
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-100 border-slate-200'
            : fromAdmin
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-400 px-3.5 py-2.5'
              : 'bg-slate-100 text-slate-800 border-slate-200 px-3.5 py-2.5'
        }`}
      >
        {fromAdmin && message.type !== 'IMAGE' && <span className="block mb-1 text-[10px] font-semibold opacity-75">{senderLabel}</span>}
        {message.type === 'IMAGE' && mediaUrl ? (
          <div className="relative">
            <img src={mediaUrl} alt="Ảnh chat" className={`max-h-72 max-w-[320px] rounded-2xl object-contain ${isSending ? 'opacity-65' : ''}`} />
            {isSending && (
              <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/20">
                <Loader2 className="h-7 w-7 animate-spin text-white drop-shadow" />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{renderSmartContent(message.content || '')}</p>
        )}
      </button>

      {(isTimeVisible || localStatus) && (
        <div className={`mt-1 flex items-center gap-2 text-[11px] ${fromAdmin ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
          {isTimeVisible && <span className="text-slate-400">{formatMessageTime(message.timestamp)}</span>}
          {isSending && <span className="font-semibold text-slate-400">Đang gửi...</span>}
          {isFailed && (
            <>
              <button type="button" onClick={onRetry} className="font-bold text-rose-600 hover:underline">
                {('errorMessage' in message && message.errorMessage) || 'Gửi lỗi. Nhấn để gửi lại.'}
              </button>
              {onDismiss && (
                <button type="button" onClick={onDismiss} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Bỏ tin nhắn lỗi">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<LocalChatMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [expandedMessageId, setExpandedMessageId] = useState('');
  const [isChannelsLoaded, setIsChannelsLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const selectedChannelIdFromUrl = searchParams.get('id') || '';
  const urlUserId = searchParams.get('userId') || '';
  const handledUrlUserIdRef = useRef<string | null>(null);
  const isCreatingRef = useRef(false);

  const handleSelectChannel = (channel: ChatChannel) => {
    setSelectedChannel(channel);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('id', channel.id);
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    document.title = 'Chăm sóc khách hàng - Gunpla Store';
  }, []);

  useEffect(() => {
    if (!location.state) return;

    const { activeChannelId, prefillText } = location.state as any;
    if (prefillText) setMessageInput(prefillText);
    if (activeChannelId && searchParams.get('id') !== activeChannelId) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('id', activeChannelId);
      setSearchParams(nextParams, { replace: true });
    }
    window.history.replaceState({}, document.title);
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
        const channelId = `SUPPORT_${urlUserId}`;
        const channelRef = doc(db, 'channels', channelId);
        const channelSnap = await getDoc(channelRef);

        if (channelSnap.exists()) {
          setSelectedChannel({
            id: channelId,
            ...(channelSnap.data() as Omit<ChatChannel, 'id'>),
          });
        } else {
          const userSnap = await getDoc(doc(db, 'users', urlUserId));
          let realName = 'Khách hàng';
          let realAvatar = '';

          if (userSnap.exists()) {
            const userData = userSnap.data();
            realName = userData?.name || userData?.email || 'Khách hàng';
            realAvatar = userData?.avatarUrl || '';
          }

          const newChannelData: ChatChannel = {
            id: channelId,
            userId: urlUserId,
            userName: realName,
            userAvatar: realAvatar,
            receiverId: 'ADMIN',
            type: 'SUPPORT',
            status: 'PENDING',
            lastMessage: 'Bắt đầu hỗ trợ khách hàng',
            lastUpdated: Date.now(),
            lastSenderId: 'ADMIN',
            unreadCounts: {
              ADMIN: 0,
              [urlUserId]: 1,
            },
          };

          await setDoc(channelRef, {
            ...newChannelData,
            participants: [urlUserId],
          });

          await addDoc(collection(db, 'channels', channelId, 'messages'), {
            channelId,
            senderId: 'SYSTEM',
            content: 'Hệ thống: Bắt đầu hội thoại hỗ trợ.',
            timestamp: Date.now(),
            isAdmin: true,
            type: 'TEXT',
            mediaUrl: '',
          });

          setSelectedChannel(newChannelData);
        }

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

  useEffect(() => {
    if (!selectedChannel?.id) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(collection(db, 'channels', selectedChannel.id, 'messages'));
    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...(item.data() as Omit<ChatMessage, 'id'>),
      }));
      setMessages(data.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
    });

    return () => unsubscribe();
  }, [selectedChannel?.id]);

  useEffect(() => {
    if (selectedChannel?.id && selectedChannel?.unreadCounts?.ADMIN && selectedChannel.unreadCounts.ADMIN > 0) {
      updateDoc(doc(db, 'channels', selectedChannel.id), {
        'unreadCounts.ADMIN': 0,
      }).catch((error) => console.error('Lỗi reset số tin chưa đọc:', error));
    }
  }, [selectedChannel?.id, selectedChannel?.unreadCounts?.ADMIN]);

  const filteredChannels = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return channels;
    return channels.filter((channel) => String(channel.userName || '').toLowerCase().includes(keyword));
  }, [channels, searchTerm]);

  const displayedMessages = useMemo(() => {
    const activeChannelId = selectedChannel?.id;
    const activeLocalMessages = activeChannelId
      ? localMessages.filter((message) => message.channelId === activeChannelId)
      : [];

    return [...messages, ...activeLocalMessages].sort(
      (first, second) => getMessageMillis(first.timestamp) - getMessageMillis(second.timestamp)
    );
  }, [localMessages, messages, selectedChannel?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => window.clearTimeout(timer);
  }, [displayedMessages.length, selectedChannel?.id]);

  const uploadToCloudinary = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'gundame-storepromax');

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), IMAGE_UPLOAD_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.cloudinary.com/v1_1/djk7z1i0w/image/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Upload ảnh thất bại.');

      const payload = await response.json();
      return payload?.secure_url as string;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Upload ảnh quá lâu. Vui lòng kiểm tra mạng rồi thử lại.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const sendSingleMessage = async (channelId: string, payload: Omit<ChatMessage, 'id'>) => {
    await addDoc(collection(db, 'channels', channelId, 'messages'), payload);
  };

  const markLocalMessageFailed = (messageId: string, errorMessage: string) => {
    setLocalMessages((prev) =>
      prev.map((message) => (message.id === messageId ? { ...message, status: 'failed', errorMessage } : message))
    );
  };

  const sendLocalMessage = async (localMessage: LocalChatMessage) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      markLocalMessageFailed(localMessage.id, 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    setLocalMessages((prev) =>
      prev.map((message) =>
        message.id === localMessage.id ? { ...message, status: 'sending', errorMessage: '' } : message
      )
    );

    try {
      let mediaUrl = localMessage.mediaUrl || '';
      if (localMessage.type === 'IMAGE' && !mediaUrl) {
        if (!localMessage.file) throw new Error('Không tìm thấy file ảnh để gửi lại.');
        mediaUrl = await uploadToCloudinary(localMessage.file);
        if (!mediaUrl) throw new Error('Không nhận được URL ảnh.');
        setLocalMessages((prev) =>
          prev.map((message) => (message.id === localMessage.id ? { ...message, mediaUrl } : message))
        );
      }

      const isImage = localMessage.type === 'IMAGE';
      const content = isImage ? '' : (localMessage.content || '').trim();
      const lastMessage = isImage ? 'Đã gửi ảnh' : content;

      await withTimeout(
        sendSingleMessage(localMessage.channelId, {
          channelId: localMessage.channelId,
          senderId: currentUser.uid,
          senderName: ADMIN_LABEL,
          content,
          timestamp: Date.now(),
          isAdmin: true,
          type: localMessage.type,
          mediaUrl,
        }),
        NETWORK_TIMEOUT_MS,
        isImage ? 'Gửi ảnh quá lâu. Kiểm tra mạng rồi thử lại.' : 'Gửi tin nhắn quá lâu. Kiểm tra mạng rồi thử lại.'
      );

      setLocalMessages((prev) => {
        const sent = prev.find((message) => message.id === localMessage.id);
        if (sent?.localPreviewUrl) URL.revokeObjectURL(sent.localPreviewUrl);
        return prev.filter((message) => message.id !== localMessage.id);
      });

      const updateData: Record<string, any> = {
        lastMessage,
        lastUpdated: Date.now(),
        lastSenderId: 'ADMIN',
      };

      if (localMessage.customerId) {
        updateData[`unreadCounts.${localMessage.customerId}`] = increment(1);
      }

      try {
        await withTimeout(
          updateDoc(doc(db, 'channels', localMessage.channelId), updateData),
          NETWORK_TIMEOUT_MS,
          'Cập nhật hội thoại quá lâu. Kiểm tra mạng rồi thử lại.'
        );

        if (localMessage.customerId) {
          sendNotificationToAppUser(
            localMessage.customerId,
            `Tin nhắn mới từ ${ADMIN_LABEL}`,
            isImage ? 'Đã gửi một hình ảnh' : content,
            'CHAT_MESSAGE',
            localMessage.channelId,
            isImage ? mediaUrl : undefined,
            'VIEW_CHAT'
          ).catch((error) => console.error('Lỗi bắn push chat:', error));
        }
      } catch (error) {
        console.error('Tin nhắn đã gửi nhưng cập nhật hội thoại thất bại:', error);
        toast.error('Tin nhắn đã gửi nhưng cập nhật hội thoại hơi chậm.');
      }
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Không thể gửi tin nhắn. Vui lòng thử lại.';
      markLocalMessageFailed(localMessage.id, errorMessage);
      toast.error(errorMessage);
    }
  };

  const retryLocalMessage = (messageId: string) => {
    const localMessage = localMessages.find((message) => message.id === messageId);
    if (!localMessage) return;
    void sendLocalMessage(localMessage);
  };

  const dismissLocalMessage = (messageId: string) => {
    setLocalMessages((prev) => {
      const removed = prev.find((message) => message.id === messageId);
      if (removed?.localPreviewUrl) URL.revokeObjectURL(removed.localPreviewUrl);
      return prev.filter((message) => message.id !== messageId);
    });
  };

  const handleImageSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh hợp lệ.');
      event.target.value = '';
      return;
    }

    if (!selectedChannel) {
      toast.error('Vui lòng chọn hội thoại trước khi gửi ảnh.');
      event.target.value = '';
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      event.target.value = '';
      return;
    }

    const localMessage: LocalChatMessage = {
      id: newLocalMessageId(),
      channelId: selectedChannel.id,
      customerId: selectedChannel.userId,
      senderId: currentUser.uid,
      senderName: ADMIN_LABEL,
      content: '',
      timestamp: Date.now(),
      isAdmin: true,
      type: 'IMAGE',
      mediaUrl: '',
      localPreviewUrl: URL.createObjectURL(file),
      file,
      status: 'sending',
    };

    setLocalMessages((prev) => [...prev, localMessage]);
    void sendLocalMessage(localMessage);
    event.target.value = '';
  };

  const handleSendMessage = () => {
    if (!selectedChannel) return;

    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    const senderId = currentUser.uid;
    const text = messageInput.trim();
    if (!text) return;

    const localMessage: LocalChatMessage = {
      id: newLocalMessageId(),
      channelId: selectedChannel.id,
      customerId: selectedChannel.userId,
      senderId,
      senderName: ADMIN_LABEL,
      content: text,
      timestamp: Date.now(),
      isAdmin: true,
      type: 'TEXT',
      mediaUrl: '',
      status: 'sending',
    };

    setMessageInput('');
    setLocalMessages((prev) => [...prev, localMessage]);
    void sendLocalMessage(localMessage);
  };

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden bg-white border border-slate-200 rounded-3xl shadow-sm flex">
      <aside className="w-[320px] shrink-0 border-r border-slate-200 bg-slate-50/70 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
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
              <ChannelItem key={channel.id} channel={channel} isActive={selectedChannel?.id === channel.id} onSelect={handleSelectChannel} />
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
                {selectedChannel.productName && <p className="text-xs text-slate-500 truncate">Quan tâm: {selectedChannel.productName}</p>}
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
              {displayedMessages.map((message, index) => {
                const previous = displayedMessages[index - 1];
                const showDate = !previous || !isSameDay(previous.timestamp, message.timestamp);
                const isLocal = 'status' in message;

                return (
                  <div key={message.id} className="space-y-3">
                    {showDate && <DateSeparator timestamp={message.timestamp} />}
                    <MessageBubble
                      message={message}
                      currentUserUid={auth.currentUser?.uid || ''}
                      isTimeVisible={expandedMessageId === message.id}
                      onToggleTime={() => setExpandedMessageId((current) => (current === message.id ? '' : message.id))}
                      onRetry={isLocal ? () => retryLocalMessage(message.id) : undefined}
                      onDismiss={isLocal ? () => dismissLocalMessage(message.id) : undefined}
                    />
                  </div>
                );
              })}

              <div ref={messageEndRef} />
            </section>

            <footer className="shrink-0 border-t border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelected} className="hidden" />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-11 w-11 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 grid place-items-center transition-colors"
                  title="Tải ảnh"
                >
                  <ImagePlus className="w-5 h-5" />
                </button>

                <div className="flex-1 relative">
                  <input
                    value={messageInput}
                    onChange={(event) => setMessageInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Nhập tin nhắn..."
                    className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm inline-flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  Gửi
                </button>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
