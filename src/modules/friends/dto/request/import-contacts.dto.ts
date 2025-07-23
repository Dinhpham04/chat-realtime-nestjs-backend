import { IsArray, IsOptional, IsBoolean, ValidateNested, ArrayMaxSize, IsString, IsNotEmpty, IsPhoneNumber, IsEnum, IsNumber, MaxLength, Min, IsIn, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactSource } from '../../types';

/**
 * ContactImportItemDto - Single contact item validation
 * 
 * 🎯 Purpose: Validate individual contact data
 * 📱 Mobile-First: Phone book contact structure
 * 🚀 Single Responsibility: Only contact item validation
 */
export class ContactImportItemDto {
    @ApiProperty({
        description: 'Contact phone number in international format',
        example: '+84901234567',
        pattern: '^\\+?[1-9]\\d{1,14}$'
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

    @ApiPropertyOptional({
        description: 'Device network type when importing',
        enum: ['wifi', '4g', '5g', '3g', 'offline'],
        example: 'wifi'
    })
    @IsOptional()
    @IsIn(['wifi', '4g', '5g', '3g', 'offline'])
    networkType?: string;
}

/**
 * ImportContactsDto - Bulk contact import validation
 * 
 * 🎯 Purpose: Validate bulk contact import data
 * 📱 Mobile-First: Support 1000+ contacts import with device context
 * 🚀 Single Responsibility: Only contact import validation
 */
export class ImportContactsDto {
    @ApiProperty({
        description: 'Array of contacts để import',
        type: [ContactImportItemDto],
        maxItems: 1000
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ContactImportItemDto)
    @ArrayMaxSize(1000)
    contacts: ContactImportItemDto[];

    @ApiPropertyOptional({
        description: 'Auto-friend registered contacts',
        example: true
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    autoFriend?: boolean = true;

    @ApiPropertyOptional({
        description: 'SHA256 hash of all contacts on device for sync verification',
        example: 'a1b2c3d4e5f6...',
        maxLength: 64
    })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    deviceContactsHash?: string;

    @ApiPropertyOptional({
        description: 'Total number of contacts on user device',
        example: 150,
        minimum: 0
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    totalContactsOnDevice?: number;

    @ApiPropertyOptional({
        description: 'Device platform',
        enum: ['ios', 'android', 'web'],
        example: 'ios'
    })
    @IsOptional()
    @IsIn(['ios', 'android', 'web'])
    platform?: string;

    @ApiPropertyOptional({
        description: 'Device battery level (0-100)',
        example: 85,
        minimum: 0,
        maximum: 100
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(100)
    batteryLevel?: number;

    @ApiPropertyOptional({
        description: 'Network type during import',
        enum: ['wifi', '4g', '5g', '3g', 'offline'],
        example: 'wifi'
    })
    @IsOptional()
    @IsIn(['wifi', '4g', '5g', '3g', 'offline'])
    networkType?: string;

    @ApiPropertyOptional({
        description: 'Enable low data mode optimization',
        example: false
    })
    @IsOptional()
    @Type(() => Boolean)
    @IsBoolean()
    lowDataMode?: boolean = false;
}
