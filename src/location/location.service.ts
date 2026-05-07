import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {
  private readonly apiUrl =
    process.env.FARMER_URL ||
    'http://13.50.253.205:3344/api/v1/farmer/getAllInOne';

  private readonly newApiUrl =
    process.env.NEW_LOCATION_API_URL ||
    'http://164.160.187.141:3039/api';

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
  async getLocationTree(
    token: string,
    filters?: {
      region?: string;
      zone?: string;
    },
  ) {
    const locations = await this.fetchEnglishLocations(token);

    const regionFilter = filters?.region
      ? this.normalize(filters.region)
      : null;

    const zoneFilter = filters?.zone
      ? this.normalize(filters.zone)
      : null;

    const tree: Record<
      string,
      { name: string; zones: Record<string, string[]> }
    > = {};

    locations.forEach(loc => {
      const regionKey = this.normalize(loc.region);
      const zoneKey = this.normalize(loc.zone);
      const woredaKey = this.normalize(loc.woreda);

      // 🔹 Apply optional filters
      if (regionFilter && regionKey !== regionFilter) return;
      if (zoneFilter && zoneKey !== zoneFilter) return;

      if (!tree[regionKey]) {
        tree[regionKey] = {
          name: this.formatDisplay(loc.region),
          zones: {},
        };
      }

      if (!tree[regionKey].zones[zoneKey]) {
        tree[regionKey].zones[zoneKey] = [];
      }

      const woredaDisplay = this.formatDisplay(loc.woreda);

      if (!tree[regionKey].zones[zoneKey].includes(woredaDisplay)) {
        tree[regionKey].zones[zoneKey].push(woredaDisplay);
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

  async getLocationsMap(token: string): Promise<Map<string, any>> {
    const locations = await this.fetchEnglishLocations(token);
    const map = new Map();
    locations.forEach(loc => {
      map.set(String(loc.id), {
        region: loc.region,
        zone: loc.zone,
        woreda: loc.woreda,
        location_code: loc.location_code,
      });
    });
    return map;
  }

  async getLocationById(id: string, token: string) {
    const locations = await this.fetchEnglishLocations(token);
    const found = locations.find(loc => String(loc.id) === String(id));
    if (!found) return null;
    return {
      region: found.region,
      zone: found.zone,
      woreda: found.woreda,
      location_code: found.location_code,
    };
  }

  async fetchRegions(token: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.newApiUrl}/regions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching regions:', error.message);
      throw new HttpException('Failed to fetch regions', 500);
    }
  }

  async fetchZones(token: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.newApiUrl}/zones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching zones:', error.message);
      throw new HttpException('Failed to fetch zones', 500);
    }
  }

  async fetchClusters(token: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.newApiUrl}/clusters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching clusters:', error.message);
      throw new HttpException('Failed to fetch clusters', 500);
    }
  }

  async fetchWoredas(token: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.newApiUrl}/woredas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data?.data || response.data;
    } catch (error) {
      console.error('Error fetching woredas:', error.message);
      throw new HttpException('Failed to fetch woredas', 500);
    }
  }

  async getNewLocationTree(token: string) {
    const [regions, zones, woredas] = await Promise.all([
      this.fetchRegions(token),
      this.fetchZones(token),
      this.fetchWoredas(token),
    ]);

    const tree: Record<
      string,
      {
        id: number;
        name: string;
        zones: Record<
          string,
          {
            id: number;
            name: string;
            woredas: { id: number; name: string; cluster_id: number }[];
          }
        >;
      }
    > = {};

    (regions || []).forEach((r) => {
      const rKey = this.normalize(r.name);
      if (!tree[rKey]) {
        tree[rKey] = {
          id: r.id,
          name: this.formatDisplay(r.name),
          zones: {},
        };
      }
    });

    (zones || []).forEach((z) => {
      const parentRegion = (regions || []).find(
        (r) => String(r.id) === String(z.region_id),
      );
      if (parentRegion) {
        const rKey = this.normalize(parentRegion.name);
        const zKey = this.normalize(z.name);
        if (tree[rKey] && !tree[rKey].zones[zKey]) {
          tree[rKey].zones[zKey] = {
            id: z.id,
            name: this.formatDisplay(z.name),
            woredas: [],
          };
        }
      }
    });

    (woredas || []).forEach((w) => {
      const parentZone = (zones || []).find(
        (z) => String(z.id) === String(w.zone_id),
      );
      if (parentZone) {
        const parentRegion = (regions || []).find(
          (r) => String(r.id) === String(parentZone.region_id),
        );
        if (parentRegion) {
          const rKey = this.normalize(parentRegion.name);
          const zKey = this.normalize(parentZone.name);
          const wDisplay = this.formatDisplay(w.name);

          if (tree[rKey] && tree[rKey].zones[zKey]) {
            const exists = tree[rKey].zones[zKey].woredas.find(
              (existing) => existing.name === wDisplay,
            );
            if (!exists) {
              tree[rKey].zones[zKey].woredas.push({
                id: w.id,
                name: wDisplay,
                cluster_id: w.cluster_id,
              });
            }
          }
        }
      }
    });

    return tree;
  }

  async resolveNewLocation(
    regionName: string,
    zoneName: string,
    woredaName: string,
    token: string,
  ) {
    const [regions, zones, woredas] = await Promise.all([
      this.fetchRegions(token),
      this.fetchZones(token),
      this.fetchWoredas(token),
    ]);

    const rNorm = this.normalize(regionName);
    const zNorm = this.normalize(zoneName);
    const wNorm = this.normalize(woredaName);

    const region = (regions || []).find((r) => this.normalize(r.name) === rNorm);
    if (!region) return null;

    const zone = (zones || []).find(
      (z) =>
        this.normalize(z.name) === zNorm &&
        String(z.region_id) === String(region.id),
    );
    if (!zone) return null;

    const woreda = (woredas || []).find(
      (w) =>
        this.normalize(w.name) === wNorm && String(w.zone_id) === String(zone.id),
    );
    if (!woreda) return null;

    return {
      region_id: region.id,
      zone_id: zone.id,
      woreda_id: woreda.id,
      cluster_id: woreda.cluster_id,
      new_location_id: region.id,
    };
  }
}
