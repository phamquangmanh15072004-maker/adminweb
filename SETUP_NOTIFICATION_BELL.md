# 📬 NotificationBell Component - Tóm Tắt Triển Khai

## ✅ Hoàn Thành

Đã tạo hoàn chỉnh component **NotificationBell** với tích hợp Firestore real-time. Component hiện đang được sử dụng trong AdminLayout header.

---

## 📁 Files Được Tạo / Sửa

### **Tạo Mới:**

1. **[src/components/NotificationBell.tsx](src/components/NotificationBell.tsx)** (Main Component)
   - Lắng nghe Firestore real-time (onSnapshot)
   - Hiển thị dropdown panel với danh sách thông báo
   - Xử lý Mark as Read / Mark All as Read
   - Auto-close khi click bên ngoài
   - Thời gian tương đối (5 phút trước, 2 giờ trước, v.v.)

2. **[src/services/notificationService.ts](src/services/notificationService.ts)** (Helper Functions)
   - 10 hàm sẵn sàng để tạo thông báo
   - Ví dụ: `notifyNewOrder()`, `notifyLowStock()`, `notifyPaymentSuccess()`, v.v.
   - Hỗ trợ custom roles cho từng loại thông báo

3. **[NOTIFICATION_BELL_GUIDE.md](NOTIFICATION_BELL_GUIDE.md)** (Documentation)
   - Hướng dẫn cài đặt Firestore collection
   - Cấu trúc document chi tiết
   - Bảo mật & Firestore rules
   - Troubleshooting

### **Sửa Đổi:**

- **[src/App.tsx](src/App.tsx)**
  - Import `NotificationBell` component
  - Thay thế mock notification UI bằng component thực
  - Xóa unused state & handlers
  - Tích hợp vào AdminLayout header

---

## 🚀 Bước 1: Thiết Lập Firestore Collection

### Tạo Collection trong Firestore Console:

```
Project: gundam-shop-app
→ Firestore Database
→ New Collection
  - Collection ID: notifications
  - Add first document với structure:
```

**Cấu Trúc Document:**

```json
{
  "title": "Đơn hàng mới #A2031",
  "message": "Khách hàng vừa tạo đơn, cần xác nhận trong 15 phút.",
  "targetRoles": ["ADMIN", "INVENTORY"],
  "readBy": [],
  "createdAt": 1712800000000
}
```

---

## 🎯 Bước 2: Sử Dụng trong Component

Component đã được tích hợp trong AdminLayout. Không cần làm gì thêm!

✅ **Kiểm tra:** Mở `src/App.tsx` → Tìm `<NotificationBell currentUserRole={normalizedRole} />`

Click vào → `currentUserId` được thêm vào `readBy` trên Firestore

## 📢 Bước 3: Tạo Thông Báo Từ Mọi Nơi Trong App

### Ví dụ 1: Khi Tạo Đơn Hàng Mới

```typescript
// Trong src/pages/Orders/ hoặc component xử lý đơn hàng
import { notifyNewOrder } from "../services/notificationService";

async function handleCreateOrder(orderData) {
  // ... logic tạo đơn hàng ...

  // Gửi thông báo
  await notifyNewOrder(orderId, customerName);
}
```

### Ví dụ 2: Khi Cập Nhật Stock Sản Phẩm

```typescript
// Trong src/pages/Products/ hoặc component sản phẩm
import { notifyLowStock } from "../services/notificationService";

async function handleUpdateStock(productId, newStock) {
  // ... logic cập nhật stock ...

  if (newStock <= 5) {
    await notifyLowStock(productName, newStock);
  }
}
```

### Ví dụ 3: Tạo Thông Báo Tùy Chỉnh

```typescript
import { createCustomNotification } from "../services/notificationService";

await createCustomNotification(
  "Đơn hàng #A2031 đã giao hàng",
  "Mã vận chuyển: VTP123456. Yêu cầu khách hàng xác nhận nhận hàng.",
  ["ADMIN", "INVENTORY", "STAFF"],
);
```

---

## 🔧 Firestore Index (Tối Ưu Hiệu Suất)

Tạo Composite Index để tối ưu query:

**Firestore Console:**

```
Firestore Database
→ Indexes
→ Composite Indexes tab
→ Create Index
  - Collection: notifications
  - Fields:
    1. targetRoles (Array) - Ascending
    2. createdAt (Descending) - Descending
```

