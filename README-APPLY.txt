AIRBNB PARKING UPDATE v3.0.8

Các file trong ZIP đều là file mới hoặc file đã thay đổi. Không cần thay các file khác.

1. Giải nén ZIP tại thư mục gốc repository airbnb.
2. Cho phép ghi đè:
   - src/main.tsx
   - public/sw.js
3. Hai file mới sẽ được thêm:
   - src/components/ParkingExtension.tsx
   - src/assets/parkingImages.ts
4. Commit và push lên branch main.
5. Chờ GitHub Actions deploy. Sau khi deploy, tải lại trang bằng hard refresh hoặc đóng/mở lại PWA.

Tính năng:
- Tab Parking / Hướng dẫn đậu xe.
- Tìm căn hộ.
- Hướng dẫn VI/EN theo nút ngôn ngữ hiện có.
- Sao chép toàn bộ tin nhắn, từng bước và hình Garage #77.
- Hướng dẫn cho:
  + 3BR Enclave | Fish Market & Casino
  + Bliss Terrace City Pad | 2 Balcony

Lưu ý dữ liệu:
- 3BR Enclave dùng bãi xe trả phí gần căn hộ, tap & pay hoặc pre-book; chủ nhà hoàn lại theo hóa đơn.
- Bliss dùng Garage #77 tại 1–19 Allen Street, Pyrmont; nhận remote fob từ mailbox và trả lại cùng keyset khi checkout.
