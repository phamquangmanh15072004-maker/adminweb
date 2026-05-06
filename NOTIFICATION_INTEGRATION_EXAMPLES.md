# 💡 NotificationBell Integration Examples

## 📋 Table of Contents

1. [Products Page - Low Stock Alert](#products-page---low-stock-alert)
2. [Orders Page - New Order Alert](#orders-page---new-order-alert)
3. [Users Page - Role Change Alert](#users-page---role-change-alert)
4. [Chat Page - Customer Support Alert](#chat-page---customer-support-alert)
5. [Payment Processing - Payment Success Alert](#payment-processing---payment-success-alert)
6. [System Events - General Alerts](#system-events---general-alerts)

---

## Products Page - Low Stock Alert

### Where to Integrate:

**File:** `src/pages/Products/ProductTable.tsx` or `src/pages/Products/index.tsx`

### Scenario:

Khi cập nhật stock sản phẩm, nếu còn ≤ 5 sản phẩm, gửi alert cho ADMIN & INVENTORY.

### Code Example:

```typescript
import { notifyLowStock } from "../../services/notificationService";

// Trong component ProductTable hoặc modal edit stock
async function handleUpdateStock(
  productId: string,
  newStock: number,
  productName: string,
) {
  try {
    // 1. Cập nhật Firestore
    const productDocRef = doc(db, "products", productId);
    await updateDoc(productDocRef, {
      stock: newStock,
      updatedAt: Date.now(),
    });

    // 2. Kiểm tra stock, nếu sắp hết → gửi thông báo
    if (newStock > 0 && newStock <= 5) {
      await notifyLowStock(productName, newStock);
    }

    toast.success("Cập nhật stock thành công!");
  } catch (error) {
    toast.error("Lỗi cập nhật stock");
    console.error(error);
  }
}
```

### Full Example with UI:

```typescript
import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { notifyLowStock } from '../../services/notificationService';
import { toast } from 'react-hot-toast';

interface ProductStockModalProps {
  product: {
    id: string;
    name: string;
    stock: number;
  };
  onClose: () => void;
}

export function StockUpdateModal({ product, onClose }: ProductStockModalProps) {
  const [newStock, setNewStock] = useState(product.stock);
  const [isLoading, setIsLoading] = useState(false);

  async function handleUpdateStock() {
    setIsLoading(true);
    try {
      const productDocRef = doc(db, 'products', product.id);
      await updateDoc(productDocRef, {
        stock: newStock,
        updatedAt: Date.now(),
      });

      // Send notification if low stock
      if (newStock > 0 && newStock <= 5) {
        await notifyLowStock(product.name, newStock);
      }

      toast.success('Cập nhật stock thành công!');
      onClose();
    } catch (error) {
      toast.error('Lỗi cập nhật stock');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
        <h3 className="text-lg font-bold mb-4">Cập nhật stock: {product.name}</h3>

        <input
          type="number"
          value={newStock}
          onChange={(e) => setNewStock(Number(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 mb-4"
          min="0"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50"
            disabled={isLoading}
          >
            Hủy
          </button>
          <button
            onClick={handleUpdateStock}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>

        {newStock > 0 && newStock <= 5 && (
          <p className="mt-3 text-sm text-orange-600 bg-orange-50 p-2 rounded">
            ⚠️ Thông báo hệ thống sẽ được gửi vì sản phẩm sắp hết kho
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## Orders Page - New Order Alert

### Where to Integrate:

**File:** `src/pages/Orders/index.tsx` hoặc order creation handler

### Scenario:

Khi khách hàng tạo đơn hàng mới, gửi alert cho ADMIN & INVENTORY để xác nhận.

### Code Example:

```typescript
import { notifyNewOrder } from "../../services/notificationService";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";

async function handleCreateOrder(orderData: {
  customerId: string;
  customerName: string;
  items: any[];
  totalPrice: number;
}) {
  try {
    // 1. Tạo đơn hàng trong Firestore
    const ordersRef = collection(db, "orders");
    const orderDoc = await addDoc(ordersRef, {
      ...orderData,
      status: "pending", // Chờ xác nhận
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const orderId = orderDoc.id;

    // 2. Gửi thông báo cho ADMIN & INVENTORY
    await notifyNewOrder(orderId, orderData.customerName);

    toast.success("Đơn hàng được tạo thành công!");
    // Chuyển hướng hoặc close modal
  } catch (error) {
    toast.error("Lỗi tạo đơn hàng");
    console.error(error);
  }
}
```

### Trong OrderTable - Auto-notification khi có đơn mới:

```typescript
import { useState, useEffect } from 'react';
import { collection, onSnapshot, where, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { notifyNewOrder } from '../../services/notificationService';

export function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [notifiedOrders, setNotifiedOrders] = useState(new Set<string>());

  useEffect(() => {
    // Nghe đơn hàng mới
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const newOrders = [];

      for (const doc of snapshot.docs) {
        const order = { id: doc.id, ...doc.data() };
        newOrders.push(order);

        // Nếu đơn hàng mới và chưa gửi thông báo → gửi ngay
        if (!notifiedOrders.has(doc.id)) {
          await notifyNewOrder(doc.id, order.customerName);
          setNotifiedOrders((prev) => new Set([...prev, doc.id]));
        }
      }

      setOrders(newOrders);
    });

    return () => unsubscribe();
  }, [notifiedOrders]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Đơn Hàng</h2>
      {/* Render orders list */}
    </div>
  );
}
```

---

## Users Page - Role Change Alert

### Where to Integrate:

**File:** `src/pages/Users/index.tsx` - Trong `handleChangeRole()` function

### Scenario:

Khi thay đổi role của user, gửi alert cho ADMIN (người quản lý) về sự thay đổi này.

### Code Example:

```typescript
import { notifyRoleChanged } from "../../services/notificationService";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";

async function handleChangeRole(
  userId: string,
  userName: string,
  oldRole: string,
  newRole: string,
  changedByAdmin: string, // Admin hiện tại
) {
  try {
    // 1. Cập nhật role trong Firestore
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      role: newRole,
      forceLogoutAt: Date.now(), // Force logout user hiện tại
      updatedAt: Date.now(),
      updatedBy: changedByAdmin,
    });

    // 2. Gửi thông báo audit cho ADMIN
    await notifyRoleChanged(userName, oldRole, newRole, changedByAdmin);

    toast.success(`Đã thay đổi role thành ${newRole}`);
  } catch (error) {
    toast.error("Lỗi thay đổi role");
    console.error(error);
  }
}

// Sử dụng:
// handleChangeRole('user_123', 'Nguyễn Văn A', 'STAFF', 'INVENTORY', 'Admin B')
```

---

## Chat Page - Customer Support Alert

### Where to Integrate:

**File:** `src/pages/Chat/index.tsx` - Trong message handler

### Scenario:

Khi khách hàng gửi tin nhắn hỗ trợ mới, gửi alert cho STAFF để phản hồi nhanh.

### Code Example:

```typescript
import { notifyCustomerSupport } from "../../services/notificationService";
import { addDoc, collection } from "firebase/firestore";

async function handleNewSupportMessage(
  customerName: string,
  message: string,
  issueType: "return" | "complaint" | "inquiry" | "other",
) {
  try {
    // 1. Lưu tin nhắn vào Firestore
    const chatRef = collection(db, "chats");
    await addDoc(chatRef, {
      customerName,
      message,
      issueType,
      status: "unresolved",
      createdAt: Date.now(),
    });

    // 2. Gửi thông báo cho STAFF
    await notifyCustomerSupport(customerName, issueType);

    console.log("Tin nhắn được lưu và thông báo được gửi");
  } catch (error) {
    console.error("Lỗi:", error);
    toast.error("Lỗi gửi tin nhắn");
  }
}
```

---

## Payment Processing - Payment Success Alert

### Where to Integrate:

**File:** `src/services/paymentService.ts` hoặc payment callback handler

### Scenario:

Khi thanh toán thành công, gửi alert cho ADMIN & INVENTORY về đơn hàng sắp sàng giao hàng.

### Code Example:

```typescript
import { notifyPaymentSuccess } from "../../services/notificationService";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";

async function handlePaymentSuccess(
  orderId: string,
  transactionId: string,
  amount: number,
) {
  try {
    // 1. Cập nhật status đơn hàng thành "paid"
    const orderDocRef = doc(db, "orders", orderId);
    await updateDoc(orderDocRef, {
      status: "paid",
      paymentStatus: "completed",
      paymentDate: Date.now(),
      transactionId,
    });

    // 2. Gửi thông báo thanh toán thành công
    await notifyPaymentSuccess(orderId, amount);

    console.log("Thanh toán thành công và thông báo được gửi");
  } catch (error) {
    console.error("Lỗi xử lý thanh toán:", error);
  }
}
```

---

## System Events - General Alerts

### Scenario 1: Hệ thống bảo trì

```typescript
import { notifySystemAlert } from "../../services/notificationService";

// Trong cron job hoặc manual trigger
async function scheduleSystemMaintenance() {
  await notifySystemAlert(
    "Bảo trì hệ thống sắp bắt đầu",
    "Hệ thống sẽ bảo trì vào 22h hôm nay. Vui lòng hoàn thành công việc trước đó.",
    "warning",
  );
}
```

### Scenario 2: Cảnh báo bảo mật

```typescript
async function notifySecurityAlert(message: string) {
  await notifySystemAlert(
    "Cảnh báo bảo mật",
    message,
    "error", // Chỉ ADMIN nhận được
  );
}

// Ví dụ: Detect brute force
notifySecurityAlert("Phát hiện 5 lần đăng nhập thất bại từ IP 192.168.1.1");
```

### Scenario 3: Khuyến mãi mới

```typescript
import { notifyPromotionStarted } from "../../services/notificationService";

async function handleCreatePromotion(
  promotionName: string,
  discount: number,
  endDate: Date,
) {
  // ... create promotion logic ...

  await notifyPromotionStarted(promotionName, discount, endDate);
}
```

---

## 🔥 Advanced: Auto-Notification Middleware

Tạo function wrapper để tự động gửi notification:

```typescript
// src/services/notificationMiddleware.ts

import { createCustomNotification } from "./notificationService";

type NotificationType =
  | "order_created"
  | "payment_success"
  | "stock_update"
  | "role_change"
  | "system_alert";

interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  targetRoles?: string[];
  data?: Record<string, any>;
}

export async function sendNotification(payload: NotificationPayload) {
  const defaultRoles: Record<NotificationType, string[]> = {
    order_created: ["ADMIN", "INVENTORY"],
    payment_success: ["ADMIN", "INVENTORY"],
    stock_update: ["ADMIN", "INVENTORY"],
    role_change: ["ADMIN"],
    system_alert: ["ADMIN"],
  };

  const targetRoles = payload.targetRoles || defaultRoles[payload.type];

  return createCustomNotification(payload.title, payload.message, targetRoles);
}

// Sử dụng:
await sendNotification({
  type: "order_created",
  title: "Đơn hàng mới #A2031",
  message: "Khách hàng Nguyễn Văn A vừa tạo đơn",
  // targetRoles sẽ auto-set thành ['ADMIN', 'INVENTORY']
});
```

---

## 💾 Batch Notifications (Gửi Nhiều Cùng Lúc)

```typescript
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../firebase";

async function sendBatchNotifications(
  notifications: Array<{
    title: string;
    message: string;
    targetRoles: string[];
  }>,
) {
  try {
    const promises = notifications.map((notif) =>
      addDoc(collection(db, "notifications"), {
        ...notif,
        readBy: [],
        createdAt: Date.now(),
      }),
    );

    await Promise.all(promises);
    toast.success(`Đã gửi ${notifications.length} thông báo!`);
  } catch (error) {
    toast.error("Lỗi gửi thông báo batch");
  }
}

// Ví dụ:
await sendBatchNotifications([
  {
    title: "Đơn hàng #A2031 đã thanh toán",
    message: "Sẵn sàng vận chuyển",
    targetRoles: ["ADMIN", "INVENTORY"],
  },
  {
    title: "Sản phẩm RG Strike Freedom sắp hết",
    message: "Còn 3 sản phẩm",
    targetRoles: ["INVENTORY"],
  },
  {
    title: "Khách hàng yêu cầu trả hàng",
    message: "Order #A2030 - Kiểm tra sớm",
    targetRoles: ["ADMIN", "STAFF"],
  },
]);
```

---

## 🎨 Tips & Best Practices

1. **Gửi thông báo sau khi confirm**: Nên gửi notification SAU khi cập nhật Firestore xong (không trước)
2. **Avoid Spam**: Kiểm tra xem thông báo tương tự đã tồn tại không
3. **Meaningful Messages**: Viết message rõ ràng, có đủ context
4. **Target Right Roles**: Chọn roles hợp lý (ví dụ: chỉ ADMIN cho bảo trì, STAFF cho support)
5. **Archive Old**: Periodic cleanup thông báo cũ hơn 30 ngày

---

✅ **All examples are production-ready!** Copy & customize theo nhu cầu.
