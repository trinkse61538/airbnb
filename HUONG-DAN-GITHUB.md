# Hướng dẫn cập nhật Apartment Control Center v3

## 1. Upload bản cập nhật lên GitHub

Giải nén ZIP GitHub và upload toàn bộ nội dung vào thư mục gốc của repository hiện tại. Cho phép GitHub ghi đè các file trùng tên.

Kiểm tra các file ẩn sau khi upload:

- `.github/workflows/deploy-pages.yml`
- `.gitignore`
- `.firebaserc`
- `public/.nojekyll`

Không upload file ZIP dữ liệu riêng tư hoặc access key cũ.

Vào **Actions** và chờ workflow **Deploy PWA to GitHub Pages** chuyển sang màu xanh.

## 2. Tạo Cloud Firestore

1. Mở Firebase Console của project `gen-lang-client-0674849112`.
2. Chọn **Databases and storage → Firestore Database**.
3. Bấm **Create database**.
4. Chọn **Production mode**.
5. Chọn vị trí phù hợp và hoàn tất tạo database.
6. Mở tab **Rules**.
7. Sao chép toàn bộ nội dung file `firestore.rules` trong repository, dán vào trình soạn thảo và bấm **Publish**.

## 3. Tạo Cloud Storage

1. Trong Firebase Console, chọn **Databases and storage → Storage**.
2. Bấm **Get started** và tạo bucket mặc định.
3. Mở tab **Rules**.
4. Sao chép nội dung file `storage.rules`, dán vào và bấm **Publish**.
5. Nếu Firebase hỏi cho phép Storage Rules đọc dữ liệu Firestore, hãy xác nhận/Enable.

## 4. Đăng nhập Admin và nhập dữ liệu cũ

1. Mở `https://airbnb.khaitringuyen.com`.
2. Đăng nhập bằng `khaitri15@gmail.com`.
3. Chọn **Manage Data & Access**.
4. Ở mục **Import existing data**, nhập access key cũ từ ZIP riêng tư.
5. Bấm **Import existing data** và giữ trang mở cho đến khi đạt 100%.

Đây là lần cuối cùng cần access key cũ. Sau khi dữ liệu đã nằm trong Firebase, app chỉ yêu cầu đăng nhập Google.

## 5. Thêm căn hộ hoặc sửa Wi-Fi/instruction

1. Mở **Manage Data & Access**.
2. Bấm **Thêm căn hộ** hoặc biểu tượng bút chì tại căn hộ có sẵn.
3. Nhập thông tin căn hộ, Wi-Fi, lockbox và instruction.
4. Với instruction từng bước, để một dòng trống giữa hai bước.
5. Thêm ảnh nếu cần và bấm **Save apartment**.

Thay đổi xuất hiện ngay, không cần upload GitHub hoặc chạy lại Actions.

## 6. Thêm người dùng sau này

Chỉ Admin thấy phần **Quyền truy cập**:

1. Nhập email mới.
2. Chọn vai trò:
   - Viewer: chỉ xem.
   - Editor: thêm/sửa/xóa dữ liệu căn hộ.
   - Admin: quản lý dữ liệu và người dùng.
3. Bấm **Add user**.

Muốn thu hồi quyền, bấm biểu tượng thùng rác bên cạnh email. `khaitri15@gmail.com` là Admin chính và không thể xóa trong app.

## 7. Kiểm tra sau cùng

- Đăng nhập Admin thành công.
- Wi-Fi và Check-in mở trực tiếp, không hỏi access key.
- Có thể thêm rồi sửa một căn hộ thử nghiệm.
- Có thể tải ảnh và xem lại ảnh.
- Các Editor đăng nhập được nhưng không quản lý danh sách người dùng.
- Viewer không thấy nút chỉnh sửa.

