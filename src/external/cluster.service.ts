import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ClusterService {
    private readonly apiUrl =
        process.env.CLUSTER_URL ||
        'http://13.50.253.205:3344/api/v1/farmer/cluster/all';

    async getClusters(token: string): Promise<{ id: any; name: string }[]> {
        try {
            const headers = {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            };

            const response = await axios.get(this.apiUrl, { headers });

            if (response.data && response.data.success && Array.isArray(response.data.data)) {
                return response.data.data.map(cluster => ({
                    id: cluster.id,
                    name: cluster.name,
                }));
            }

            return [];
        } catch (error) {
            console.error('Error fetching clusters:', error.message);
            throw new HttpException('Failed to fetch clusters', 500);
        }
    }
}
