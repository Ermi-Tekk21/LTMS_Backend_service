import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant } from './entities/participant.entity';
import { FindManyOptions, DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { EventService } from '../event.service';
import { community_type, gender, participant_type } from 'src/common/constants/enums';
import { ZoneService } from '../adress/zoneWoreda.service';
import { LocationService } from 'src/location/location.service';
@Injectable()
export class ParticipantService {
  constructor(private readonly participantDAL: ParticipantDAL,
    private readonly zoneService: ZoneService,
    private readonly eventService: EventService,
    private readonly dataSource: DataSource,
    private readonly locationService: LocationService,
  ) { }

  async create(
    dto: CreateParticipantDto,
    created_by: string,
    eventId: string,
    token: string,
  ): Promise<Participant> {
    if (!eventId) {
      throw new BadRequestException('Event ID is required.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Fetch location_code dynamically from LocationService
      const location = await this.locationService.getLocationCode(
        dto.region,
        dto.zone,
        dto.woreda,
        token,
      );
      if (!location) throw new BadRequestException('Invalid region/zone/woreda');

      // Create participant with location_code
      const participant = await this.participantDAL.create(
        { ...dto, created_by, location_code: location.location_code, location_id: location.id, age: String(dto.age) },
        queryRunner,
      );

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
      { header: 'Region', key: 'region', width: 20 },
      { header: 'Zone', key: 'zone', width: 20 },
      { header: 'Woreda', key: 'woreda', width: 20 },
      { header: 'Kebele', key: 'kebele', width: 20 },
      { header: 'participant_type', key: 'participant_type', width: 20 },
      { header: 'Disability', key: 'disability', width: 20 },
      { header: 'Occupation', key: 'occupation', width: 20 },
      { header: 'Organization', key: 'organization', width: 25 },
      { header: 'Community Type', key: 'community_type', width: 20 },
      { header: 'Literacy Level', key: 'literacy_level', width: 20 },

    ];

    sheet.getRow(1).font = { bold: true };

    const genderValues = Object.values(gender);
    const participantValues = Object.values(participant_type);
    const communityValues = Object.values(community_type);

    // Gender & Community dropdowns
    for (let row = 2; row <= 100; row++) {
      sheet.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${genderValues.join(',')}"`],
      };
      sheet.getCell(`K${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${participantValues.join(',')}"`],
      };
      sheet.getCell(`O${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${communityValues.join(',')}"`],
      };
    }

    const locations = await this.locationService.fetchEnglishLocations(token);

    const regionList = [...new Set(locations.map((l) => l.region))].sort();
    const zoneList = [...new Set(locations.map((l) => l.zone))].sort();
    const woredaList = [...new Set(locations.map((l) => l.woreda))].sort();

    const listsSheet = workbook.addWorksheet('Lists');
    // write header row (optional)
    listsSheet.getCell('A1').value = 'Regions';
    listsSheet.getCell('B1').value = 'Zones';
    listsSheet.getCell('C1').value = 'Woredas';

    // write lists starting from row 2 so header row is preserved
    regionList.forEach((val, idx) => listsSheet.getCell(`A${idx + 2}`).value = val);
    zoneList.forEach((val, idx) => listsSheet.getCell(`B${idx + 2}`).value = val);
    woredaList.forEach((val, idx) => listsSheet.getCell(`C${idx + 2}`).value = val);

    // hide the Lists sheet (veryHidden is supported by Excel; 'hidden' also OK)
    listsSheet.state = 'hidden';

    const regionRange = regionList.length > 0 ? `Lists!$A$2:$A$${regionList.length + 1}` : '';
    const zoneRange = zoneList.length > 0 ? `Lists!$B$2:$B$${zoneList.length + 1}` : '';
    const woredaRange = woredaList.length > 0 ? `Lists!$C$2:$C$${woredaList.length + 1}` : '';

    // Add dropdowns using the vertical ranges (keeps each item on its own line)
    for (let row = 2; row <= 100; row++) {
      if (regionRange) {
        sheet.getCell(`G${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [ `=${regionRange}` ],
        };
      }
      if (zoneRange) {
        sheet.getCell(`H${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [ `=${zoneRange}` ],
        };
      }
      if (woredaRange) {
        sheet.getCell(`I${row}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [ `=${woredaRange}` ],
        };
      }
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
      if (!age) missingFields.push('age');
      if (!gender) missingFields.push('gender');
      if (!phone) missingFields.push('phone');
      if (!region) missingFields.push('region');
      if (!zone) missingFields.push('zone');
      if (!woreda) missingFields.push('woreda');
      if (!kebele) missingFields.push('kebele');
      if (!participant_type) missingFields.push('participant_type')
      if (missingFields.length > 0) {
        invalidRows.push({
          row: rowNumber,
          message: `Missing fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      participants.push({
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
        created_by,
      });
      
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const participantRepo = queryRunner.manager.getRepository(Participant);
      const finalParticipantIds: string[] = [];

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

        const location = await this.locationService.getLocationCode(
          p.region,
          p.zone,
          p.woreda,
          token,
        );

        if (!location) {
          invalidRows.push({
            row: participants.indexOf(p) + 2, 
            message: `Invalid region/zone/woreda: ${p.region} - ${p.zone} - ${p.woreda}`,
          });
          continue;
        }

        const saved = await participantRepo.save({
          ...p,
          age: String(p.age),
          location_code: location.location_code,
          location_id: location.id,
        });

        finalParticipantIds.push(saved.id);
      }

      // Assign to event
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

      if (search && search.trim() !== '') {
        options.search = {
          term: search,
          fields: ['first_name', 'father_name', 'region', 'woreda', 'zone', 'kebele'],
        };
      }
      const result = await this.participantDAL.findAll(options);
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
      throw new InternalServerErrorException(
        `ParticipantService.findAll failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  findOne(id: string) {
    return this.participantDAL.findById(id);
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
      message: 'Participant soft-deleted successfully',
      softDeleted: true,
    };
  }
}
