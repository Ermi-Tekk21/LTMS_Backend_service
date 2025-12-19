import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {
  private readonly apiUrl = process.env.FARMER_URL || 'http://http://13.50.253.205:4499/api/v1/farmer/getAllInOne';

  constructor() {}

  // Pass the token 
   async fetchEnglishLocations(token: string): Promise<any[]> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(this.apiUrl, { headers });

      // Only English locale
      return response.data.data.location.filter(loc => loc.locale === 'EN');
    } catch (error) {
      console.error('Error fetching locations:', error.message);
      throw new HttpException('Failed to fetch locations', 500);
    }
  }

  async getLocationTree(token: string) {
    // try {

    // } catch 
    const locations = await this.fetchEnglishLocations(token);
    const tree = {};

    locations.forEach(loc => {
      if (!tree[loc.region]) tree[loc.region] = {};
      if (!tree[loc.region][loc.zone]) tree[loc.region][loc.zone] = [];
      if (!tree[loc.region][loc.zone].includes(loc.woreda)) {
        tree[loc.region][loc.zone].push(loc.woreda);
      }
    });

    return tree;
  }

  async getLocationCode(region: string, zone: string, woreda: string, token: string) {
    const locations = await this.fetchEnglishLocations(token);
    const found = locations.find(
      loc => loc.region === region && loc.zone === zone && loc.woreda === woreda
    );
    if (!found) return null;
    return { location_code: found.location_code, id: found.id };
  }
}
