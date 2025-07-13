# Checklist: Sử dụng MongoDB & Redis local cho dev, cloud cho production

- [x] Cấu hình biến môi trường cho MongoDB và Redis (local & cloud)
- [x] Docker Compose service cho Redis local
- [x] Hướng dẫn chuyển đổi giữa local và cloud (dev/prod)
- [ ] Kiểm tra kết nối ở cả hai môi trường
- [x] Cài đặt package ioredis thay cho redis
- [x] Cập nhật code kết nối Redis sử dụng ioredis
- [ ] Kiểm tra lại các tính năng pub/sub, cache, session với ioredis

# Setup Project - Hoàn thành

## ✅ Đã hoàn thành:
- [x] Cài đặt tất cả dependencies
- [x] Tạo file .env và .env.example
- [x] Tạo docker-compose.yml
- [x] Tạo folder structure đầy đủ
- [x] Cấu hình ConfigModule
- [x] Cấu hình DatabaseModule (MongoDB)
- [x] Cấu hình RedisModule (ioredis)
- [x] Cập nhật AppModule
- [x] Cập nhật main.ts với validation, CORS
- [x] Khởi động Docker Compose
- [x] Khởi động NestJS app

## 🔄 Đang thực hiện:
- [ ] Kiểm tra kết nối MongoDB (port 27017)
- [ ] Kiểm tra kết nối Redis (port 6379)
- [ ] Test API endpoints cơ bản

## ⏳ Cần làm tiếp:
- [ ] Tạo User schema và Auth module
- [ ] Implement JWT authentication
- [ ] Tạo các endpoints cơ bản
- [ ] Test WebSocket connection