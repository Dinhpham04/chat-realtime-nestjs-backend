import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserFriendDocument = UserFriend & Document;

/**
 * UserFriend Schema - MVP Phase
 * 
 * 🎯 Purpose: Core friendship relationship management
 * 📱 Mobile-First: Essential fields cho WhatsApp-style features
 * 🚀 MVP Focus: Simple, fast, scalable
 * 
 * Features:
 * - Friend request lifecycle (pending -> accepted/declined)
 * - Block/unblock functionality
 * - Contact sync integration
 * - Mobile-optimized metadata
 */
@Schema({
    timestamps: true,
    collection: 'user_friends',
})
export class UserFriend {
    // Core relationship - REQUIRED
    @Prop({
        type: Types.ObjectId,
        ref: 'UserCore',
        required: true,
        index: true
    })
    userId: Types.ObjectId;

    @Prop({
        type: Types.ObjectId,
        ref: 'UserCore',
        required: true,
        index: true
    })
    friendId: Types.ObjectId;

    // Friend request lifecycle - CORE MVP FEATURE
    @Prop({
        type: String,
        enum: ['pending', 'accepted', 'declined', 'blocked'],
        default: 'pending',
        index: true
    })
    status: string;

    // Who initiated the relationship - ESSENTIAL for mobile UX
    @Prop({
        type: Types.ObjectId,
        ref: 'UserCore',
        required: true
    })
    requestedBy: Types.ObjectId;

    // Optional message with friend request - NICE TO HAVE
    @Prop({
        type: String,
        maxlength: 500,
        default: null
    })
    requestMessage?: string;

    // Timeline tracking - USEFUL for mobile
    @Prop({
        type: Date,
        default: null
    })
    acceptedAt?: Date;

    @Prop({
        type: Date,
        default: null
    })
    blockedAt?: Date;

    // Block reason for audit - SECURITY
    @Prop({
        type: String,
        default: null
    })
    blockReason?: string;

    // Store previous status for potential restoration - ENHANCED UX
    @Prop({
        type: String,
        enum: ['pending', 'accepted', 'declined', 'blocked'],
        default: null
    })
    previousStatus?: string;

    // Flag to indicate this was an accepted friendship before blocking - RESTORATION LOGIC
    @Prop({
        type: Boolean,
        default: false
    })
    wasAcceptedFriendship?: boolean;

    // Flag to indicate this user was blocked by the target - BIDIRECTIONAL BLOCK
    @Prop({
        type: Boolean,
        default: false
    })
    blockedByTarget?: boolean;

    // When target user blocked this user - AUDIT TRAIL
    @Prop({
        type: Date,
        default: null
    })
    targetBlockedAt?: Date;

    // Mobile-specific: How friend was added - MOBILE ESSENTIAL
    @Prop({
        type: String,
        enum: ['manual', 'contact_sync', 'suggestion', 'qr_code'],
        default: 'manual'
    })
    addMethod: string;

    // Performance cache - MVP OPTIMIZATION
    @Prop({
        type: Number,
        default: null
    })
    mutualFriendsCount?: number;

    // Last interaction for sorting - MOBILE UX
    @Prop({
        type: Date,
        default: null
    })
    lastInteractionAt?: Date;
}

export const UserFriendSchema = SchemaFactory.createForClass(UserFriend);

// Essential indexes for MVP performance
UserFriendSchema.index({ userId: 1, status: 1 });
UserFriendSchema.index({ friendId: 1, status: 1 });
UserFriendSchema.index({ userId: 1, friendId: 1 }, { unique: true });
UserFriendSchema.index({ requestedBy: 1, createdAt: -1 });
UserFriendSchema.index({ status: 1, createdAt: -1 });
UserFriendSchema.index({ lastInteractionAt: -1 }, { sparse: true });

// Virtual để get ID
UserFriendSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

// Clean JSON output cho mobile API
UserFriendSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        const { __v, ...cleanRet } = ret;
        return cleanRet;
    }
});
