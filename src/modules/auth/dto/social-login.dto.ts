import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { DeviceInfoDto } from './index';

export class SocialLoginDto {
  @IsEnum(['google'])
  provider: 'google';

  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @IsOptional()
  @IsString()
  idToken?: string;

  @IsNotEmpty()
  deviceInfo: DeviceInfoDto;
}

export class GoogleAuthCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}
