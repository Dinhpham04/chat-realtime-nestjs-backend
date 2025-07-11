# 1. Tổng quan về NestJS & Kiến trúc

## NestJS là gì?
- NestJS là framework Node.js hiện đại, xây dựng trên TypeScript, lấy cảm hứng từ Angular.
- Hỗ trợ xây dựng ứng dụng backend theo kiến trúc OOP, FP, FRP, rất phù hợp cho microservices, REST API, GraphQL, WebSocket.

## Ưu điểm nổi bật
- **TypeScript by default**: An toàn, dễ maintain.
- **Dependency Injection**: Quản lý phụ thuộc, dễ test, dễ mở rộng.
- **Modular**: Chia nhỏ theo module, dễ tổ chức code.
- **Decorator-based**: Định nghĩa route, middleware, guard... bằng decorator.
- **Hỗ trợ nhiều transport**: HTTP, WebSocket, gRPC, Microservices.
- **Ecosystem mạnh**: Auth, config, validation, testing, OpenAPI, CQRS, event...

## Kiến trúc cơ bản
```
┌────────────┐   ┌────────────┐   ┌────────────┐
│ Controller │--►│  Service   │--►│ Repository │
└────────────┘   └────────────┘   └────────────┘
      │               │                │
      ▼               ▼                ▼
   Route         Business Logic     Data Access
```
- **Controller**: Nhận request, trả response, không chứa logic phức tạp.
- **Service**: Chứa business logic, inject vào controller.
- **Repository/Provider**: Truy cập database, external API, cache...

## Module là gì?
- Mỗi module là 1 khối chức năng độc lập (user, auth, message...)
- Module gồm: controller, service, provider, entity/schema, dto...
- AppModule là root module, import các module con.

## File cấu trúc mẫu
```
src/
├── app.module.ts
├── users/
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   └── entities/user.entity.ts
└── main.ts
```

## Lời khuyên khi học NestJS
- Luôn tách rõ controller, service, repository.
- Sử dụng DTO và validation cho mọi input.
- Tận dụng Dependency Injection để code dễ test, dễ mở rộng.
- Đọc kỹ docs chính thức: https://docs.nestjs.com/

---
Tiếp theo: **Module, Controller, Service, Dependency Injection**

Nội dung: 
- Tổng quan về NestJS & kiến trúc
- Module, Controller, Service, Dependency Injection
- DTO, Validation, Pipes
- Middleware, Guard, Interceptor
- Kết nối Database (MongoDB/Mongoose, Redis, TypeORM)
- Authentication (JWT, Guard)
- WebSocket (Socket.io)
- Cấu hình, môi trường, best practices
- Testing (unit, e2e)
- Swagger, tài liệu hóa API