---

## 🧪 Quick Test

### Test 1: Thêm Thông Báo Test

**Firestore Console** → `notifications` collection → Add document:

```
title: "Test Notification"
message: "Đây là thông báo test"
targetRoles: ["ADMIN"]
readBy: []
createdAt: (Server timestamp)
```

Kết quả: Badge đỏ hiện "1" trên icon chuông

### Test 2: Click Vào Thông Báo

- Badge xanh dương hiểu là "chưa đọc"
- Click vào → `currentUserId` được thêm vào `readBy` trên Firestore
- Chấm xanh biến thành xám
- Badge count giảm 1

### Test 3: "Đánh Dấu Tất Cả Đã Đọc"

- Tạo 3-4 thông báo với `readBy: []`
- Lick nút "✓ Tất cả" ở đầu panel
- Tất cả sẽ chứa `currentUserId` trong `readBy`
- Badge count về 0

---

## 🎨 UI Features

| Feature          | Mô Tả                               |
| ---------------- | ----------------------------------- |
| 🔔 Bell Icon     | Icon chuông với hover effect        |
| 🔴 Badge         | Số lượng chưa đọc (màu đỏ)          |
| 📋 Panel         | Dropdown với max-height, scrollable |
| 🔵 Blue Dot      | Bên cạnh thông báo chưa đọc         |
| ⏱️ Relative Time | "5 phút trước", "2 giờ trước"       |
| ✓ Mark All Btn   | Nút đánh dấu tất cả ở đầu panel     |
| ⌛ Loading State | Spinner khi fetch từ Firestore      |
| 📭 Empty State   | Emoji "📭" khi không có thông báo   |

---

## 🔒 Bảo Mật Gợi Ý

### Firestore Rules (Optional):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notifications/{document=**} {
      // Read: Chỉ được đọc nếu role trong targetRoles
      allow read: if request.auth != null &&
                     request.auth.token.role in resource.data.targetRoles;

      // Write: Chỉ ADMIN được tạo
      allow write: if request.auth != null &&
                      request.auth.token.role == 'ADMIN';
    }
  }
}
```

---

## 📊 Firestore Collection Structure (Schema)

```
notifications/
├── doc_001
│   ├── title: string
│   ├── message: string
│   ├── targetRoles: array<string> (ADMIN, INVENTORY, STAFF)
│   ├── readBy: array<string>
│   ├── createdAt: number (unix timestamp ms)
│   └── userId?: string (optional)
├── doc_002
│   └── ...
└── ...
```

---

## 🐛 Debugging

### Nếu notifications không hiện:

1. **Kiểm tra Firestore:**
   - Có collection `notifications` không?
   - Document có `targetRoles` array không?
   - `createdAt` là number (unix ms) không?

2. **Kiểm tra Console:**
   - `F12` → Console tab
   - Có error message không?
   - Xem onSnapshot callback trigger không?

3. **Kiểm tra Role:**
   - User role phải UPPERCASE (ADMIN, INVENTORY, STAFF)
   - `targetRoles` array phải chứa role của user

4. **Kiểm tra Rules:**
   - Firestore rules cho phép read `notifications` không?

---

## 📱 Component API

### Props:

```typescript
interface NotificationBellProps {
  currentUserRole: string; // ví dụ: 'ADMIN', 'INVENTORY', 'STAFF'
}
```

### Usage:

```tsx
<NotificationBell currentUserRole="ADMIN" />
```

---

## 🚀 Next Steps (Optional Enhancements)

1. **Thêm Click Handler**: Chuyển hướng đến chi tiết khi click thông báo
2. **Sound Alert**: Phát âm thanh khi có thông báo mới
3. **Desktop Notification**: Gửi notification OS (Web Push API)
4. **Notification History Page**: Trang xem tất cả thông báo (past/archived)
5. **Auto-Delete Old**: Xóa thông báo cũ hơn 30 ngày tự động
6. **Categories**: Phân loại thông báo (Orders, Products, System, v.v.)

---

## 🎉 Hoàn Thành!

✅ **NotificationBell component sẵn sàng 100%!**

Chỉ cần:

1. ✅ Tạo collection `notifications` trong Firestore
2. ✅ Tạo Composite Index (optional nhưng nên làm)
3. ✅ Sử dụng `notificationService` functions để tạo thông báo

**Happy Coding! 🚀**
