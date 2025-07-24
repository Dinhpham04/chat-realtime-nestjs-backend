/**
 * Services Index - Centralized exports for all message services
 * 
 * 🎯 Purpose: Single entry point for all message services
 * 📱 Mobile-First: Easy imports for other modules
 * 🚀 Clean Architecture: Organized service exports
 */

// Core business logic services
export * from './message-core.service';
export * from './message-validation.service';

// Export user context interface
export { UserContext } from './message-core.service';
