/**
 * Friends Module DTOs - Clean Architecture
 * 
 * 🎯 Purpose: Barrel exports cho organized DTO structure
 * 📱 Mobile-First: Categorized by request/response/common
 * 🚀 Senior Standards: Single responsibility per file
 * 
 * Structure:
 * - request/: Input validation DTOs
 * - response/: Output structure DTOs  
 * - common/: Shared response DTOs
 */

// Request DTOs (Input Validation)
export * from './request';

// Response DTOs (Output Structure)
export * from './response';

// Common DTOs (Shared Types)
export * from './common';
