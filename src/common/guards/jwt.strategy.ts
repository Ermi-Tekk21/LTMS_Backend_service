import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
     if (!secret){
      throw new Error('JWT_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:secret,
    });
    console.log('JwtStrategy initialized, secret present', secret);
  }
  // Called automatically when a valid JWT is found
  async validate(payload: any) {
    console.log('JWT payload:', payload);
    return {
    userId: payload.sub,
    name: payload.name,
    admin: payload.admin,
    };

  }
  
}
