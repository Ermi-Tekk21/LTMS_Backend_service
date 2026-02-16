import { Controller, Get, Req } from '@nestjs/common';
import { ClusterService } from './cluster.service';
import { Permission } from '../common/decorators/permission.decorator';

@Controller('cluster')
export class ClusterController {
    constructor(private readonly clusterService: ClusterService) { }

    @Permission('read', 'event')
    @Get()
    async getClusters(@Req() req: any) {
        const authHeader = req.headers['authorization'] as string | undefined;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.split(' ')[1]
            : authHeader;

        if (!token) {
            return {
                success: false,
                message: 'Authorization token is required',
                data: [],
            };
        }

        try {
            const clusters = await this.clusterService.getClusters(token);
            return {
                success: true,
                message: 'Clusters fetched successfully',
                data: clusters,
            };
        } catch (error) {
            return {
                success: false,
                message: error.message || 'Failed to fetch clusters',
                data: [],
            };
        }
    }
}
