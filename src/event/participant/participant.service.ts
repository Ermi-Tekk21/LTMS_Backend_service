import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant } from './entities/participant.entity';
import { FindManyOptions, DataSource, FindOptionsWhere } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { EventService } from '../event.service';
import { community_type, gender, participant_type } from 'src/common/constants/enums';
import { LocationService } from 'src/location/location.service';
import { ClusterService } from 'src/external/cluster.service';
@Injectable()

export class ParticipantService {
  constructor(
    private readonly participantDAL: ParticipantDAL,
    private readonly eventService: EventService,
    private readonly dataSource: DataSource,
    private readonly locationService: LocationService,
    private readonly clusterService: ClusterService,
  ) { }

  async create(
    dto: CreateParticipantDto,
    created_by: string,
    eventId: string,
    token: string,
  ): Promise<Participant> {
    if (!dto) {
      throw new BadRequestException('Participant data is required.');
    }
    if (!eventId) {
      throw new BadRequestException('Event ID is required.');
    }



    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const participantRepo = queryRunner.manager.getRepository(Participant);
      let existing = await participantRepo.findOne({
        where: [
          { phone: dto.phone },
          { external_participant_id: dto.external_participant_id }
        ].filter(condition => condition.phone || condition.external_participant_id),

      });


      let participant: Participant;

      if (existing) {
        // 2. If soft-deleted, restore
        if (existing.deleted_at) {
          await participantRepo.restore(existing.id);
          existing.deleted_at = null;
        }

        participant = existing;
      } else {
        // 4. Create participant with new location IDs
        participant = participantRepo.create({
          ...dto,
          created_by,
          location_code: null,
          location_id: null,
        });
        participant = await participantRepo.save(participant);
      }

      // 5. Assign to event
      await this.eventService.assignParticipantsToEvent(
        eventId,
        [participant.id],
        queryRunner,
      );

      await queryRunner.commitTransaction();
      await this.eventService.updateEventStatusIfReady(eventId);
      return participant;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.log(error);
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException(`Failed to create participant: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async generateTemplate(token: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Participants');

    sheet.columns = [
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Father Name', key: 'father_name', width: 20 },
      { header: 'Grandfather Name', key: 'grandfather_name', width: 20 },
      { header: 'Gender', key: 'gender', width: 15 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Cluster', key: 'cluster', width: 20 },
      { header: 'Region', key: 'region', width: 20 },
      { header: 'Zone', key: 'zone', width: 20 },
      { header: 'Woreda', key: 'woreda', width: 20 },
      { header: 'Kebele', key: 'kebele', width: 20 },
      { header: 'Participant Type', key: 'participant_type', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };

    const requiredKeys = [
      'first_name',
      'father_name',
      'gender',
      'phone',
      'region',
      'zone',
      'woreda',
      'participant_type',
      'cluster',
    ];

    sheet.getRow(1).eachCell((cell, colNumber) => {
      const column = sheet.getColumn(colNumber);
      if (column.key && requiredKeys.includes(column.key as string)) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '00FF00' },
        };
      }
    });

    const locationTree = await this.locationService.getNewLocationTree(token);
    const hierarchy: Record<string, Record<string, string[]>> = {};
    const regionList: string[] = [];

    Object.values(locationTree).forEach((region) => {
      const regionStats: Record<string, number> = {};
      // Region stats are omitted because region field is no longer stored directly.
      // If needed, enrich participants with location hierarchy elsewhere.

      const regionName = region.name;
      if (!hierarchy[regionName]) {
        hierarchy[regionName] = {};
        regionList.push(regionName);
      }
      Object.values(region.zones).forEach((zone) => {
        const zoneName = zone.name;
        if (!hierarchy[regionName][zoneName]) {
          hierarchy[regionName][zoneName] = [];
        }
        zone.woredas.forEach((woreda) => {
          if (!hierarchy[regionName][zoneName].includes(woreda.name)) {
            hierarchy[regionName][zoneName].push(woreda.name);
          }
        });
      });
    });
    regionList.sort();

    const metaSheetName = 'Metadata_Internal';
    const metaSheet = workbook.addWorksheet(metaSheetName, { state: 'hidden' });

    // 0. Clusters Named Range
    const clusters = await this.locationService.fetchClusters(token);
    const clusterNames = (clusters || []).map((c) => c.name).filter(Boolean).sort();
    metaSheet.getColumn(1).values = ['Clusters', ...clusterNames];
    workbook.definedNames.add(`'${metaSheetName}'!$A$2:$A$${clusterNames.length + 1}`, 'ClusterList');

    // 1. Regions Named Range
    metaSheet.getColumn(2).values = ['Regions', ...regionList];
    workbook.definedNames.add(`'${metaSheetName}'!$B$2:$B$${regionList.length + 1}`, 'RegionList');

    let colIndex = 3; // Start from Column C

    // 2. Zones Named Ranges (Per Region)
    // Using Prefix 'R_' to avoid collisions between Region names and Zone names
    regionList.forEach((region) => {
      const zoneNames = Object.keys(hierarchy[region]).sort();
      const col = this.getColumnLetter(colIndex);
      metaSheet.getColumn(colIndex).values = [region, ...zoneNames];
      workbook.definedNames.add(
        `'${metaSheetName}'!$${col}$2:$${col}$${zoneNames.length + 1}`,
        'R_' + this.sanitize(region),
      );
      colIndex++;
    });

    // 3. Woredas Named Ranges (Per Zone)
    // Using Prefix 'Z_' + SanitizedRegion to avoid collisions between identical zone names in different regions
    regionList.forEach((region) => {
      const zoneNames = Object.keys(hierarchy[region]).sort();
      const sanitizedRegion = this.sanitize(region);
      zoneNames.forEach((zone) => {
        const sanitizedZone = this.sanitize(zone);
        // Combine region and zone to ensure uniqueness across regions
        const uniqueZoneKey = sanitizedRegion + '_' + sanitizedZone;

        const woredaNames = hierarchy[region][zone].sort();
        const col = this.getColumnLetter(colIndex);
        metaSheet.getColumn(colIndex).values = [zone, ...woredaNames];
        workbook.definedNames.add(
          `'${metaSheetName}'!$${col}$2:$${col}$${woredaNames.length + 1}`,
          'Z_' + uniqueZoneKey,
        );
        colIndex++;
      });
    });

    const genderValues = Object.values(gender);
    const participantValues = Object.values(participant_type);
    const communityValues = Object.values(community_type);

    for (let row = 2; row <= 100; row++) {
      // Gender (D)
      sheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${genderValues.join(',')}"`],
      };
      // Cluster (G)
      sheet.getCell(`G${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=ClusterList'],
      };
      // Region (H)
      sheet.getCell(`H${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['=RegionList'],
      };
      // Zone (I) - Dependent on Region (H)
      sheet.getCell(`I${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=INDIRECT("R_" & SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(H${row}," ","_"),"-","_"),"/","_"),"'","_"))`],
      };
      // Woreda (J) - Dependent on Zone (I)
      sheet.getCell(`J${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=INDIRECT("Z_" & SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(H${row}," ","_"),"-","_"),"/","_"),"'","_") & "_" & SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(I${row}," ","_"),"-","_"),"/","_"),"'","_"))`],
      };
      // Participant Type (L)
      sheet.getCell(`L${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${participantValues.join(',')}"`],
      };
      // Community Type (O)
      sheet.getCell(`O${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${communityValues.join(',')}"`],
      };
    }

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
  async importFromExcel(
    file: Express.Multer.File,
    eventId: string,
    created_by: string,
    token: string,
  ): Promise<{
    success: boolean;
    count: number;
    conflicts: any[];
    invalidRows: { row: number; message: string }[];
  }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as any);

    const sheet = workbook.getWorksheet('Participants');
    if (!sheet) throw new NotFoundException('Worksheet "Participants" not found.');

    const participants: any[] = [];
    const invalidRows: { row: number; message: string }[] = [];
    const conflicts: any[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const values = Array.isArray(row.values) ? row.values.slice(1) : [];

      // Skip completely empty rows
      if (values.every(v => v === undefined || v === null || v === '')) return;

      const [
        first_name,
        father_name,
        Grandfather_name,
        gender,
        age,
        phone,
        cluster_name,
        region,
        zone,
        woreda,
        kebele,
        participant_type,
        disability,
        occupation,
        organization,
        community_type,
        letracy_level,
      ] = values as any[];

      const missingFields: string[] = [];
      if (!first_name) missingFields.push('first_name');
      if (!father_name) missingFields.push('father_name');
      if (!gender) missingFields.push('gender');
      if (!phone) missingFields.push('phone');
      if (!region) missingFields.push('region');
      if (!zone) missingFields.push('zone');
      if (!woreda) missingFields.push('woreda');
      if (!participant_type) missingFields.push('participant_type')
      if (missingFields.length > 0) {
        invalidRows.push({
          row: rowNumber,
          message: `Missing fields: ${missingFields.join(', ')}`,
        });
        return;
      }
      participants.push({
        rowNumber,
        first_name,
        father_name,
        Grandfather_name,
        gender,
        age,
        disability,
        phone,
        occupation,
        organization,
        community_type,
        letracy_level,
        region,
        zone,
        woreda,
        kebele,
        participant_type,
        cluster_name,
        created_by,
      });

    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const participantRepo = queryRunner.manager.getRepository(Participant);
      const finalParticipantIds: string[] = [];
      const clusters = await this.locationService.fetchClusters(token);

      // Fetch new hierarchical locations for Newlocation_id resolution
      const [newRegions, newZones, newWoredas] = await Promise.all([
        this.locationService.fetchRegions(token),
        this.locationService.fetchZones(token),
        this.locationService.fetchWoredas(token),
      ]);

      for (const p of participants) {
        const existing = await participantRepo.findOne({ where: { phone: p.phone } });

        if (existing) {
          const mismatch =
            existing.first_name !== p.first_name ||
            existing.father_name !== p.father_name ||
            existing.Grandfather_name !== p.Grandfather_name;

          if (mismatch) {
            conflicts.push({
              phone: p.phone,
              existingName: {
                first_name: existing.first_name,
                father_name: existing.father_name,
                Grandfather_name: existing.Grandfather_name,
              },
              ignoredExcelName: {
                first_name: p.first_name,
                father_name: p.father_name,
                Grandfather_name: p.Grandfather_name,
              },
              message: 'Excel name ignored; existing participant reused.',
            });
          }

          finalParticipantIds.push(existing.id);
          continue;
        }

        // Resolution for Newlocation_id
        const resolved = await this.locationService.resolveNewLocation(p.region, p.zone, p.woreda, token);
        const newLocationId = resolved?.woreda_id || null;

        if (!newLocationId) {
          invalidRows.push({
            row: p.rowNumber,
            message: `Invalid location data (Region: ${p.region}, Zone: ${p.zone}, Woreda: ${p.woreda}). Please correct and try again.`,
          });
          continue;
        }

        const foundCluster = clusters.find((c) => c.name === p.cluster_name);
        if (p.cluster_name && !foundCluster) {
          invalidRows.push({
            row: p.rowNumber,
            message: `Invalid cluster: ${p.cluster_name}. Please select from dropdown.`,
          });
          continue;
        }

        const saved = await participantRepo.save({
          ...p,
          age: p.age ? String(p.age) : null,
          location_code: null,
          location_id: null,
          Newlocation_id: newLocationId,
          clusterId: foundCluster ? String(foundCluster.id) : null,
          region: undefined,
          zone: undefined,
          woreda: undefined,
        });

        finalParticipantIds.push(saved.id);
      }

      if (finalParticipantIds.length > 0) {
        await this.eventService.assignParticipantsToEvent(
          eventId,
          finalParticipantIds,
          queryRunner,
        );
      }

      await queryRunner.commitTransaction();
      await this.eventService.updateEventStatusIfReady(eventId);

      return {
        success: finalParticipantIds.length > 0,
        count: finalParticipantIds.length,
        conflicts,
        invalidRows,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        `Failed to import Excel: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await queryRunner.release();
    }
  }


  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    clusterId?: number,
    token?: string,
  ): Promise<{ data: Participant[]; total: number; page: number; limit: number }> {
    try {
      const options: FindManyOptions<Participant> & {
        search?: { term: string; fields: (keyof Participant)[] };
        page?: number;
        limit?: number;
      } = {
        order: { created_at: 'DESC' },
        page,
        limit,
      };


      // ✅ Filter by clusterId (column-based)
      if (clusterId) {
        options.where = { clusterId: clusterId.toString() };
      }

      // ✅ Search still works
      if (search && search.trim() !== '') {
        options.search = {
          term: search,
          fields: [
            'first_name',
            'father_name',
            'kebele',
          ],
        };
      }

      const result = await this.participantDAL.findAll(options);

      // Dynamic Enrichment
      if (token && result.data.length > 0) {
        const woredasWithParents = await this.locationService.fetchWoredasWithParents(token);
        const lookup = new Map(woredasWithParents.map(w => [String(w.woreda_id), w]));

        result.data = result.data.map(p => {
          if (p.Newlocation_id && lookup.has(String(p.Newlocation_id))) {
            const loc = lookup.get(String(p.Newlocation_id));
            (p as any).region = loc.region_name;
            (p as any).zone = loc.zone_name;
            (p as any).woreda = loc.woreda_name;
            (p as any).cluster = loc.cluster_name;
          }
          return p;
        });
      }

      return {
        data: result.data,
        total: result.meta.total,
        page: result.meta.page,
        limit: result.meta.limit,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      console.error('ParticipantService.findAll failed:', error);

      throw new InternalServerErrorException(
        'An unexpected error occurred while retrieving participants.',
      );
    }
  }

  async findOne(id: string, token?: string) {
    const p = await this.participantDAL.findById(id);
    if (p && token && p.Newlocation_id) {
      try {
        const loc = await this.locationService.getLocationHierarchy(p.Newlocation_id, token);
        if (loc) {
          (p as any).region = loc.region;
          (p as any).zone = loc.zone;
          (p as any).woreda = loc.woreda;
          (p as any).cluster = loc.cluster_name;
        }
      } catch (error) {
        console.error(`Failed to enrich participant ${id} with location details:`, error.message);
      }
    }
    return p;
  }
  update(id: string, dto: UpdateParticipantDto, updated_by: string) {
    return this.participantDAL.update(id, {
      ...dto,
      updated_by,
      updated_at: new Date(),
    });
  }

  async remove(id: string) {
    const existing = await this.participantDAL.findById(id);
    if (!existing) {
      throw new NotFoundException(`Participant with id ${id} not found.`);
    }
    await this.participantDAL.delete(id);
    return { message: 'user deleted successfully' };
  }

  async softDelete(id: string, deleted_by: string) {
    const existing = await this.participantDAL.findById(id);
    if (!existing) {
      throw new NotFoundException(`Participant with id ${id} not found.`);
    }

    await this.participantDAL.update(id, {
      deleted_by,
      deleted_at: new Date(),
    });
    return {
      message: 'Participant deleted successfully',
      softDeleted: true,
    };
  }

  private getColumnLetter(n: number): string {
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - m) / 26);
    }
    return s;
  }

  private sanitize(text: string): string {
    return text.replace(/[ \-\/']/g, '_');
  }

  private formatDisplay(value: string): string {
    return value
      ?.trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
