import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserStatus, ActivityStatus, Gender } from '../enums';

export type UserDocument = UserCore & Document;

/**
 * Core User Schema - Essential data only
 * Real-time status managed by Redis
 * Client settings managed locally
 */
@Schema({
  timestamps: true,
  collection: 'users_core',
})
export class UserCore {
  // Identity - Required for authentication
  @Prop({
    required: true,
    unique: true,
    trim: true,
    maxlength: 20,
    match: /^\+?[1-9]\d{1,14}$/ // E.164 format
  })
  phoneNumber: string;

  @Prop({
    default: false,
    required: true
  })
  isPhoneVerified: boolean;

  // Optional identity
  @Prop({
    required: false,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  })
  email?: string;

  @Prop({
    required: false,
    unique: true,
    sparse: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  })
  username?: string;

  // Authentication
  @Prop({
    required: false,
    minlength: 6
  })
  passwordHash?: string;

  // Basic profile
  @Prop({
    required: true,
    trim: true,
    maxlength: 100
  })
  fullName: string;

  @Prop({
    default: null,
    maxlength: 500
  })
  bio?: string;

  @Prop({
    default: null,
    type: Date
  })
  dateOfBirth?: Date;

  @Prop({
    type: String,
    enum: Object.values(Gender),
    default: null
  })
  gender?: Gender;

  @Prop({
    default: null,
    // match: /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i
  })
  avatarUrl?: string;

  // Account status - Server managed
  @Prop({
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE
  })
  status: UserStatus;

  // Real-time status - Will be managed by Redis, kept here for backup
  @Prop({
    type: String,
    enum: Object.values(ActivityStatus),
    default: ActivityStatus.OFFLINE // Default offline, Redis will manage online
  })
  activityStatus: ActivityStatus;

  @Prop({
    default: new Date(),
  })
  lastSeen: Date;

  // Relationships
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'UserCore' }],
    default: []
  })
  friends: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'UserCore' }],
    default: []
  })
  blocked: Types.ObjectId[];

  // Verification tokens
  @Prop({
    default: false
  })
  isEmailVerified: boolean;

  @Prop({
    default: null
  })
  emailVerificationToken?: string;

  @Prop({
    default: null
  })
  passwordResetToken?: string;

  @Prop({
    default: null
  })
  passwordResetExpires?: Date;

  @Prop({
    default: null
  })
  phoneVerificationCode?: string;

  @Prop({
    default: null
  })
  phoneVerificationExpires?: Date;

  // Soft delete
  @Prop({
    default: false
  })
  isDeleted: boolean;
}

export const UserCoreSchema = SchemaFactory.createForClass(UserCore);

// Essential indexes only
UserCoreSchema.index({ phoneNumber: 1 }); // Primary
UserCoreSchema.index({ status: 1 });
UserCoreSchema.index({ friends: 1 });
UserCoreSchema.index({ isDeleted: 1 });

// Virtual id
UserCoreSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Clean JSON output
UserCoreSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    const {
      passwordHash,
      emailVerificationToken,
      passwordResetToken,
      passwordResetExpires,
      phoneVerificationCode,
      phoneVerificationExpires,
      __v,
      ...cleanRet
    } = ret;
    return cleanRet;
  }
});
