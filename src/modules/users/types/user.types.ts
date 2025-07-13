import {
    UserStatus,
    Gender,
    MobilePlatform,
    PushProvider,
    ThemeMode,
    FontSize,
    PrivacySetting,
    ActivityStatus
} from '../enums';

// Core User Types
export interface CreateUserParams {
    phoneNumber: string; // Required for mobile-first
    fullName: string;
    email?: string;
    username?: string;
    password?: string;
}

export interface UpdateUserCoreParams {
    fullName?: string;
    avatarUrl?: string;
    bio?: string;
    dateOfBirth?: Date;
    gender?: Gender;
    email?: string;
    username?: string;
}

export interface UserCoreResponse {
    id: string;
    phoneNumber: string;
    isPhoneVerified: boolean;
    email?: string;
    username?: string;
    fullName: string;
    bio?: string;
    dateOfBirth?: Date;
    gender?: Gender;
    avatarUrl?: string;
    status: UserStatus;
    activityStatus: ActivityStatus;
    lastSeen: Date;
    friends: string[];
    isEmailVerified?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Device Types
export interface RegisterDeviceParams {
    deviceId: string;
    platform: MobilePlatform;
    appVersion: string;
    pushToken?: string;
    pushProvider: PushProvider;
}

export interface UpdateDeviceParams {
    pushToken?: string;
    appVersion?: string;
    isActive?: boolean;
}

export interface UserDeviceResponse {
    id: string;
    userId: string;
    deviceId: string;
    platform: MobilePlatform;
    pushToken?: string;
    pushProvider: PushProvider;
    appVersion: string;
    isActive: boolean;
    lastActiveAt: Date;
    createdAt: Date;
}

// Settings Types
export interface UpdatePrivacySettingsParams {
    profilePhoto?: PrivacySetting;
    lastSeen?: PrivacySetting;
    about?: PrivacySetting;
    phoneNumber?: PrivacySetting;
    readReceipts?: boolean;
    groupInvites?: PrivacySetting;
}

export interface UpdateNotificationSettingsParams {
    messageNotifications?: boolean;
    groupNotifications?: boolean;
    callNotifications?: boolean;
    soundEnabled?: boolean;
    showPreview?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
}

export interface UpdateAppPreferencesParams {
    theme?: ThemeMode;
    fontSize?: FontSize;
    language?: string;
}

export interface UserSettingsResponse {
    id: string;
    userId: string;
    privacySettings: {
        profilePhoto: PrivacySetting;
        lastSeen: PrivacySetting;
        about: PrivacySetting;
        phoneNumber: PrivacySetting;
        readReceipts: boolean;
        groupInvites: PrivacySetting;
    };
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
    appPreferences: {
        theme: ThemeMode;
        fontSize: FontSize;
        language: string;
    };
    lastSyncAt: Date;
}

// Security Types
export interface SecurityLogEntry {
    action: string;
    ip: string;
    userAgent?: string;
    timestamp: Date;
    location?: string;
    deviceId?: string;
    success: boolean;
}

export interface UserSecurityResponse {
    id: string;
    userId: string;
    twoFactorEnabled: boolean;
    securityLogs: SecurityLogEntry[];
    failedLoginAttempts: number;
    lockedUntil?: Date;
    lastSecurityCheck: Date;
}

// Query Types
export interface FindUsersParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: UserStatus;
    activityStatus?: ActivityStatus;
}

export interface FindUsersResponse {
    users: UserCoreResponse[];
    total: number;
    page: number;
    totalPages: number;
}

export interface FriendActionParams {
    userId: string;
    friendId: string;
}

export interface UserSearchResult {
    id: string;
    username?: string;
    fullName: string;
    phoneNumber: string;
    avatarUrl?: string;
    activityStatus: ActivityStatus;
    isFriend: boolean;
}