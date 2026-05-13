export type RoutableNotification = {
  title?: string;
  message?: string;
  type?: string;
  targetId?: string;
  orderId?: string;
  productId?: string;
  userId?: string;
  channelId?: string;
  action?: string;
};

const clean = (value?: string | null) => String(value || '').trim();

const normalize = (value?: string | null) =>
  clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const getOrderToken = (notification: RoutableNotification) => {
  const source = `${notification.title || ''} ${notification.message || ''}`;
  const hashMatch = source.match(/#([A-Za-z0-9_-]{6,40})/);
  if (hashMatch?.[1]) return hashMatch[1];

  const orderMatch = normalize(source).match(/\b(?:ORDER|DON|DON HANG)[\s:#-]*([A-Za-z0-9_-]{6,40})\b/);
  return orderMatch?.[1] || '';
};

export const getNotificationRoute = (notification: RoutableNotification) => {
  const type = normalize(notification.type);
  const action = normalize(notification.action);
  const titleAndMessage = normalize(`${notification.title || ''} ${notification.message || ''}`);
  const targetId = clean(notification.targetId);
  const orderId = clean(notification.orderId) || (type.includes('ORDER') ? targetId : '') || getOrderToken(notification);
  const productId = clean(notification.productId) || (['INVENTORY', 'PRODUCT', 'LOW_STOCK'].some((key) => type.includes(key)) ? targetId : '');
  const channelId = clean(notification.channelId) || (targetId.startsWith('SUPPORT_') ? targetId : '');
  const userId = clean(notification.userId) || (channelId ? '' : targetId);

  if (
    orderId &&
    (type.includes('ORDER') ||
      type.includes('PAYMENT') ||
      type.includes('REFUND') ||
      type.includes('RETURN') ||
      action.includes('ORDER') ||
      titleAndMessage.includes('DON HANG') ||
      titleAndMessage.includes('ORDER') ||
      titleAndMessage.includes('THANH TOAN'))
  ) {
    return `/orders?orderId=${encodeURIComponent(orderId)}`;
  }

  if (
    type.includes('CHAT') ||
    action.includes('CHAT') ||
    titleAndMessage.includes('TIN NHAN') ||
    titleAndMessage.includes('YEU CAU TRA HANG') ||
    titleAndMessage.includes('KHIEU NAI') ||
    titleAndMessage.includes('TU VAN')
  ) {
    if (channelId) return `/chat?id=${encodeURIComponent(channelId)}`;
    if (userId) return `/chat?userId=${encodeURIComponent(userId)}`;
    return '/chat';
  }

  if (
    type.includes('INVENTORY') ||
    type.includes('PRODUCT') ||
    type.includes('LOW_STOCK') ||
    titleAndMessage.includes('SAN PHAM') ||
    titleAndMessage.includes('KHO')
  ) {
    return productId ? `/products?search=${encodeURIComponent(productId)}` : '/products';
  }

  if (type.includes('REVIEW') || titleAndMessage.includes('DANH GIA')) {
    return '/reviews';
  }

  if (type.includes('PROMO') || type.includes('VOUCHER') || titleAndMessage.includes('KHUYEN MAI')) {
    return '/vouchers';
  }

  return null;
};
