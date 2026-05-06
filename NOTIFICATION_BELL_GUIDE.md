# 📬 NotificationBell Component - Hướng Dẫn Sử Dụng

## 📋 Tổng Quan

`NotificationBell` là component React tích hợp Firestore thực hiện nghe theo thời gian thực các thông báo có liên quan đến vai trò người dùng hiện tại. Component này hiển thị:

✅ **Icon chuông** với **badge đỏ** hiển thị số lượng thông báo chưa đọc  
✅ **Dropdown panel** khi click, liệt kê tất cả thông báo  
✅ **Thời gian tương đối** (vd: "5 phút trước")  
✅ **Chấm xanh dương** bên cạnh thông báo chưa đọc  
✅ Nút **"Đánh dấu tất cả đã đọc"** ở đầu panel  
✅ Tự động **đóng dropdown** khi click bên ngoài

---

## 🚀 Cách Sử Dụng

### 1. Import vào Component của bạn

```tsx
import NotificationBell from "./components/NotificationBell";
```

### 2. Sử dụng trong Component (ví dụ: AdminLayout)

```tsx
<NotificationBell currentUserRole={normalizedRole} />
```

**Props:**

- `currentUserRole` (string, **required**): Vai trò của user hiện tại (ví dụ: 'ADMIN', 'INVENTORY', 'STAFF')

---

## 🗄️ Firestore Collection Structure

Tạo một collection tên `notifications` trong Firestore với cấu trúc document như sau:

### Cấu Trúc Document:

```json
{
  "id": "notif_001",
  "title": "Đơn hàng mới #A2031",
  "message": "Khách hàng vừa tạo đơn, cần xác nhận trong 15 phút.",
  "targetRoles": ["ADMIN", "INVENTORY"],
  "readBy": [],
  "createdAt": 1712800000000,
  "userId": "user_123"
}
```

### Giải Thích Các Field:

| Field         | Type   | Mô Tả                                                         |
| ------------- | ------ | ------------------------------------------------------------- |
| `title`       | string | Tiêu đề thông báo (ngắn, có ý nghĩa)                          |
| `message`     | string | Nội dung chi tiết thông báo                                   |
| `targetRoles` | array  | Mảng roles có thể nhìn thông báo (vd: ['ADMIN', 'INVENTORY']) |
| `readBy`      | array  | Danh sách `userId` đã đọc thông báo (mặc định: [])            |
| `createdAt`   | number | Timestamp Unix milliseconds (dùng `Date.now()`)               |
| `userId`      | string | (Optional) ID user nhận thông báo                             |

---

## 📝 Tạo Thông Báo từ Backend/Admin

### Ví dụ 1: Tạo thông báo từ Firestore Console

```
Collection: notifications

Document: auto-generated
  title: "Sản phẩm sắp hết kho"
  message: "RG Strike Freedom còn dưới 5 sản phẩm."
  targetRoles: ["ADMIN", "INVENTORY"]
  readBy: []
  createdAt: 1712800000000
```

### Ví dụ 2: Tạo từ JavaScript/Node.js

```typescript
import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

async function createNotification(
  title: string,
  message: string,
  targetRoles: string[],
) {
  try {
    await addDoc(collection(db, "notifications"), {
      title,
      message,
      targetRoles: targetRoles.map((role) => role.toUpperCase()),
      readBy: [],
      createdAt: Date.now(),
    });
    console.log("Thông báo đã tạo thành công!");
  } catch (error) {
    console.error("Lỗi:", error);
  }
}

// Sử dụng
createNotification(
  "Đơn hàng mới #A2031",
  "Khách hàng vừa tạo đơn, cần xác nhận trong 15 phút.",
  ["ADMIN", "INVENTORY"],
);
```

---

## 🎨 Feature Highlights

### 1. **Lọc theo Role**

Component chỉ hiển thị thông báo có `targetRoles` chứa vai trò của user hiện tại.

```typescript
// Nếu user có role ADMIN, chỉ thông báo có 'ADMIN' trong targetRoles sẽ hiện
where("targetRoles", "array-contains", "ADMIN");
```

### 2. **Real-Time Listening**

Sử dụng `onSnapshot` để nghe thay đổi từ Firestore theo thời gian thực (không cần reload).

### 3. **Thời Gian Tương Đối**

Hàm `getRelativeTime()` tự động tính toán và hiển thị thời gian dưới dạng "5 phút trước", "2 giờ trước", v.v.

```typescript
function getRelativeTime(timestamp: number): string {
  // Trả về: "vừa xảy ra", "5 phút trước", "2 giờ trước", v.v.
}
```

### 4. **Marking as Read**

Khi click vào thông báo chưa đọc, Component tự động gọi `updateDoc` để thêm `currentUserId` vào `readBy` bằng `arrayUnion()`.

