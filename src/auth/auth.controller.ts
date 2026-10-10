import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './authenticated-user';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenPairDto } from './dto/token-pair.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for an access/refresh token pair' })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  login(@Body() dto: LoginDto): Promise<TokenPairDto> {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalid, expired or already used' })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairDto> {
    return this.auth.refresh(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the session behind a refresh token' })
  @ApiNoContentResponse({ description: 'Session revoked' })
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Return the caller identity resolved from the access token' })
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
