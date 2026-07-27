AIRBNB PARKING UPDATE v3.0.9

Bản này thay thế hoàn toàn gói Parking v3.0.8 trước đó và có thể áp dụng trực tiếp lên repo hiện tại.

CÁCH CẬP NHẬT
1. Giải nén ZIP tại thư mục gốc repository airbnb.
2. Cho phép ghi đè các file:
   - src/main.tsx
   - src/components/ParkingExtension.tsx
   - src/assets/parkingImages.ts
   - public/sw.js
3. Commit và push lên branch main.
4. Chờ GitHub Actions deploy.
5. Sau khi deploy, hard refresh hoặc đóng/mở lại PWA để cache v3.0.9 được tải.

CẬP NHẬT CHÍNH
- Parking Guide được sắp xếp ngay trước tab Manage Data & Access.
- Parking Guide dùng trực tiếp cùng apartment ID và tên căn hộ của Apartment Check-in.
- Không còn danh sách tên căn hộ riêng hoặc tên bị rút gọn.
- Ví dụ guide Enclave tự map vào:
  55 Little Mount Street - 3BR Enclave | Fish Market & Casino
- Khi đổi tên apartment trong editor hiện tại, Parking Guide cũng đổi tên tự động.
- Manage Data & Access có thêm khu vực Parking Guide editor ở phía dưới.
- Có thể bật/tắt Parking Guide theo từng căn hộ.
- Có thể chỉnh status, location, access, garage number, map, notes, hướng dẫn VI/EN và full guest message.
- Có thể upload, xóa và sửa caption VI/EN cho ảnh parking riêng.
- Dữ liệu được lưu trực tiếp trong trường parking của cùng document apartments/{apartmentId} trên Firestore.
- Không cần thay Firestore Rules hoặc Storage Rules hiện tại.

DỮ LIỆU KHỞI TẠO
- Enclave được nhận diện theo tên đầy đủ hoặc hậu tố “3BR Enclave | Fish Market & Casino”.
- Bliss được nhận diện theo hậu tố “Bliss Terrace City Pad | 2 Balcony”.
- Hai guide mặc định sẽ xuất hiện ngay cả khi trường parking chưa được lưu.
- Khi bấm Save Parking Guide, nội dung mặc định được lưu vào đúng apartment document và có thể chỉnh tiếp trong app.
