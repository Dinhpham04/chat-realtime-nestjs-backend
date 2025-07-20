/**
 * Friends Module Repositories - MVP Implementation
 * 
 * 🎯 Purpose: Data access layer cho friend management
 * 📱 Mobile-First: Optimized queries & bulk operations
 * 🚀 Clean Architecture: Repository pattern với dependency injection
 * 
 * Repositories:
 * - UserFriendRepository: Core friendship relationships
 * - UserContactRepository: Contact sync & discovery
 * 
 * Features:
 * - Interface-based design cho testability
 * - Mobile-optimized queries với proper indexing
 * - Bulk operations cho performance
 * - Error handling với comprehensive logging
 * - Pagination support cho large datasets
 */

export * from './user-friend.repository';
export * from './user-contact.repository';
