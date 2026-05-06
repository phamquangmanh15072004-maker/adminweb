# ⚡ Quick Start Checklist - NotificationBell

## 🎯 Setup trong 5 phút

### ✅ Step 1: Firestore Collection Setup (1 phút)

- [ ] Vào [Firestore Console](https://console.firebase.google.com)
- [ ] Chọn project: `gundam-shop-app`
- [ ] Click **"Create Collection"**
- [ ] **Collection ID:** `notifications`
- [ ] Click **"Next"**
- [ ] Click **"Add a document"** với các field:

```
title:        string   (Tiêu đề)
message:      string   (Nội dung)
targetRoles:  array    ["ADMIN", "INVENTORY", "STAFF"]
readBy:       array    []
createdAt:    number   (Date.now())
```

- [ ] Save

### ✅ Step 2: Tạo Composite Index (1 phút - Optional nhưng nên làm)

- [ ] Firestore → **Indexes** tab
- [ ] Click **"Create Index"**
- [ ] Collection: `notifications`
- [ ] Field 1: `targetRoles` (Array) - Ascending ✓
- [ ] Field 2: `createdAt` (Timestamp) - Descending ✓
- [ ] Click **Create Index**
- [ ] Chờ index hoàn thành (~5 phút)

### ✅ Step 3: Code Integration (1 phút)

Component **đã được tích hợp**, không cần làm gì!

Kiểm tra tại: `src/App.tsx` → lines ~500

```tsx
<NotificationBell
  currentUserRole={normalizedRole}
  currentUserId={currentUser?.id || ""}
/>
```

### ✅ Step 4: Thử Test (1 phút)

```bash
npm run dev
```

- [ ] Vào Admin Dashboard
- [ ] Nếu thấy icon 🔔 ở header → ✅ Success!

### ✅ Step 5: Tạo Thông Báo Test (1 phút)

**Firestore Console** → `notifications` → **Add document**:

```
title:       "Test Notification"
message:     "This is a test"
targetRoles: ["ADMIN"]
readBy:      []
createdAt:   (Auto - Server timestamp)
```

- [ ] Save
- [ ] Refresh page hoặc xem real-time trên web
- [ ] Badge đỏ "1" xuất hiện trên chuông? → ✅ YES!
- [ ] Click notification → Nó biến thành xám? → ✅ YES!

---

## 📍 File Locations

| File                                                                         | Purpose                                       |
| ---------------------------------------------------------------------------- | --------------------------------------------- |
| [src/components/NotificationBell.tsx](src/components/NotificationBell.tsx)   | Main Component (Real-time Firestore listener) |
| [src/services/notificationService.ts](src/services/notificationService.ts)   | Helper functions (10 ready-to-use functions)  |
| [NOTIFICATION_BELL_GUIDE.md](NOTIFICATION_BELL_GUIDE.md)                     | Full Documentation                            |
| [SETUP_NOTIFICATION_BELL.md](SETUP_NOTIFICATION_BELL.md)                     | Setup Guide                                   |
| [NOTIFICATION_INTEGRATION_EXAMPLES.md](NOTIFICATION_INTEGRATION_EXAMPLES.md) | Real Code Examples                            |

---

## 🚀 Usage Examples

### Example 1: Tạo Thông Báo Đơn Hàng Mới

```typescript
import { notifyNewOrder } from "../services/notificationService";

// Trong order creation function:
await notifyNewOrder("ORDER_123", "Nguyễn Văn A");
```

### Example 2: Stock Alert

```typescript
import { notifyLowStock } from "../services/notificationService";

if (newStock <= 5) {
  await notifyLowStock("RG Strike Freedom", newStock);
}
```

### Example 3: Custom Notification

```typescript
import { createCustomNotification } from "../services/notificationService";

await createCustomNotification("Custom Title", "Custom message here", [
  "ADMIN",
  "INVENTORY",
  "STAFF",
]);
```

---

## 🧪 Test Scenarios

| Scenario                    | Expected Behavior                        |
| --------------------------- | ---------------------------------------- |
| Tạo notification            | Badge đỏ với số lượng xuất hiện          |
| Click chuông                | Dropdown mở ra với danh sách             |
| Click notification chưa đọc | Chuyển sang xám + currentUserId → readBy |
| Click "✓ Tất cả"            | Tất cả notification → xám                |
| Click ngoài dropdown        | Dropdown tự đóng                         |

---

## ❌ Troubleshooting

### ❓ Chuông không hiện badge

- [ ] Kiểm tra Firestore rules cho phép read?
- [ ] `targetRoles` có chứa role của user?
- [ ] Role phải UPPERCASE (ADMIN, không phải admin)?

### ❓ Notification không cập nhật khi click

- [ ] Mở DevTools Console (F12)
- [ ] Có error message? Xem chi tiết
- [ ] Firestore rules cho phép write `readBy`?
- [ ] Network tab - có updateDoc call?

### ❓ Dropdown không đóng

- [ ] CSS `z-50` có applied?
- [ ] mousedown event listener active?
- [ ] Thử reload page

---

## 📚 Documentation References

1. **[NOTIFICATION_BELL_GUIDE.md](NOTIFICATION_BELL_GUIDE.md)** ← Đọc hướng dẫn chi tiết
2. **[NOTIFICATION_INTEGRATION_EXAMPLES.md](NOTIFICATION_INTEGRATION_EXAMPLES.md)** ← Xem code examples cụ thể
3. **[SETUP_NOTIFICATION_BELL.md](SETUP_NOTIFICATION_BELL.md)** ← Hướng dẫn setup đầy đủ

---

## 🎯 Next: Integrate into Your Pages

### Add to Products Page (Stock Updates)

→ See [NOTIFICATION_INTEGRATION_EXAMPLES.md#products-page](NOTIFICATION_INTEGRATION_EXAMPLES.md#products-page---low-stock-alert)

```typescript
if (newStock <= 5) await notifyLowStock(productName, newStock);
```

### Add to Orders Page (New Orders)

→ See [NOTIFICATION_INTEGRATION_EXAMPLES.md#orders-page](NOTIFICATION_INTEGRATION_EXAMPLES.md#orders-page---new-order-alert)

```typescript
await notifyNewOrder(orderId, customerName);
```

### Add to Users Page (Role Changes)

→ See [NOTIFICATION_INTEGRATION_EXAMPLES.md#users-page](NOTIFICATION_INTEGRATION_EXAMPLES.md#users-page---role-change-alert)

```typescript
await notifyRoleChanged(userName, oldRole, newRole, adminName);
```

### Add to Payment Processing (Payment Success)

→ See [NOTIFICATION_INTEGRATION_EXAMPLES.md#payment-processing](NOTIFICATION_INTEGRATION_EXAMPLES.md#payment-processing---payment-success-alert)

```typescript
await notifyPaymentSuccess(orderId, amount);
```

---

## 📊 Firestore Data Format Reference

```json
{
  "title": "Đơn hàng mới #A2031",
  "message": "Khách hàng vừa tạo đơn, cần xác nhận trong 15 phút.",
  "targetRoles": ["ADMIN", "INVENTORY"],
  "readBy": [],
  "createdAt": 1712800000000,
  "userId": "optional_user_id"
}
```

**Required Fields:** `title`, `message`, `targetRoles`, `readBy`, `createdAt`  
**Optional:** `userId`

---

## 🔐 Security: Firestore Rules (Optional)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notifications/{document=**} {
      allow read: if request.auth != null &&
                     request.auth.token.role in resource.data.targetRoles;
      allow write: if request.auth != null &&
                      request.auth.token.role == 'ADMIN';
    }
  }
}
```

---

## 🏗️ Component Architecture

```
AdminLayout (src/App.tsx)
  ├── Header
  │   └── NotificationBell ← Real-time listener
  │       ├── Bell Icon + Badge
  │       ├── Dropdown Panel
  │       │   ├── Notification Items
  │       │   └── Mark All Button
  │       └── Firestore Query
  │           where('targetRoles', 'array-contains', userRole)
  │           orderBy('createdAt', 'desc')
```

---

## ✅ Verification Checklist

- [ ] `npm run build` → No errors
- [ ] ✅ **3482 modules transformed** (build successful)
- [ ] Component appears in header when logged in
- [ ] Bell icon visible with role-based filtering
- [ ] Dropdown opens/closes correctly
- [ ] Update `readBy` on click works
- [ ] "Mark All as Read" button works
- [ ] Relative time displays correctly

---

## 🎉 You're All Set!

🚀 **NotificationBell is ready to use!**

**Next Steps:**

1. ✅ Copy code from [NOTIFICATION_INTEGRATION_EXAMPLES.md](NOTIFICATION_INTEGRATION_EXAMPLES.md)
2. ✅ Paste into your page handlers (Products, Orders, Users, etc.)
3. ✅ Test by creating notifications
4. ✅ Celebrate! 🎊

---

## 📞 Quick Help

| Issue                    | Solution                                     |
| ------------------------ | -------------------------------------------- |
| No notifications visible | Check Firestore collection exists & has data |
| Permission denied error  | Check Firestore rules allow your role        |
| Dropdown not opening     | Check z-index CSS class applied              |
| Badge not updating       | Refresh page or check Firestore listener     |

---

## 📝 Sample Data for Testing

Copy-paste these into Firestore to test:

```
Doc 1:
  title: "Đơn hàng #A2031"
  message: "Khách hàng vừa tạo đơn"
  targetRoles: ["ADMIN", "INVENTORY"]
  readBy: []
  createdAt: (Now)

Doc 2:
  title: "Sản phẩm sắp hết"
  message: "RG Strike Freedom còn 3 cái"
  targetRoles: ["ADMIN", "INVENTORY", "STAFF"]
  readBy: []
  createdAt: (Now - 5 min)

Doc 3:
  title: "Thanh toán thành công"
  message: "Order A2031 đã thanh toán 5.99M"
  targetRoles: ["ADMIN"]
  readBy: ["user_123"]
  createdAt: (Now - 1 hour)
```

---

**Happy Notifications! 🎉**
