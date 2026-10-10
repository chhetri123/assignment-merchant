import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty({ description: 'Short-lived token for API calls' })
  accessToken: string;

  @ApiProperty({ description: 'Single-use token, rotated on every refresh' })
  refreshToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn: number;

  @ApiProperty({ example: { id: 'uuid', email: 'sales@merchant.test', role: 'SALES' } })
  user: { id: string; email: string; role: string };
}
