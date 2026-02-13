import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IamJwtStrategy extends PassportStrategy(Strategy, 'iam-jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('IAM_JWT_SECRET'),
      issuer: configService.get<string>('IAM_ISSUER'),
      audience: configService.get<string>('IAM_AUDIENCE'),
    });
  }

  async validate(payload: any) {
    return {
      userId: payload.sub,
      tenantId: payload.tenant_id,
      membershipId: payload.membership_id,
      permissions: payload.permissions,
    };
  }
}
