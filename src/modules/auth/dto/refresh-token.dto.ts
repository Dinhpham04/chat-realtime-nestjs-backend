import { IsString, IsNotEmpty, IsJWT } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @IsJWT()
  refreshToken: string;
}
