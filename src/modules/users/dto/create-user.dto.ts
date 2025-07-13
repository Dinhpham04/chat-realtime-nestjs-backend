import { IsEmail, IsNotEmpty, IsString, Matches, Max, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateUserDto {
    @ApiProperty({ example: 'user@example.com'})
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'john_doe'})
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @MaxLength(30)
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers and underscores' })
    username: string;

    @ApiProperty({ example: 'StrongPassword123!' })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    fullName: string;
}