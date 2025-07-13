import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserSecurityDocument = UserSecurity & Document;

/**
 * User Security Schema - Authentication & audit logs
 * Server-managed for security compliance
 */
@Schema({
  timestamps: true,
  collection: 'user_security',
})
export class UserSecurity {
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  userId: Types.ObjectId;

  // Current session
  @Prop({
    default: null,
    select: false // Never include in queries by default
  })
  refreshToken?: string;

  // Two-Factor Authentication
  @Prop({
    default: false
  })
  twoFactorEnabled: boolean;

  @Prop({
    default: null,
    select: false // Sensitive data
  })
  twoFactorSecret?: string;

  // Security logs - Keep last 100 entries
  @Prop({
    type: [{
      action: { type: String, required: true }, // login, logout, password_change, etc.
      ip: { type: String, required: true },
      userAgent: String,
      timestamp: { type: Date, default: Date.now },
      location: String,
      deviceId: String,
      success: { type: Boolean, default: true }
    }],
    default: [],
    validate: {
      validator: function (logs: any[]) {
        return logs.length <= 100; // Limit to last 100 logs
      },
      message: 'Security logs cannot exceed 100 entries'
    }
  })
  securityLogs: Array<{
    action: string;
    ip: string;
    userAgent?: string;
    timestamp: Date;
    location?: string;
    deviceId?: string;
    success: boolean;
  }>;

  // Failed login attempts tracking
  @Prop({
    default: 0
  })
  failedLoginAttempts: number;

  @Prop({
    default: null
  })
  lockedUntil?: Date;

  // Last security check
  @Prop({
    default: new Date()
  })
  lastSecurityCheck: Date;
}

export const UserSecuritySchema = SchemaFactory.createForClass(UserSecurity);

// Essential indexes
UserSecuritySchema.index({ userId: 1 });
UserSecuritySchema.index({ 'securityLogs.timestamp': -1 });
UserSecuritySchema.index({ 'securityLogs.ip': 1 });
UserSecuritySchema.index({ failedLoginAttempts: 1 });
UserSecuritySchema.index({ lockedUntil: 1 }, { sparse: true });

// Virtual id
UserSecuritySchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Clean JSON - exclude sensitive data
UserSecuritySchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    const {
      __v,
      refreshToken,
      twoFactorSecret,
      ...cleanRet
    } = ret;
    return cleanRet;
  }
});

// Middleware to limit security logs
UserSecuritySchema.pre('save', function (next) {
  if (this.securityLogs && this.securityLogs.length > 100) {
    // Keep only the last 100 logs
    this.securityLogs = this.securityLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 100);
  }
  next();
});
