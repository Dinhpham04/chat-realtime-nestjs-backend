import { UserSecurity, UserDevice } from '../../users/schemas';

/**
 * Authentication Repository Interface
 * 
 * Following Clean Architecture & Single Responsibility:
 * - Handles ONLY authentication-specific data (sessions, devices, security logs)
 * - User data operations delegated to UsersRepository
 * - Clear separation between User domain and Auth domain
 */
export interface IAuthRepository {
  // User Security operations (auth-specific)
  findUserSecurityByUserId(userId: string): Promise<any | null>;
  createUserSecurity(userId: string, securityData: Partial<UserSecurity>): Promise<any>;
  updateUserSecurity(userId: string, updateData: Partial<UserSecurity>): Promise<any | null>;
  incrementFailedLoginAttempts(userId: string): Promise<void>;
  resetFailedLoginAttempts(userId: string): Promise<void>;
  lockUserAccount(userId: string, lockUntil: Date): Promise<void>;
  addSecurityLog(userId: string, logEntry: any): Promise<void>;

  // User Device operations (auth-specific) 
  findActiveDevicesByUserId(userId: string): Promise<any[]>;
  createOrUpdateUserDevice(userId: string, deviceData: Partial<UserDevice>): Promise<any>;
  deactivateDevice(userId: string, deviceId: string): Promise<void>;
  deactivateAllDevices(userId: string): Promise<void>;
  countActiveDevices(userId: string): Promise<number>;

  // Authentication session operations
  createSession(userId: string, sessionData: any): Promise<any>;
  findSessionByToken(token: string): Promise<any | null>;
  invalidateSession(sessionId: string): Promise<void>;
  invalidateAllUserSessions(userId: string): Promise<void>;
}
