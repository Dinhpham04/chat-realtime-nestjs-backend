import { IsArray, IsOptional, IsBoolean, ValidateNested, ArrayMaxSize, IsString, IsNotEmpty, IsPhoneNumber, IsEnum, MaxLength } from 'class-validator';
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
 * ImportContactsDto - Bulk contact import validation
 * 
 * 🎯 Purpose: Validate bulk contact import data
 * 📱 Mobile-First: Support 1000+ contacts import
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
}
