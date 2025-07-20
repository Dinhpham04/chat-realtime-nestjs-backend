/**
 * Friends Module Types - MVP Phase
 * 
 * 🎯 Purpose: TypeScript interfaces cho friend operations
 * 📱 Mobile-First: Optimized response models
 * 🚀 Clean Architecture: Interface-first approach
 */

// Core Enums
export enum FriendStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    DECLINED = 'declined',
    BLOCKED = 'blocked'
}

export enum AddMethod {
    MANUAL = 'manual',
    CONTACT_SYNC = 'contact_sync',
    SUGGESTION = 'suggestion',
    QR_CODE = 'qr_code'
}

export enum ContactSource {
    PHONEBOOK = 'phonebook',
    GMAIL = 'gmail',
    FACEBOOK = 'facebook'
}

// Friend Request Types
export interface SendFriendRequestParams {
    senderId: string;
    receiverId?: string;
    phoneNumber?: string;
    message?: string;
    addMethod?: AddMethod;
}

export interface FriendRequestResponse {
    id: string;
    userId: string;
    friendId: string;
    status: FriendStatus;
    requestedBy: string;
    requestMessage?: string;
    addMethod: AddMethod;
    createdAt: Date;
}

// Friend List Types
export interface FriendListOptions {
    page?: number;
    limit?: number;
    search?: string;
    onlineStatus?: boolean; // true=online only, false=offline only, undefined=all
    status?: 'online' | 'all'; // Keep for backward compatibility
    sortBy?: 'recent' | 'name' | 'mutual';
}

export interface FriendWithStatus {
    id: string;
    user: UserSummary;
    isOnline: boolean;
    lastSeen?: Date;
    lastInteraction?: Date;
    mutualFriendsCount?: number;
    addMethod: AddMethod;
    friendedAt: Date;
}

export interface FriendListResult {
    friends: FriendWithStatus[];
    onlineCount: number;
    total: number;
    page: number;
    totalPages: number;
}

// Contact Sync Types
export interface ContactImport {
    phoneNumber: string;
    contactName: string;
    contactSource?: ContactSource;
}

export interface ContactSyncParams {
    userId: string;
    contacts: ContactImport[];
    autoFriend?: boolean;
}

export interface RegisteredContact {
    phoneNumber: string;
    contactName: string;
    user: UserSummary;
    isAlreadyFriend: boolean;
    autoFriended: boolean;
}

export interface ContactSyncResult {
    imported: number;
    registered: RegisteredContact[];
    newFriends: UserSummary[];
    duplicates: number;
    errors: string[];
}

// User Summary Type (shared)
export interface UserSummary {
    id: string;
    fullName: string;
    username?: string;
    phoneNumber: string;
    avatarUrl?: string;
    isOnline: boolean;
    lastSeen?: Date;
}

// Friend Actions
export interface FriendActionParams {
    userId: string;
    friendId: string;
    reason?: string;
}

export interface BlockUserParams extends FriendActionParams {
    reason?: string;
}

// Search Types
export interface FriendSearchParams {
    query: string;
    // Removed type - will be auto-detected
    page?: number;
    limit?: number;
}

export interface UserSearchResult extends UserSummary {
    isFriend: boolean;
    hasPendingRequest: boolean;
    mutualFriendsCount?: number;
}

// Repository Interfaces (using generic Document types to avoid circular imports)
export interface IUserFriendRepository {
    create(params: any): Promise<any>;
    upsertFriendship(params: any): Promise<any>;
    findById(id: string): Promise<any | null>;
    findByUserAndFriend(userId: string, friendId: string): Promise<any | null>;
    findFriendsByUserId(userId: string, options?: FriendListOptions): Promise<any[]>;
    updateStatus(id: string, status: FriendStatus, metadata?: any): Promise<any>;
    delete(id: string): Promise<boolean>;
    deleteBatch(friendshipIds: string[]): Promise<number>;
    deleteAllUserFriendships(userId: string): Promise<number>;
    countFriendsByStatus(userId: string, status: FriendStatus): Promise<number>;

