import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Tenant } from '../../core/tenancy/tenant.decorator';
import { TenantContext } from '../../core/tenancy/tenant-context';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Tenant() ctx: TenantContext) {
    const resultado = await this.auth.login(dto, ctx);
    return { datos: resultado, mensaje: 'Bienvenido' };
  }

  @Post('refresh')
  async refresh(
    @Body() body: { refreshToken: string },
    @Tenant() ctx: TenantContext,
  ) {
    const resultado = await this.auth.refrescar(body.refreshToken, ctx);
    return { datos: resultado };
  }
}
