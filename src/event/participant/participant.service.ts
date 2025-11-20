import { BadRequestException, Injectable ,NotFoundException} from '@nestjs/common';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant } from './entities/participant.entity';
import { FindManyOptions, DataSource} from 'typeorm';
import * as ExcelJS from 'exceljs';
import { EventService } from '../event.service';
import { community_type,gender } from 'src/common/enums/status_enums';
@Injectable()
export class ParticipantService {
  constructor(private readonly participantDAL: ParticipantDAL,
    private readonly eventService: EventService,
     private readonly dataSource: DataSource,
  ) {}

 async create(
  dto: CreateParticipantDto,
  created_by: string,
  eventId: string
): Promise<Participant> {
  if (!eventId) {
    throw new BadRequestException('Event ID is required.');
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    // Create participant
    const participant = await this.participantDAL.create(
      { ...dto, created_by },
      queryRunner,
    );

    // Assign participant to event
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
    throw new BadRequestException(
      `Failed to create participant: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    await queryRunner.release();
  }
}
  async generateTemplate(): Promise<Buffer | ArrayBuffer | Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Participants');

  // Define columns
  sheet.columns = [
    { header: 'First Name', key: 'first_name', width: 20 },
    { header: 'Father Name', key: 'father_name', width: 20 },
    { header: 'Grandfather Name', key: 'grandfather_name', width: 20 },
    { header: 'Gender', key: 'gender', width: 10 },
    { header: 'Age', key: 'age', width: 15 },
    { header: 'Phone', key: 'phone', width: 15 },
    { header: 'Region', key: 'region', width: 20 },
    { header: 'Zone', key: 'zone', width: 20 },
    { header: 'Woreda', key: 'woreda', width: 20 },
    { header: 'Kebele', key: 'kebele', width: 20 },
    { header: 'Disability', key: 'disability', width: 15 },
    { header: 'Occupation', key: 'occupation', width: 20 },
    { header: 'Organization', key: 'organization', width: 25 },
    { header: 'Community Type', key: 'community_type', width: 20 },
    { header: 'Literacy Level', key: 'letracy_level', width: 20 },
  ];

  // Bold header row
  sheet.getRow(1).font = { bold: true };

  // GENDER dropdown → Column 4 → Column letter = D
const genderValues = Object.values(gender); // ['Male','Female']

for (let row = 2; row <= 100; row++) {
  sheet.getCell(`D${row}`).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`"${genderValues.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Invalid Gender',
    error: 'Please select a valid gender from the dropdown.',
  };
}

const communityValues = Object.values(community_type); // ['IDPs','Refugees','HostResident','Returning']

for (let row = 2; row <= 100; row++) {
  sheet.getCell(`N${row}`).dataValidation = {
    type: 'list',
    allowBlank: true,
    formulae: [`"${communityValues.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Invalid Community Type',
    error: 'Please select a valid Community Type from the dropdown.',
  };
}


  return await workbook.xlsx.writeBuffer();
}


 async importFromExcel(
  file: Express.Multer.File,
  eventId: string,
  created_by: string,
): Promise<{ success: boolean; count: number; conflicts: any[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as any);

  const sheet = workbook.getWorksheet('Participants');
  if (!sheet) throw new NotFoundException('Worksheet "Participants" not found.');

  const participants: CreateParticipantDto[] = [];
  const invalidRows: { row: number; missingFields: string[] }[] = [];
  const conflicts: any[] = []; // <-- report mismatched names
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const values = Array.isArray(row.values) ? row.values : [];
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
      disability,     
      occupation,
      organization,
      community_type,
      letracy_level,
      
    ] = values.slice(1) as any[];

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

    if (missingFields.length > 0) {
      invalidRows.push({ row: rowNumber, missingFields });
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
      created_by,
    });
  });

  if (invalidRows.length > 0) {
    const errorMessage = invalidRows
      .map((r) => `Row ${r.row}: missing ${r.missingFields.join(', ')}`)
      .join('\n');
    throw new BadRequestException(errorMessage);
  }

  if (participants.length === 0) {
    throw new BadRequestException('No valid participant rows found in the file.');
  }

  // Transaction
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const participantRepo = queryRunner.manager.getRepository(Participant);
    const finalParticipantIds: string[] = [];

    // Deduplication logic (by phone)
    for (const p of participants) {
      const existing = await participantRepo.findOne({ where: { phone: p.phone } });

      if (existing) {
        // Check for name mismatch
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

          console.warn(
            `Name mismatch for phone ${p.phone}. Using existing participant ${existing.id}.`,
          );
        }

        finalParticipantIds.push(existing.id);
        continue;
      }
      const saved = await participantRepo.save(p);
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
      success: true,
      count: finalParticipantIds.length,
      conflicts, // <-- return ignored Excel names
    };
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw new BadRequestException(
      `Failed to import participants: ${
        err instanceof Error ? err.message : String(err)
      }`,
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
        fields: ['first_name', 'father_name', 'region','woreda','kebele'], 
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
    throw new Error(
      `ParticipantService.findAll failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
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
  if (!existing ) {
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
