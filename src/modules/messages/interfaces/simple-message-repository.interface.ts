// /**
//  * Simple Message Repository Interface for Clean Architecture
//  *
//  * 🎯 Purpose: Define repository contract for Messages Service
//  * 📱 Mobile-First: Essential operations cho real-time messaging
//  * 🚀 Clean Architecture: Repository pattern với dependency injection
//  *
//  * Design Principles:
//  * - Single Responsibility: Chỉ message data operations
//  * - Interface Segregation: Essential operations only
//  * - Dependency Inversion: Service layer phụ thuộc abstraction
//  * - DRY: Reuse DTOs từ service layer
//  */

// import { MessageResponseDto, CreateMessageDto, UpdateMessageDto, MessagePaginationDto } from '../dto';

// export interface ISimpleMessageRepository {
//   /**
//    * Create new message
//    */
//   create(messageData: CreateMessageDto, senderId: string): Promise<MessageResponseDto>;

//   /**
//    * Find message by ID
//    */
//   findById(messageId: string): Promise<MessageResponseDto | null>;

//   /**
//    * Update message
//    */
//   update(messageId: string, updateData: UpdateMessageDto): Promise<MessageResponseDto>;

//   /**
//    * Soft delete message
//    */
//   softDelete(messageId: string): Promise<boolean>;

//   /**
//    * Find messages by conversation with pagination
//    */
//   findByConversationId(
//     conversationId: string,
//     pagination: MessagePaginationDto
//   ): Promise<{
//     messages: MessageResponseDto[];
//     total: number;
//     hasNext: boolean;
//     hasPrev: boolean;
//   }>;

//   /**
//    * Search messages
//    */
//   searchMessages(
//     conversationId: string,
//     query: string,
//     pagination: MessagePaginationDto
//   ): Promise<{
//     messages: MessageResponseDto[];
//     total: number;
//     hasNext: boolean;
//     hasPrev: boolean;
//   }>;

//   /**
//    * Mark message as read
//    */
//   markAsRead(messageId: string, userId: string): Promise<boolean>;

//   /**
//    * Update message status
//    */
//   updateStatus(messageId: string, status: string): Promise<boolean>;

//   /**
//    * Bulk delete messages
//    */
//   bulkDelete(messageIds: string[]): Promise<string[]>; // Returns failed IDs

//   /**
//    * Bulk mark as read
//    */
//   bulkMarkAsRead(messageIds: string[], userId: string): Promise<string[]>; // Returns failed IDs
// }