### 5. **Mark All as Read**

Nút "✓ Tất cả" đánh dấu tất cả thông báo chưa đọc là đã đọc một lần.

### 6. **Click-Outside Close**

Dropdown tự động đóng khi click bên ngoài (sử dụng `mousedown` event listener).

---

## 🔒 Bảo Mật

### Index Firestore

Để tối ưu hiệu suất, hãy tạo **Composite Index** trong Firestore:

**Collection:** `notifications`  
**Fields:**

1. `targetRoles` (Array) - Ascending
2. `createdAt` (Descending) - Descending

**Mục đích:** Tối ưu query `where('targetRoles', 'array-contains', role) + orderBy('createdAt', 'desc')`

### Rules Firestore (Tùy Chọn)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notifications/{document=**} {
      // Giọng đọc: Admin hoặc user có role trong targetRoles
      allow read: if request.auth != null &&
                     (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in resource.data.targetRoles);

      // Ghi: Chỉ admin
      allow write: if request.auth != null &&
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'ADMIN';
    }
  }
}
```

---

## 🐛 Troubleshooting

### Q: Không thấy thông báo nào hiện ra?

**A:**

1. Kiểm tra collection `notifications` tồn tại trong Firestore
2. Kiểm tra `targetRoles` có chứa role của user không
3. Kiểm tra role được normalize thành UPPERCASE (ADMIN, INVENTORY, STAFF)
4. Mở console xem có lỗi gì không

### Q: Thông báo không cập nhật khi click?

**A:**

1. Kiểm tra Firestore rules cho phép cập nhật `readBy`
2. Kiểm tra network tab xem updateDoc có gọi thành công không
3. Kiểm tra firebaseConfig có đúng không

### Q: Badge không hiện?

**A:**

1. Kiểm tra `readBy` field có là array không
2. Kiểm tra Firestore listener có bắt được dữ liệu không (xem console)

### Q: Dropdown không đóng?

**A:**
Kiểm tra CSS `z-50` của dropdown cấu hình đúng, mousedown event đang trigger

---

## 📊 Ví Dụ Dữ Liệu Demo

Thêm những document này vào collection `notifications` để test:

```javascript
// Document 1
{
  "title": "Đơn hàng mới #A2031",
  "message": "Khách hàng vừa tạo đơn, cần xác nhận trong 15 phút.",
  "targetRoles": ["ADMIN", "INVENTORY"],
  "readBy": [],
  "createdAt": Date.now() - 2 * 60 * 1000  // 2 phút trước
}

// Document 2
{
  "title": "Sản phẩm sắp hết kho",
  "message": "RG Strike Freedom còn dưới 5 sản phẩm.",
  "targetRoles": ["ADMIN", "INVENTORY", "STAFF"],
  "readBy": ["user_123"],
  "createdAt": Date.now() - 30 * 60 * 1000  // 30 phút trước
}

// Document 3
{
  "title": "Thay đổi quyền hạn",
  "message": "Bạn vừa được nâng lên ADMIN.",
  "targetRoles": ["INVENTORY", "STAFF"],
  "readBy": [],
  "createdAt": Date.now() - 1 * 60 * 60 * 1000  // 1 giờ trước
}
```

---

## 🎯 Tích Hợp Vào Existing AdminLayout

Nếu bạn đã có AdminLayout, thay thế phần notification cũ:

**Trước (Mock):**

```tsx
<button type="button" onClick={() => setIsNotificationOpen((prev) => !prev)}>
  <Bell className="w-5 h-5" />
</button>
```

**Sau (Real-Time):**

```tsx
<NotificationBell
  currentUserRole={normalizedRole}
  currentUserId={currentUser?.id || ""}
/>
```

---

## 📱 Responsive Design

Component tự động responsive:

- Desktop: 360px panel
- Mobile: Vẫn 360px (có thể adjust bằng `w-[360px]` class)
- Dropdown luôn ở góc phải của icon

---

## 🔄 Cập Nhật Notification Status

### Marking Individual as Read

```typescript
// Tự động khi click notification
handleMarkAsRead(notificationId, isCurrentlyRead);
// → updateDoc(notifications/notificationId, { readBy: arrayUnion(currentUserId) })
```

### Marking All as Read

```typescript
// Click nút "✓ Tất cả"
handleMarkAllAsRead();
// → updateDoc tất cả unread notifications
```

---

## 📞 Support

Nếu gặp vấn đề:

1. Kiểm tra Firestore rules
2. Kiểm tra console errors
3. Xem Network tab xem API call
4. Xem Firestore listener có active không (bằng DevTools Firestore extension)

---

## 🎉 Done!

Component NotificationBell đã sẵn sàng sử dụng! 🚀