    // Additional methods used by FriendsService
    findPendingRequests(userId: string, type?: 'incoming' | 'outgoing'): Promise<any[]>;
    findFriendRequests(userId: string, options?: {
        type?: 'incoming' | 'outgoing' | 'all';
        status?: FriendStatus;
        limit?: number;
        offset?: number;
    }): Promise<any[]>;
    areFriends(userId: string, friendId: string): Promise<boolean>;
    updateLastInteraction(userId: string, friendId: string): Promise<void>;
}

export interface IUserContactRepository {
    create(params: any): Promise<any>;
    findByUserId(userId: string): Promise<any[]>;
    findByPhoneNumber(phoneNumber: string): Promise<any[]>;
    bulkCreate(contacts: any[]): Promise<any[]>;
    updateRegistrationStatus(contactId: string, registeredUserId: string): Promise<any>;
    findRegisteredContacts(phoneNumbers: string[]): Promise<any[]>;

    // Additional methods used by ContactSyncService
    findAutoFriendCandidates(phoneNumber: string): Promise<any[]>;
    markAutoFriended(contactId: string): Promise<boolean>;
    updateSyncTimestamp(userId: string): Promise<void>;
    delete(contactId: string): Promise<boolean>;
    getContactStats(userId: string): Promise<{
        total: number;
        registered: number;
        autoFriended: number;
    }>;
    exists(userId: string, phoneNumber: string): Promise<boolean>;
}

// Service Interfaces
export interface IFriendsService {
    sendFriendRequest(params: SendFriendRequestParams): Promise<FriendRequestResponse>;
    acceptFriendRequest(requestId: string, userId: string): Promise<void>;
    declineFriendRequest(requestId: string, userId: string, reason?: string): Promise<void>;
    getFriendRequests(userId: string, options?: {
        type?: 'incoming' | 'outgoing' | 'all';
        status?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
        limit?: number;
        offset?: number;
    }): Promise<{
        requests: FriendRequestResponse[];
        total: number;
        hasMore: boolean;
    }>;
    getFriendsList(userId: string, options?: FriendListOptions): Promise<FriendListResult>;
    getFriendStatus(userId: string, targetUserId: string): Promise<{
        status: 'FRIENDS' | 'PENDING_OUTGOING' | 'PENDING_INCOMING' | 'BLOCKED' | 'NONE';
        canSendMessage: boolean;
        canSendFriendRequest: boolean;
        friendshipDate?: Date;
        pendingRequest?: {
            id: string;
            type: 'incoming' | 'outgoing';
            createdAt: Date;
        };
    }>;
    removeFriend(userId: string, friendId: string): Promise<void>;
    blockUser(params: BlockUserParams): Promise<void>;
    unblockUser(userId: string, friendId: string): Promise<void>;
    searchUsers(params: FriendSearchParams, currentUserId: string): Promise<UserSearchResult[]>;
}

export interface IContactSyncService {
    importContacts(params: ContactSyncParams): Promise<ContactSyncResult>;
    syncContacts(params: ContactSyncParams): Promise<{
        stats: {
            newRegistrations: number;
            updates: number;
            autoFriended: number;
            processed: number;
        };
        newRegisteredContacts: RegisteredContact[];
        errors: string[];
    }>;
    findRegisteredContacts(phoneNumbers: string[]): Promise<RegisteredContact[]>;
    autoFriendRegisteredContact(userId: string, registeredUserId: string): Promise<boolean>;
    getContactStats(userId: string): Promise<{
        total: number;
        registered: number;
        autoFriended: number;
    }>;
    getUserContacts(userId: string): Promise<any[]>;
    deleteContact(contactId: string): Promise<boolean>;
    deleteAllUserContacts(userId: string): Promise<{
        deletedCount: number;
        errors: string[];
    }>;
}


