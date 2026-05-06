import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'react-hot-toast';

/**
 * 📬 Notification Helper Functions
 * 
 * Dùng các hàm này để tạo thông báo trong ứng dụng.
 * Ví dụ: Khi tạo đơn hàng mới, gọi `notifyNewOrder(orderId, customerName)`
 */

// ============================================================================
// 1. THÔNG BÁO ĐƠN HÀNG MỚI
// ============================================================================
export async function notifyNewOrder(orderId: string, customerName: string) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Đơn hàng mới #${orderId}`,
      message: `Khách hàng ${customerName} vừa tạo đơn, cần xác nhận trong 15 phút.`,
      targetRoles: ['ADMIN', 'INVENTORY'],
      readBy: [],
      createdAt: Date.now(),
    });
    toast.success('Thông báo đơn hàng mới đã gửi!', { duration: 1500 });
  } catch (error) {
    console.error('Lỗi tạo thông báo đơn hàng:', error);
    toast.error('Lỗi gửi thông báo');
  }
}

// ============================================================================
// 2. THÔNG BÁO SẢN PHẨM SẮP HẾT KHOÁ
// ============================================================================
export async function notifyLowStock(productName: string, currentStock: number) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: 'Sản phẩm sắp hết kho',
      message: `${productName} còn dưới ${currentStock} sản phẩm.`,
      targetRoles: ['ADMIN', 'INVENTORY', 'STAFF'],
      readBy: [],
      createdAt: Date.now(),
    });
    toast.success('Thông báo sắp hết kho được gửi!', { duration: 1500 });
  } catch (error) {
    console.error('Lỗi tạo thông báo sắp hết kho:', error);
    toast.error('Lỗi gửi thông báo');
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
  issueType: 'return' | 'complaint' | 'inquiry' | 'other'
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
      targetRoles: ['ADMIN', 'STAFF'],
      readBy: [],
      createdAt: Date.now(),
    });
    toast.success(`Thông báo ${issueTypeLabel[issueType].toLowerCase()} đã gửi!`, { duration: 1500 });
  } catch (error) {
    console.error('Lỗi tạo thông báo hỗ trợ:', error);
    toast.error('Lỗi gửi thông báo');
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
      targetRoles: rolesByPriority[severity],
      readBy: [],
      createdAt: Date.now(),
    });

    toast.success('Thông báo cảnh báo hệ thống được gửi!', { duration: 1500 });
  } catch (error) {
    console.error('Lỗi tạo thông báo cảnh báo:', error);
    toast.error('Lỗi gửi thông báo');
  }
}

// ============================================================================
// 7. THÔNG BÁO THAY ĐỔI QUYỀN HẠN
// ============================================================================
export async function notifyRoleChanged(
  userName: string,
  oldRole: string,
  newRole: string,
  changedByAdmin: string
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Quyền hạn ${userName} đã thay đổi`,
      message: `${changedByAdmin} đã thay đổi quyền từ ${oldRole} → ${newRole}. Tài khoản sẽ được đăng xuất để cập nhật quyền.`,
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
export async function notifyPromotionStarted(
  promotionName: string,
  discount: number,
  endTime: Date
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Khuyến mãi ${promotionName} đã bắt đầu`,
      message: `Giảm giá đến ${discount}%. Kết thúc vào ${endTime.toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
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
export async function notifyNewReview(
  productName: string,
  customerName: string,
  rating: number
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title: `Đánh giá mới cho ${productName}`,
      message: `${customerName} đã đánh giá ${rating} ⭐. Hãy kiểm tra nội dung đánh giá.`,
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
  targetRoles: string[] = ['ADMIN']
) {
  try {
    await addDoc(collection(db, 'notifications'), {
      title,
      message,
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
// 11. THÔNG BÁO CHO KHÁCH HÀNG (HIỂN THỊ TRÊN APP ANDROID)
// ============================================================================
export async function sendNotificationToAppUser(
  userId: string,
  title: string,
  body: string,
  type: 'ORDER_UPDATE' | 'PROMO' | 'SYSTEM',
  orderId?: string,
  imageUrl?: string,
  action?: string
) {
  try {
    // Trỏ thẳng vào sub-collection của user đó
    const userNotifRef = collection(db, 'users', userId, 'notifications');
    
    await addDoc(userNotifRef, {
      userId: userId,
      title: title,
      body: body,
      type: type,
      orderId: orderId || null,
      imageUrl: imageUrl || null,
      action: action || (orderId ? 'VIEW_ORDER' : 'VIEW_HOME'),
      isRead: false, // App Android dùng isRead (chuẩn model của bạn)
      timestamp: Date.now()
    });

    try {
      const userDocSnap = await getDoc(doc(db, 'users', userId));
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as { fcmToken?: string };
        const fcmToken = String(userData?.fcmToken || '').trim();

        if (fcmToken) {
          await fetch('https://gunpla-backend-ht5n.onrender.com/api/send-fcm', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              targetToken: fcmToken,
              title,
              body,
              type,
              orderId,
            }),
          });
        }
      }
    } catch (pushError) {
      console.error('Lỗi gửi push notification qua backend:', pushError);
    }

    console.log(`Đã gửi thông báo cho User: ${userId}`);
  } catch (error) {
    console.error('Lỗi khi bắn thông báo cho User App:', error);
  }
}
// ============================================================================
// EXAMPLE USAGE (Dùng trong component)
// ============================================================================

/*
import {
  notifyNewOrder,
  notifyLowStock,
  notifyPaymentSuccess,
  createCustomNotification,
} from '../services/notificationService.ts';

// Trong useEffect hoặc event handler:

(1) Thông báo đơn hàng mới:
await notifyNewOrder('A2031', 'Nguyễn Văn A');

(2) Thông báo sắp hết kho:
await notifyLowStock('RG Strike Freedom', 3);

(3) Thông báo thanh toán:
await notifyPaymentSuccess('A2031', 5990000);

(4) Thông báo chung:
await createCustomNotification(
  'Bảo trì hệ thống',
  'Hệ thống sẽ bảo trì vào 22h hôm nay.',
  ['ADMIN', 'INVENTORY', 'STAFF']
);
*/
