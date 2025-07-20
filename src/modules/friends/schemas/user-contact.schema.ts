import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserContactDocument = UserContact & Document;

/**
 * UserContact Schema - MVP Phase
 * 
 * 🎯 Purpose: Contact sync và phone discovery
 * 📱 Mobile-First: Import contacts, auto-friend registered users
 * 🚀 MVP Focus: Essential contact mapping
 * 
 * Features:
 * - Import phone contacts
 * - Map contacts to registered users
 * - Auto-friend when contact registers
 * - Contact-based friend suggestions
 */
@Schema({
    timestamps: true,
    collection: 'user_contacts',
})
export class UserContact {
    // Who imported this contact - REQUIRED
    @Prop({
        type: Types.ObjectId,
        ref: 'UserCore',
        required: true,
        index: true
    })
    userId: Types.ObjectId;

    // Contact info from phone - REQUIRED
    @Prop({
        type: String,
        required: true,
        match: /^\+?[1-9]\d{1,14}$/, // E.164 format
        index: true
    })
    phoneNumber: string;

    @Prop({
        type: String,
        required: true,
        maxlength: 100,
        trim: true
    })
    contactName: string;

    // Registration mapping - CORE FEATURE
    @Prop({
        type: Types.ObjectId,
        ref: 'UserCore',
        default: null,
        index: true
    })
    registeredUserId?: Types.ObjectId; // link đến user đã đăng ký trên platform

    @Prop({
        type: Boolean,
        default: false
    })
    isRegistered: boolean; // contact đã đăng ký trên platform chưa

    @Prop({
        type: Date,
        default: null
    })
    registeredAt?: Date;

    // Auto-friend behavior - MVP FEATURE
    @Prop({
        type: Boolean,
        default: true
    })
    autoFriendWhenRegisters: boolean; // tự động kết bạn khi contact đăng ký 
    // mobile user case: setting => "auto-add contacts as friends"

    @Prop({
        type: Boolean,
        default: false
    })
    autoFriended: boolean; // đã auto-friend với contact này chưa
    // don't auto-friend twice

    @Prop({
        type: Date,
        default: null
    })
    autoFriendedAt?: Date;

    // Contact metadata - USEFUL
    @Prop({
        type: String,
        default: 'phonebook' // 'phonebook', 'gmail', 'facebook'
    })
    contactSource: string;

    // Last sync time - PERFORMANCE
    @Prop({
        type: Date,
        default: Date.now
    })
    lastSyncAt: Date;

    // Soft delete - SAFETY
    @Prop({
        type: Boolean,
        default: false
    })
    isDeleted: boolean;
}

export const UserContactSchema = SchemaFactory.createForClass(UserContact);

// Essential indexes for MVP
UserContactSchema.index({ userId: 1 });
UserContactSchema.index({ phoneNumber: 1 });
UserContactSchema.index({ userId: 1, phoneNumber: 1 }, { unique: true });
UserContactSchema.index({ registeredUserId: 1 }, { sparse: true });
UserContactSchema.index({ isRegistered: 1, autoFriendWhenRegisters: 1 });

// Virtual ID
UserContactSchema.virtual('id').get(function () {
    return this._id.toHexString();
});

// Clean JSON output
UserContactSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        const { __v, ...cleanRet } = ret;
        return cleanRet;
    }
});
