import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  StorageProvider,
  UploadStatus,
  ScanResult,
  ThumbnailSize,
  FileQuality,
  FileInfo,
  StorageInfo,
  MediaInfo,
  AudioInfo,
  UploadInfo,
  AccessControl,
  getFileCategory
} from '../types/message-attachment.types';

export type MessageAttachmentDocument = MessageAttachment & Document;

/**
 * MessageAttachment Schema - Single Responsibility
 * 
 * RESPONSIBILITY:
 * - File metadata storage
 * - Media processing results (thumbnails, compression)
 * - Upload tracking và progress
 * - File security và access control
 */
@Schema({
  timestamps: true,
  collection: 'message_attachments',
})
export class MessageAttachment {
  _id: Types.ObjectId;

  // =============== CORE RELATIONSHIP ===============

  /**
   * Message reference - REQUIRED
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'Message',
    required: true,
    index: true
  })
  messageId: Types.ObjectId;

  /**
   * Uploader reference
   */
  @Prop({
    type: Types.ObjectId,
    ref: 'UserCore',
    required: true,
    index: true
  })
  uploadedBy: Types.ObjectId;

  // =============== FILE METADATA ===============

  /**
   * File identification
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true
  })
  fileId: string; // Unique identifier for this file

  /**
   * Original file information
   */
  @Prop({
    type: {
      originalName: { type: String, required: true, maxlength: 255 },
      fileName: { type: String, required: true }, // Stored file name
      mimeType: { type: String, required: true },
      fileSize: { type: Number, required: true, min: 0 },
      checksum: { type: String, required: true } // File integrity check
    },
    required: true
  })
  fileInfo: FileInfo;

  /**
   * File storage information
   */
  @Prop({
    type: {
      storageProvider: {
        type: String,
        enum: Object.values(StorageProvider),
        default: StorageProvider.LOCAL
      },
      storagePath: { type: String, required: true },
      publicUrl: { type: String, required: true },
      cdnUrl: { type: String, default: null },
      expiresAt: { type: Date, default: null } // For temporary files
    },
    required: true
  })
  storage: StorageInfo;

  // =============== MEDIA PROCESSING ===============

  /**
   * Image/Video specific metadata
   */
  @Prop({
    type: {
      dimensions: {
        width: { type: Number },
        height: { type: Number }
      },
      thumbnails: [{
        size: { type: String, enum: Object.values(ThumbnailSize) },
        width: { type: Number },
        height: { type: Number },
        url: { type: String },
        fileSize: { type: Number }
      }],
      duration: { type: Number }, // For video/audio (seconds)
      format: { type: String }, // Original format
      quality: { type: String, enum: Object.values(FileQuality) },
      isCompressed: { type: Boolean, default: false }
    },
    default: null
  })
  mediaInfo?: MediaInfo;

  /**
   * Audio specific metadata
   */
  @Prop({
    type: {
      duration: { type: Number }, // Duration in seconds
      bitrate: { type: Number },
      sampleRate: { type: Number },
      channels: { type: Number },
      waveform: [{ type: Number }], // Waveform data for visualization
      transcript: { type: String } // Voice transcription
    },
    default: null
  })
  audioInfo?: AudioInfo;

  // =============== UPLOAD TRACKING ===============

  /**
   * Upload process information
   */
  @Prop({
    type: {
      status: {
        type: String,
        enum: Object.values(UploadStatus),
        default: UploadStatus.COMPLETED
      },
      uploadProgress: { type: Number, min: 0, max: 100, default: 100 },
      processingStatus: {
        thumbnailGenerated: { type: Boolean, default: false },
        compressionApplied: { type: Boolean, default: false },
        virusScanned: { type: Boolean, default: false },
        scanResult: {
          type: String,
          enum: Object.values(ScanResult),
          default: ScanResult.CLEAN
        }
      },
      uploadedAt: { type: Date, default: Date.now },
      processedAt: { type: Date }
    },
    default: {
      status: UploadStatus.COMPLETED,
      uploadProgress: 100,
      processingStatus: {
        thumbnailGenerated: false,
        compressionApplied: false,
        virusScanned: false,
        scanResult: ScanResult.CLEAN
      },
      uploadedAt: new Date()
    }
  })
  uploadInfo: UploadInfo;

  // =============== ACCESS CONTROL ===============

  /**
   * File access và security
   */
  @Prop({
    type: {
      isPublic: { type: Boolean, default: false },
      requiresAuth: { type: Boolean, default: true },
      downloadCount: { type: Number, default: 0 },
      lastAccessedAt: { type: Date, default: Date.now },
      accessRestrictions: {
        allowedUsers: [{ type: Types.ObjectId, ref: 'UserCore' }],
        maxDownloads: { type: Number, default: null },
        expiresAfter: { type: Number, default: null } // Hours
      }
    },
    default: {
      isPublic: false,
      requiresAuth: true,
      downloadCount: 0,
      lastAccessedAt: new Date(),
      accessRestrictions: {
        allowedUsers: []
      }
    }
  })
  accessControl: AccessControl;

  // Timestamps từ @Schema({ timestamps: true })
  createdAt: Date;
  updatedAt: Date;
}

export const MessageAttachmentSchema = SchemaFactory.createForClass(MessageAttachment);

// =============== INDEXES FOR PERFORMANCE ===============

// Core lookup indexes
MessageAttachmentSchema.index({ messageId: 1 }); // Get attachments for message
MessageAttachmentSchema.index({ fileId: 1 }, { unique: true }); // File lookup
MessageAttachmentSchema.index({ uploadedBy: 1, createdAt: -1 }); // User's uploads

// Storage and cleanup indexes
MessageAttachmentSchema.index({ 'storage.expiresAt': 1 }, { sparse: true }); // Cleanup expired files
MessageAttachmentSchema.index({ 'uploadInfo.status': 1, createdAt: -1 }); // Process failed uploads
MessageAttachmentSchema.index({ 'storage.storageProvider': 1, 'fileInfo.fileSize': -1 }); // Storage analytics

// =============== VIRTUAL FIELDS ===============

/**
 * Get file type category
 */
MessageAttachmentSchema.virtual('fileCategory').get(function () {
  return getFileCategory(this.fileInfo.mimeType);
});

/**
 * Check if file is ready for download
 */
MessageAttachmentSchema.virtual('isReady').get(function () {
  return this.uploadInfo.status === UploadStatus.COMPLETED &&
    this.uploadInfo.processingStatus.scanResult === ScanResult.CLEAN;
});

/**
 * Get human readable file size
 */
MessageAttachmentSchema.virtual('fileSizeFormatted').get(function () {
  const bytes = this.fileInfo.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// =============== DOCUMENT MIDDLEWARE ===============

/**
 * Pre-save middleware
 */
MessageAttachmentSchema.pre('save', function (next) {
  // Generate fileId if not exists
  if (!this.fileId) {
    this.fileId = `${this.messageId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Update processing timestamp
  if (this.uploadInfo.status === 'completed' && !this.uploadInfo.processedAt) {
    this.uploadInfo.processedAt = new Date();
  }

  next();
});

// =============== SCHEMA METHODS ONLY ===============
// NOTE: Query methods moved to Repository layer following Clean Architecture
// Static methods here are for schema-level operations only

// JSON output customization
MessageAttachmentSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    // Don't expose internal storage paths in API responses
    if (ret.storage && ret.storage.storagePath) {
      ret.storage = {
        ...ret.storage,
        storagePath: '[HIDDEN]'
      };
    }
    return ret;
  }
});
