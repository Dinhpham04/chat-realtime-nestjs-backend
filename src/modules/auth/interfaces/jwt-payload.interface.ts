/**
 * JWT Payload interface for token validation
 */

export interface JwtUser {
  userId: string;
  phoneNumber: string;
  deviceId: string;
  roles: string[];
}

export interface JwtPayloadData {
  sub: string;          // userId
  phoneNumber: string;
  deviceId: string;
  roles: string[];
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface RefreshTokenData {
  sub: string;          // userId
  deviceId: string;
  tokenVersion: number;
  type: 'refresh';
  iat: number;
  exp: number;
}
