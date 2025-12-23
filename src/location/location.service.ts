import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {
  private readonly apiUrl =
    process.env.FARMER_URL ||
    'http://13.50.253.205:4499/api/v1/farmer/getAllInOne';

  // Normalize for logic
  private normalize(value: string): string {
    return value?.trim().toLowerCase();
  }

  // Format for display
  private formatDisplay(value: string): string {
    return value
      ?.trim()
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  async fetchEnglishLocations(token: string): Promise<any[]> {
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await axios.get(this.apiUrl, { headers });

      return response.data.data.location
        .filter(loc => loc.locale === 'EN')
        .map(loc => ({
          ...loc,
          region: loc.region?.trim(),
          zone: loc.zone?.trim(),
          woreda: loc.woreda?.trim(),
        }));
    } catch (error) {
      console.error('Error fetching locations:', error.message);
      throw new HttpException('Failed to fetch locations', 500);
    }
  }

  async getLocationTree(token: string) {
    const locations = await this.fetchEnglishLocations(token);

    const tree: Record<
      string,
      { name: string; zones: Record<string, string[]> }
    > = {};

    locations.forEach(loc => {
      const regionKey = this.normalize(loc.region);
      const zoneKey = this.normalize(loc.zone);
      const woredaKey = this.normalize(loc.woreda);

      if (!tree[regionKey]) {
        tree[regionKey] = {
          name: this.formatDisplay(loc.region),
          zones: {},
        };
      }

      if (!tree[regionKey].zones[zoneKey]) {
        tree[regionKey].zones[zoneKey] = [];
      }

      if (!tree[regionKey].zones[zoneKey].includes(woredaKey)) {
        tree[regionKey].zones[zoneKey].push(
          this.formatDisplay(loc.woreda),
        );
      }
    });

    return tree;
  }

  async getLocationCode(
    region: string,
    zone: string,
    woreda: string,
    token: string,
  ) {
    const locations = await this.fetchEnglishLocations(token);

    const found = locations.find(loc =>
      this.normalize(loc.region) === this.normalize(region) &&
      this.normalize(loc.zone) === this.normalize(zone) &&
      this.normalize(loc.woreda) === this.normalize(woreda),
    );

    if (!found) return null;

    return {
      location_code: found.location_code,
      id: found.id,
    };
  }
}
