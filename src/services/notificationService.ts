import { collection, addDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-hot-toast';

const FCM_ENDPOINT = 'https://gunpla-backend-ht5n.onrender.com/api/send-fcm';

// ============================================================================
// Helper gọi FCM backend — dùng chung cho cả 2 hàm (Do bạn tối ưu rất tốt)
// ============================================================================
async function sendFcmPush(payload: {
  targetToken: string;
  title: string;
  body: string;
  type: string;
  orderId?: string;
  imageUrl?: string;
  action?: string;
  channelId?: string;
}) {
  const res = await fetch(FCM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`FCM push thất bại: ${res.status} ${res.statusText}`);
  }
}

/**
 * 📬 Notification Helper Functions (Cho Web Admin)
 */

// ============================================================================
// 1. THÔNG BÁO ĐƠN HÀNG MỚI
// ============================================================================
export async function notifyNewOrder(orderId: string, customerName: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Đơn hàng mới #${orderId}`,
      message: `Khách hàng ${customerName} vừa tạo đơn, cần xác nhận trong 15 phút.`,
      type: 'ORDER',
      targetId: orderId,
      orderId,
      targetRoles: ['ADMIN', 'INVENTORY'],
      readBy: [],
      createdAt: Date.now(),
    });
    toast.success('Thông báo đơn hàng mới đã gửi!', { duration: 1500 });
  } catch (error) {
    console.error('Lỗi tạo thông báo đơn hàng:', error);
  }
}

// ============================================================================
// 2. THÔNG BÁO SẢN PHẨM SẮP HẾT KHOÁ
// ============================================================================
export async function notifyLowStock(productName: string, currentStock: number, productId?: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: 'Sản phẩm sắp hết kho',
      message: `${productName} còn dưới ${currentStock} sản phẩm.`,
      type: 'INVENTORY',
      targetId: productId || productName,
      productId: productId || null,
      targetRoles: ['ADMIN', 'INVENTORY', 'STAFF'],
      readBy: [],
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo sắp hết kho:', error);
  }
}

// ============================================================================
// 3. THÔNG BÁO THANH TOÁN THÀNH CÔNG
// ============================================================================
export async function notifyPaymentSuccess(orderId: string, amount: number) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Thanh toán thành công #${orderId}`,
      message: `Khách hàng thanh toán ${amount.toLocaleString('vi-VN')}đ. Đơn đã xác nhận và sẵn sàng vận chuyển.`,
      type: 'ORDER',
      targetId: orderId,
      orderId,
      targetRoles: ['ADMIN', 'INVENTORY'],
      readBy: [],
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo thanh toán:', error);
  }
}

// ============================================================================
// 4. THÔNG BÁO GIAO HÀNG
// ============================================================================
export async function notifyOrderShipped(orderId: string, trackingNumber: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Đơn hàng #${orderId} đã giao hàng`,
      message: `Mã vận chuyển: ${trackingNumber}. Khách hàng sẽ nhận được thông báo.`,
      type: 'ORDER',
      targetId: orderId,
      orderId,
      targetRoles: ['ADMIN', 'INVENTORY', 'STAFF'],
      readBy: [],
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo giao hàng:', error);
  }
}

