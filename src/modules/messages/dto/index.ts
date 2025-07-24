/**
 * DTO Index - Centralized exports for all DTOs
 * 
 * 🎯 Purpose: Single entry point for all message DTOs
 * 📱 Mobile-First: Easy imports for controller layer
 * 🚀 Clean Architecture: Organized exports with clear naming
 */

// Input DTOs - Request validation
export * from './send-message.dto';
export * from './edit-message.dto';
export * from './message-query.dto';

// Output DTOs - Response formatting
export * from './message-response.dto';

// Re-export content DTOs for external use
export {
  TextContentDto,
  LocationContentDto,
  MediaContentDto,
  FileContentDto
} from './send-message.dto';
