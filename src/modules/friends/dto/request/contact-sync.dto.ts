import { IsArray, IsOptional, IsBoolean, ValidateNested, ArrayMaxSize, IsString, IsNotEmpty, IsPhoneNumber, IsEnum, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactSource } from '../../types';

/**
 * ContactSyncItemDto - Single contact for sync validation
 * 
 * 🎯 Purpose: Validate contact sync data
 * 📱 Mobile-First: Phone book contact structure
 * 🚀 Single Responsibility: Only contact sync validation
 */
export class ContactSyncItemDto {
    @ApiProperty({
        description: 'Contact phone number',
        example: '+84901234567'
    })
    @IsPhoneNumber()
    phoneNumber: string;

    @ApiProperty({
        description: 'Contact name',
        example: 'John Doe',
        maxLength: 100
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    contactName: string;

    @ApiPropertyOptional({
        description: 'Contact source',
        enum: ContactSource,
        example: ContactSource.PHONEBOOK
    })
    @IsOptional()
    @IsEnum(ContactSource)
    contactSource?: ContactSource;
}

/**
 * ContactSyncDto - Contact sync validation
 * 
 * 🎯 Purpose: Validate contact sync operation
 * 📱 Mobile-First: Support incremental sync
 * 🚀 Single Responsibility: Only contact sync validation
 */
export class ContactSyncDto {
    @ApiProperty({
        description: 'Array of contacts để sync',
        type: [ContactSyncItemDto],
        maxItems: 500
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ContactSyncItemDto)
    @ArrayMaxSize(500)
    contacts: ContactSyncItemDto[];

    @ApiPropertyOptional({
        description: 'Auto-friend registered contacts',
        example: true
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    autoFriend?: boolean = true;

    @ApiPropertyOptional({
        description: 'Force resync all contacts',
        example: false
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    forceResync?: boolean = false;
}