// ============================================================================
// 5. THÔNG BÁO HỖ TRỢ KHÁCH HÀNG
// ============================================================================
export async function notifyCustomerSupport(
  customerName: string,
  issueType: 'return' | 'complaint' | 'inquiry' | 'other',
  userId?: string
) {
  const issueTypeLabel = {
    return: 'Yêu cầu trả hàng',
    complaint: 'Khiếu nại',
    inquiry: 'Tư vấn',
    other: 'Vấn đề khác',
  };

  try {
    await addDoc(collection(db, 'notifications'), {
      title: `${issueTypeLabel[issueType]} từ ${customerName}`,
      message: `Khách hàng ${customerName} có ${issueTypeLabel[issueType].toLowerCase()}. Vui lòng kiểm tra sớm.`,
      type: 'CHAT',
      targetId: userId || null,
      userId: userId || null,
      targetRoles: ['ADMIN', 'STAFF'],
      readBy: [],
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo hỗ trợ:', error);
  }
}

// ============================================================================
// 6. THÔNG BÁO CẢNH BÁO HỆ THỐNG
// ============================================================================
export async function notifySystemAlert(title: string, message: string, severity: 'info' | 'warning' | 'error' = 'info') {
  try {
    const rolesByPriority = {
      info: ['ADMIN', 'INVENTORY', 'STAFF'],
      warning: ['ADMIN', 'INVENTORY'],
      error: ['ADMIN'],
    };

    await addDoc(collection(db, 'notifications'), {
      title,
      message,
      type: 'SYSTEM',
      targetRoles: rolesByPriority[severity],
      readBy: [],
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo cảnh báo:', error);
  }
}

// ============================================================================
// 7. THÔNG BÁO THAY ĐỔI QUYỀN HẠN
// ============================================================================
export async function notifyRoleChanged(userName: string, oldRole: string, newRole: string, changedByAdmin: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Quyền hạn ${userName} đã thay đổi`,
      message: `${changedByAdmin} đã thay đổi quyền từ ${oldRole} → ${newRole}. Tài khoản sẽ được đăng xuất để cập nhật quyền.`,
      type: 'SYSTEM',
      targetRoles: ['ADMIN'],
      readBy: [],
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo thay đổi quyền:', error);
  }
}

// ============================================================================
// 8. THÔNG BÁO KHUYẾN MÃI / SALE
// ============================================================================
export async function notifyPromotionStarted(promotionName: string, discount: number, endTime: Date) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Khuyến mãi ${promotionName} đã bắt đầu`,
      message: `Giảm giá đến ${discount}%. Kết thúc vào ${endTime.toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
      type: 'PROMO',
      targetRoles: ['ADMIN', 'INVENTORY', 'STAFF'],
      readBy: [],
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo khuyến mãi:', error);
  }
}

// ============================================================================
// 9. THÔNG BÁO ĐÁNH GIÁ SẢN PHẨM MỚI
// ============================================================================
export async function notifyNewReview(productName: string, customerName: string, rating: number, reviewId?: string, productId?: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Đánh giá mới cho ${productName}`,
      message: `${customerName} đã đánh giá ${rating} ⭐. Hãy kiểm tra nội dung đánh giá.`,
      type: 'REVIEW',
      targetId: reviewId || productId || null,
      productId: productId || null,
      targetRoles: ['ADMIN', 'INVENTORY'],
      readBy: [],
      createdAt: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi tạo thông báo đánh giá:', error);
  }
}

// ============================================================================
// 10. THÔNG BÁO CHUNG (Custom)
// ============================================================================
export async function createCustomNotification(
  title: string,
  message: string,
  targetRoles: string[] = ['ADMIN'],
  options: { type?: string; targetId?: string; orderId?: string; productId?: string; userId?: string; channelId?: string; action?: string } = {}
) {
  try {
    const cleanOptions = Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined && value !== ''));
    await addDoc(collection(db, 'notifications'), {
      title,
      message,
      ...cleanOptions,
      targetRoles: targetRoles.map((role) => role.toUpperCase()),
      readBy: [],
      createdAt: Date.now(),
    });
    toast.success('Thông báo tùy chỉnh đã gửi!', { duration: 1500 });
  } catch (error) {
    console.error('Lỗi tạo thông báo tùy chỉnh:', error);
    toast.error('Lỗi gửi thông báo');
  }
}

// ============================================================================
// 11. GỬI THÔNG BÁO CHO USER APP (Firestore sub-collection + FCM push)
// ============================================================================
export async function sendNotificationToAppUser(
  userId: string,
  title: string,
  body: string,
  type: string = 'ORDER',
  orderId?: string,
  imageUrl?: string,
  action?: string
) {
  const defaultAction = orderId ? 'VIEW_ORDER' : 'VIEW_HOME';
  const resolvedAction = action || defaultAction;

  try {
    // 1. Lưu vào Firestore sub-collection trước
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      userId,
      title,
      body,
      type,
      orderId: orderId ?? null,
      imageUrl: imageUrl ?? null,
      action: resolvedAction,
      isRead: false,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Lỗi lưu thông báo Firestore:', error);
    return;
  }

  // 2. Lấy FCM token và bắn push — lỗi FCM không ảnh hưởng Firestore đã lưu
  try {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return;

    const fcmToken = (userSnap.data()?.fcmToken as string | undefined)?.trim();
    if (!fcmToken) return;

    await sendFcmPush({
      targetToken: fcmToken,
      title,
      body,
      type,
      orderId,
      imageUrl,
      action: resolvedAction,
    });

    console.log(`Đã gửi thông báo cho User: ${userId}`);
  } catch (pushError) {
    console.error('Lỗi gửi FCM push:', pushError);
  }
}

// ============================================================================
// 12. THÔNG BÁO TIN NHẮN CHAT MỚI
// ============================================================================
export async function sendChatNotification(
  senderName: string,
  receiverId: string,
  messageContent: string,
  channelId: string
) {
  try {
    const targetTokens: string[] = [];

    // 1. Lấy FCM token(s) của người nhận
    if (receiverId === 'ADMIN') {
      const adminSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'ADMIN'))
      );
      adminSnap.forEach(d => {
        const token = (d.data().fcmToken as string | undefined)?.trim();
        if (token) targetTokens.push(token);
      });
    } else {
      const userSnap = await getDoc(doc(db, 'users', receiverId));
      if (userSnap.exists()) {
        const token = (userSnap.data()?.fcmToken as string | undefined)?.trim();
        if (token) targetTokens.push(token);
      }
    }

    if (targetTokens.length === 0) {
      console.warn(`Không tìm thấy FCM token cho: ${receiverId}`);
      return;
    }

    const shortMessage =
      messageContent.length > 100
        ? messageContent.substring(0, 97) + '...'
        : messageContent;

    // 2. Bắn FCM song song cho tất cả token
    await Promise.all(
      targetTokens.map(token =>
        sendFcmPush({
          targetToken: token,
          title: `Tin nhắn mới từ ${senderName}`,
          body: shortMessage,
          type: 'CHAT_MESSAGE',
          action: 'VIEW_CHAT',
          channelId,
        })
      )
    );

    console.log(`Đã gửi thông báo Chat đến: ${receiverId}`);
  } catch (error) {
    console.error('Lỗi khi bắn thông báo Chat:', error);
  }
}
