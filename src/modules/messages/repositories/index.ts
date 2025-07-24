/**
 * Repository Module Exports
 * 
 * 🎯 Purpose: Centralized exports for repository layer
 * 📱 Mobile-First: Clean import structure for services
 * 🚀 Clean Architecture: Single export point for repository layer
 */

// Interfaces
export * from '../interfaces/message-repository.interface';

// Implementations  
export * from './message.repository';

// Repository errors - Updated to use correct error name
export { RepositoryError } from './message.repository';
