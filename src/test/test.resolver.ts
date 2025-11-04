import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permission } from '../common/decorators/permission.decorator';

@Resolver()
export class TestResolver {
  @Query(() => String)
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Permission('read', 'farmer')
  async testPermission() {
    return 'Permission check passed!';
  }
}
