import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MobilePlatform, PushProvider } from '../enums';

export type UserDeviceDocument = UserDevice & Document;

/**
 * User Device Schema - Minimal device info for push notifications
 * Most device data managed by client locally
 */
@Schema({
  timestamps: true,
  collection: 'user_devices',
})
export class UserDevice {
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  userId: Types.ObjectId;

  // Essential device identification
  @Prop({
    required: true,
    unique: true,
    trim: true
  })
  deviceId: string;

  @Prop({
    type: String,
    enum: Object.values(MobilePlatform),
    required: true
  })
  platform: MobilePlatform;

  // Push notification essentials only
  @Prop({
    required: false,
    sparse: true
  })
  pushToken?: string;

  @Prop({
    type: String,
    enum: Object.values(PushProvider),
    required: true
  })
  pushProvider: PushProvider;

  // Basic app info for compatibility
  @Prop({
    required: true,
    trim: true
  })
  appVersion: string;

  // Device status
  @Prop({
    default: true
  })
  isActive: boolean;

  @Prop({
    default: new Date()
  })
  lastActiveAt: Date;

  // Soft delete
  @Prop({
    default: false
  })
  isDeleted: boolean;
}

export const UserDeviceSchema = SchemaFactory.createForClass(UserDevice);

// Essential indexes
UserDeviceSchema.index({ userId: 1 });
UserDeviceSchema.index({ deviceId: 1 });
UserDeviceSchema.index({ pushToken: 1 }, { sparse: true });
UserDeviceSchema.index({ userId: 1, isActive: 1 });
UserDeviceSchema.index({ isDeleted: 1 });

// Virtual id
UserDeviceSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Clean JSON
UserDeviceSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    const { __v, ...cleanRet } = ret;
    return cleanRet;
  }
});
