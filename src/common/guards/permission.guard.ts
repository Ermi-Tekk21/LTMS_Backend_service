import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLClient, gql } from 'graphql-request';
import { PERMISSION_KEY } from '../decorators/permission.decorator';
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly graphqlClient: GraphQLClient;

 constructor(private readonly reflector: Reflector) {
  
  const url =
    process.env.GRAPHQL_URL ||
    'http://13.50.253.205:3344/graphql';

  const apiKey =
    process.env.INTERNAL_API_KEY ||
    'dB+2Bo9VBHrMZQQsmS3pP+TPo0OjWEYo2guAPm9s';

  this.graphqlClient = new GraphQLClient(url, {
    headers: {
      'x-internal-api-key': apiKey,
    },
  });
}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get permission metadata from decorator
    const permission = this.reflector.getAllAndOverride(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permission) return true; 
    const { action, resource } = permission;

    const req =
      context.getType<'http' | 'graphql'>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();

    const user = req.user;
    if (!user?.userId) throw new ForbiddenException('User not authenticated');

    const perm = `${action}:${resource}`;
    const query = gql`
      query userHasPermission($userId: String!, $perm: String!) {
        userHasPermission(userId: $userId, perm: $perm)
      }
    `;

    const variables = { userId: user.userId, perm };
    // Call permission service
    const response = await this.graphqlClient.request(query, variables);
    const allowed = response.userHasPermission;
    console.log('Permission check for user:', user.userId, perm, '=>', allowed);

    if (!allowed) throw new ForbiddenException('Permission denied');

    return true;
  }
}
