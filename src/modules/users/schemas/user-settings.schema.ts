import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PrivacySetting, ThemeMode, FontSize } from '../enums';

export type UserSettingsDocument = UserSettings & Document;

/**
 * User Settings Schema - Backup of client settings
 * Primary settings managed by client, this is backup/sync
 */
@Schema({
  timestamps: true,
  collection: 'user_settings',
})
export class UserSettings {
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    unique: true,
    index: true
  })
  userId: Types.ObjectId;

  // Essential privacy settings - needed for server logic
  @Prop({
    type: {
      profilePhoto: { type: String, enum: Object.values(PrivacySetting), default: PrivacySetting.EVERYONE },
      lastSeen: { type: String, enum: Object.values(PrivacySetting), default: PrivacySetting.EVERYONE },
      about: { type: String, enum: Object.values(PrivacySetting), default: PrivacySetting.EVERYONE },
      phoneNumber: { type: String, enum: Object.values(PrivacySetting), default: PrivacySetting.CONTACTS },
      readReceipts: { type: Boolean, default: true },
      groupInvites: { type: String, enum: Object.values(PrivacySetting), default: PrivacySetting.EVERYONE }
    },
    default: {}
  })
  privacySettings: {
    profilePhoto: PrivacySetting;
    lastSeen: PrivacySetting;
    about: PrivacySetting;
    phoneNumber: PrivacySetting;
    readReceipts: boolean;
    groupInvites: PrivacySetting;
  };

  // Key notification settings - needed for push notifications
  @Prop({
    type: {
      messageNotifications: { type: Boolean, default: true },
      groupNotifications: { type: Boolean, default: true },
      callNotifications: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
      showPreview: { type: Boolean, default: true },
      quietHoursEnabled: { type: Boolean, default: false },
      quietHoursStart: { type: String, default: '22:00' },
      quietHoursEnd: { type: String, default: '08:00' }
    },
    default: {}
  })
  notificationSettings: {
    messageNotifications: boolean;
    groupNotifications: boolean;
    callNotifications: boolean;
    soundEnabled: boolean;
    showPreview: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
  };

  // Basic app preferences - for sync across devices
  @Prop({
    type: {
      theme: { type: String, enum: Object.values(ThemeMode), default: ThemeMode.AUTO },
      fontSize: { type: String, enum: Object.values(FontSize), default: FontSize.MEDIUM },
      language: { type: String, default: 'en' }
    },
    default: {}
  })
  appPreferences: {
    theme: ThemeMode;
    fontSize: FontSize;
    language: string;
  };

  // Backup timestamp
  @Prop({
    default: new Date()
  })
  lastSyncAt: Date;
}

export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);

// Essential indexes
UserSettingsSchema.index({ userId: 1 });
UserSettingsSchema.index({ lastSyncAt: 1 });

// Virtual id
UserSettingsSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Clean JSON
UserSettingsSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    const { __v, ...cleanRet } = ret;
    return cleanRet;
  }
});
