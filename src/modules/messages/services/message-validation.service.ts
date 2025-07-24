/**
 * Message Validation Service
 * 
 * 🎯 Purpose: Business logic validation for message operations
 * 📱 Mobile-First: Comprehensive content and security validation
 * 🚀 Clean Architecture: Separated validation logic with clear rules
 * 
 * Design Principles:
 * - Single Responsibility: Only validation logic
 * - DRY: Reusable validation methods
 * - Security: Content sanitization and security checks
 * - Performance: Efficient validation with early returns
 */

import { Injectable, Logger } from '@nestjs/common';
import { MessageType, isValidMessageContent } from '../types/message.types';
import {
  InvalidMessageContentError,
  MessageValidationError,
  MessageSizeLimitError
} from '../exceptions/message-service.exceptions';
import {
  SendMessageDto,
  EditMessageDto,
  TextContentDto,
  LocationContentDto,
  MediaContentDto,
  FileContentDto
} from '../dto';

@Injectable()
export class MessageValidationService {
  private readonly logger = new Logger(MessageValidationService.name);

  // Configuration constants
  private readonly MAX_TEXT_LENGTH = 10000;
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly MAX_MENTIONS = 50;
  private readonly ALLOWED_MIME_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/mpeg', 'video/webm'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
    file: [] // Allow all file types but validate size
  };

  /**
   * Validate send message DTO
   */
  async validateSendMessage(dto: SendMessageDto): Promise<void> {
    this.logger.debug(`Validating send message DTO for type: ${dto.messageType}`);

    // Validate message type and content consistency
    await this.validateMessageContent(dto.messageType, dto.content);

    // Validate mentions
    if (dto.mentions) {
      this.validateMentions(dto.mentions);
    }

    // Validate client message ID if provided
    if (dto.clientMessageId) {
      this.validateClientMessageId(dto.clientMessageId);
    }

    this.logger.debug('Send message DTO validation passed');
  }

  /**
   * Validate edit message DTO
   */
  async validateEditMessage(
    messageType: MessageType,
    dto: EditMessageDto
  ): Promise<void> {
    this.logger.debug(`Validating edit message DTO for type: ${messageType}`);

    // Validate updated content
    await this.validateMessageContent(messageType, dto.content);

    // Validate updated mentions
    if (dto.mentions) {
      this.validateMentions(dto.mentions);
    }

    // Validate edit reason length
    if (dto.editReason && dto.editReason.length > 200) {
      throw new MessageValidationError(
        'editReason',
        'Edit reason cannot exceed 200 characters',
        dto.editReason.length
      );
    }

    this.logger.debug('Edit message DTO validation passed');
  }

  /**
   * Validate message content based on type
   */
  private async validateMessageContent(
    messageType: MessageType,
    content: any
  ): Promise<void> {
    if (!content) {
      throw new InvalidMessageContentError(
        'Content is required for non-system messages',
        messageType
      );
    }

    switch (messageType) {
      case MessageType.TEXT:
        this.validateTextContent(content as TextContentDto);
        break;

      case MessageType.LOCATION:
        this.validateLocationContent(content as LocationContentDto);
        break;

      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.AUDIO:
        this.validateMediaContent(content as MediaContentDto, messageType);
        break;

      case MessageType.FILE:
        this.validateFileContent(content as FileContentDto);
        break;

      case MessageType.SYSTEM:
        // System messages are handled separately, skip validation
        break;

      default:
        throw new InvalidMessageContentError(
          `Unsupported message type: ${messageType}`,
          messageType
        );
    }
  }

  /**
   * Validate text content
   */
  private validateTextContent(content: TextContentDto): void {
    if (!content.text || content.text.trim().length === 0) {
      throw new InvalidMessageContentError(
        'Text content cannot be empty',
        MessageType.TEXT
      );
    }

    if (content.text.length > this.MAX_TEXT_LENGTH) {
      throw new MessageSizeLimitError(
        content.text.length,
        this.MAX_TEXT_LENGTH
      );
    }

    // Check for valid message content using existing utility
    if (!isValidMessageContent(content.text)) {
      throw new InvalidMessageContentError(
        'Text content contains invalid characters or patterns',
        MessageType.TEXT
      );
    }

    // Security: Check for potential XSS or injection patterns
    this.validateTextSecurity(content.text);
  }

  /**
   * Validate location content
   */
  private validateLocationContent(content: LocationContentDto): void {
    // Latitude validation
    if (content.latitude < -90 || content.latitude > 90) {
      throw new MessageValidationError(
        'latitude',
        'Latitude must be between -90 and 90 degrees',
        content.latitude
      );
    }

    // Longitude validation
    if (content.longitude < -180 || content.longitude > 180) {
      throw new MessageValidationError(
        'longitude',
        'Longitude must be between -180 and 180 degrees',
        content.longitude
      );
    }

    // Address validation if provided
    if (content.address && content.address.length > 500) {
      throw new MessageValidationError(
        'address',
        'Address cannot exceed 500 characters',
        content.address.length
      );
    }
  }

  /**
   * Validate media content
   */
  private validateMediaContent(content: MediaContentDto, messageType: MessageType): void {
    if (!content.url || content.url.trim().length === 0) {
      throw new InvalidMessageContentError(
        'Media URL is required',
        messageType
      );
    }

    // Validate URL format
    if (!this.isValidUrl(content.url)) {
      throw new MessageValidationError(
        'url',
        'Invalid media URL format',
        content.url
      );
    }

    // Validate file size if provided
    if (content.size && content.size > this.MAX_FILE_SIZE) {
      throw new MessageSizeLimitError(content.size, this.MAX_FILE_SIZE);
    }

    // Validate duration for video/audio
    if ((messageType === MessageType.VIDEO || messageType === MessageType.AUDIO) &&
      content.duration && content.duration > 3600) {
      throw new MessageValidationError(
        'duration',
        'Media duration cannot exceed 1 hour',
        content.duration
      );
    }
  }

  /**
   * Validate file content
   */
  private validateFileContent(content: FileContentDto): void {
    if (!content.url || content.url.trim().length === 0) {
      throw new InvalidMessageContentError(
        'File URL is required',
        MessageType.FILE
      );
    }

    if (!content.filename || content.filename.trim().length === 0) {
      throw new InvalidMessageContentError(
        'Filename is required for file messages',
        MessageType.FILE
      );
    }

    // Validate URL format
    if (!this.isValidUrl(content.url)) {
      throw new MessageValidationError(
        'url',
        'Invalid file URL format',
        content.url
      );
    }

    // Validate file size
    if (content.size > this.MAX_FILE_SIZE) {
      throw new MessageSizeLimitError(content.size, this.MAX_FILE_SIZE);
    }

    // Validate filename
    if (content.filename.length > 255) {
      throw new MessageValidationError(
        'filename',
        'Filename cannot exceed 255 characters',
        content.filename.length
      );
    }

    // Security: Check for malicious filename patterns
    this.validateFilenameSecurity(content.filename);
  }

  /**
   * Validate mentions array
   */
  private validateMentions(mentions: string[]): void {
    if (mentions.length > this.MAX_MENTIONS) {
      throw new MessageValidationError(
        'mentions',
        `Cannot mention more than ${this.MAX_MENTIONS} users`,
        mentions.length
      );
    }

    // Check for duplicate mentions
    const uniqueMentions = new Set(mentions);
    if (uniqueMentions.size !== mentions.length) {
      throw new MessageValidationError(
        'mentions',
        'Duplicate user mentions are not allowed',
        mentions
      );
    }
  }

  /**
   * Validate client message ID
   */
  private validateClientMessageId(clientMessageId: string): void {
    // Check for alphanumeric with some special characters
    const validPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validPattern.test(clientMessageId)) {
      throw new MessageValidationError(
        'clientMessageId',
        'Client message ID can only contain letters, numbers, underscores, and hyphens',
        clientMessageId
      );
    }
  }

  /**
   * Security validation for text content
   */
  private validateTextSecurity(text: string): void {
    // Check for potential XSS patterns
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(text)) {
        throw new InvalidMessageContentError(
          'Text content contains potentially malicious patterns',
          MessageType.TEXT
        );
      }
    }

    // Check for excessive special characters (potential spam)
    const specialCharCount = (text.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g) || []).length;
    if (specialCharCount > text.length * 0.5) {
      throw new InvalidMessageContentError(
        'Text content contains too many special characters',
        MessageType.TEXT
      );
    }
  }

  /**
   * Security validation for filenames
   */
  private validateFilenameSecurity(filename: string): void {
    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new MessageValidationError(
        'filename',
        'Filename contains invalid path characters',
        filename
      );
    }

    // Check for dangerous file extensions
    const dangerousExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js',
      '.jar', '.sh', '.php', '.asp', '.aspx', '.jsp'
    ];

    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (dangerousExtensions.includes(extension)) {
      throw new MessageValidationError(
        'filename',
        `File extension ${extension} is not allowed`,
        extension
      );
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Check if message type requires content
   */
  public requiresContent(messageType: MessageType): boolean {
    return messageType !== MessageType.SYSTEM;
  }

  /**
   * Get maximum content size for message type
   */
  public getMaxContentSize(messageType: MessageType): number {
    switch (messageType) {
      case MessageType.TEXT:
        return this.MAX_TEXT_LENGTH;
      case MessageType.IMAGE:
      case MessageType.VIDEO:
      case MessageType.AUDIO:
      case MessageType.FILE:
        return this.MAX_FILE_SIZE;
      default:
        return this.MAX_TEXT_LENGTH;
    }
  }
}
