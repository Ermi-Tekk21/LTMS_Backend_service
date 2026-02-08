import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permission required
    if (!permission) return true;

    const { action, resource } = permission;
    const requiredPermission = `${action}:${resource}`;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user?.permissions) {
      throw new ForbiddenException('Permissions missing in token');
    }

    if (!user.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        `Missing permission: ${requiredPermission}`,
      );
    }

    return true;
  }
}
