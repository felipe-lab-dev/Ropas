import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(4)
  identificador!: string;

  @IsString()
  @MinLength(4)
  password!: string;
}
