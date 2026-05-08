import { Injectable, HttpException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {

  private readonly newApiUrl =
    process.env.NEW_LOCATION_API_URL ||
    'http://164.160.187.141:3039/api';

  private cache: Record<string, { data: any; expiry: number }> = {};
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

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



  async fetchRegions(token: string): Promise<any[]> {
    const cacheKey = 'regions';
    const cached = this.cache[cacheKey];
    if (cached && cached.expiry > Date.now()) return cached.data;

    try {
      const response = await axios.get(`${this.newApiUrl}/regions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data?.data || response.data;
      this.cache[cacheKey] = { data, expiry: Date.now() + this.CACHE_TTL };
      return data;
    } catch (error) {
      console.error('Error fetching regions:', error.message);
      throw new HttpException('Failed to fetch regions', 500);
    }
  }

  async fetchZones(token: string): Promise<any[]> {
    const cacheKey = 'zones';
    const cached = this.cache[cacheKey];
    if (cached && cached.expiry > Date.now()) return cached.data;

    try {
      const response = await axios.get(`${this.newApiUrl}/zones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data?.data || response.data;
      this.cache[cacheKey] = { data, expiry: Date.now() + this.CACHE_TTL };
      return data;
    } catch (error) {
      console.error('Error fetching zones:', error.message);
      throw new HttpException('Failed to fetch zones', 500);
    }
  }

  async fetchWoredas(token: string): Promise<any[]> {
    const cacheKey = 'woredas';
    const cached = this.cache[cacheKey];
    if (cached && cached.expiry > Date.now()) return cached.data;

    try {
      const response = await axios.get(`${this.newApiUrl}/woredas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data?.data || response.data;
      this.cache[cacheKey] = { data, expiry: Date.now() + this.CACHE_TTL };
      return data;
    } catch (error) {
      console.error('Error fetching woredas:', error.message);
      throw new HttpException('Failed to fetch woredas', 500);
    }
  }

  async fetchClusters(token: string): Promise<any[]> {
    const cacheKey = 'clusters';
    const cached = this.cache[cacheKey];
    if (cached && cached.expiry > Date.now()) return cached.data;

    try {
      const response = await axios.get(`${this.newApiUrl}/clusters`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data?.data || response.data;
      this.cache[cacheKey] = { data, expiry: Date.now() + this.CACHE_TTL };
      return data;
    } catch (error) {
      console.error('Error fetching clusters:', error.message);
      throw new HttpException('Failed to fetch clusters', 500);
    }
  }





  async fetchWoredasWithParents(token: string): Promise<any[]> {
    const cacheKey = 'woredas_with_parents';
    const cached = this.cache[cacheKey];
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    try {
      const response = await axios.get(`${this.newApiUrl}/woredas/with-parents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = response.data?.data || response.data;
      
      this.cache[cacheKey] = {
        data,
        expiry: Date.now() + this.CACHE_TTL,
      };
      
      return data;
    } catch (error) {
      console.error('Error fetching woredas with parents:', error.message);
      throw new HttpException('Failed to fetch woredas with parents', 500);
    }
  }

  async getNewLocationTree(token: string, options?: { region?: string; zone?: string }) {
    const [regions, zones, woredas] = await Promise.all([
      this.fetchRegions(token),
      this.fetchZones(token),
      this.fetchWoredas(token),
    ]);

    const tree: Record<
      string,
      {
        id: string;
        name: string;
        zones: Record<
          string,
          {
            id: string;
            name: string;
            woredas: { id: string; name: string; cluster_id: string }[];
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
    const woredasWithParents = await this.fetchWoredasWithParents(token);

    const rNorm = this.normalize(regionName);
    const zNorm = this.normalize(zoneName);
    const wNorm = this.normalize(woredaName);

    const found = (woredasWithParents || []).find(
      (w) =>
        this.normalize(w.region_name) === rNorm &&
        this.normalize(w.zone_name) === zNorm &&
        this.normalize(w.woreda_name) === wNorm,
    );

    if (!found) return null;

    return {
      region_id: found.region_id,
      zone_id: found.zone_id,
      woreda_id: found.woreda_id,
      cluster_id: found.cluster_id,
      new_location_id: found.woreda_id,
    };
  }

  async getNewLocationsMap(token: string) {
    const [regions, zones, woredas] = await Promise.all([
      this.fetchRegions(token),
      this.fetchZones(token),
      this.fetchWoredas(token),
    ]);

    const regionsMap = new Map((regions || []).map(r => [String(r.id), r.name]));
    const zonesMap = new Map((zones || []).map(z => [String(z.id), z.name]));
    const woredasMap = new Map((woredas || []).map(w => [String(w.id), w.name]));
    return { regionsMap, zonesMap, woredasMap };
  }

  // Backward compatibility wrapper
  // Backward compatibility wrapper for legacy code expecting a single Map
  async getLocationsMap(token: string) {
    const woredasWithParents = await this.fetchWoredasWithParents(token);
    return new Map(woredasWithParents.map(w => [
      String(w.woreda_id),
      {
        region: this.formatDisplay(w.region_name),
        zone: this.formatDisplay(w.zone_name),
        woreda: this.formatDisplay(w.woreda_name),
      }
    ]));
  }




  async getLocationById(id: string, token: string) {
    return this.getLocationHierarchy(id, token);
  }

  async getLocationHierarchy(woredaId: string, token: string) {
    const woredasWithParents = await this.fetchWoredasWithParents(token);

    const found = (woredasWithParents || []).find(
      (w) => String(w.woreda_id) === String(woredaId),
    );

    if (!found) return null;

    return {
      region: this.formatDisplay(found.region_name),
      zone: this.formatDisplay(found.zone_name),
      woreda: this.formatDisplay(found.woreda_name),
      cluster_name: this.formatDisplay(found.cluster_name),
      region_id: found.region_id,
      zone_id: found.zone_id,
      woreda_id: found.woreda_id,
      cluster_id: found.cluster_id,
    };
  }
}
