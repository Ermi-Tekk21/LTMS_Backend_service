import { BadRequestException, Injectable ,NotFoundException} from '@nestjs/common';
import { ParticipantDAL } from 'src/event/participant/dal/participant.dal';
import { CreateParticipantDto } from './dto/create-participant.dto';
import { UpdateParticipantDto } from './dto/update-participant.dto';
import { Participant } from './entities/participant.entity';
import { FindManyOptions, IsNull, DataSource} from 'typeorm';
import * as ExcelJS from 'exceljs';
import { EventService } from '../event.service';
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

    sheet.columns = [
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Last Name', key: 'last_name', width: 20 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Occupation', key: 'occupation', width: 20 },
      { header: 'Organization', key: 'organization', width: 25 },
      { header: 'Community Type', key: 'community_type', width: 20 },
      { header: 'Letracy Level', key: 'letracy_level', width: 20 },
      { header: 'Region', key: 'region', width: 20 },
      { header: 'Woreda', key: 'woreda', width: 20 },
      { header: 'Kebele', key: 'kebele', width: 20 },
    ];
    return await workbook.xlsx.writeBuffer();
  }

 async importFromExcel(
  file: Express.Multer.File,
  eventId: string,
  created_by: string,
): Promise<{ success: boolean; count: number }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer as any);

  const sheet = workbook.getWorksheet('Participants');
  if (!sheet) throw new NotFoundException('Worksheet "Participants" not found.');

  const participants: CreateParticipantDto[] = [];
  const invalidRows: { row: number; missingFields: string[] }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const values = Array.isArray(row.values) ? row.values : [];
    const [
      first_name,
      last_name,
      gender,
      phone,
      occupation,
      organization,
      community_type,
      letracy_level,
      region,
      woreda,
      kebele,
    ] = values.slice(1) as any[];

    const missingFields: string[] = [];
    if (!first_name) missingFields.push('first_name');
    if (!last_name) missingFields.push('last_name');
    if (!gender) missingFields.push('gender');
    if (!phone) missingFields.push('phone');
    if (!region) missingFields.push('region');

    if (missingFields.length > 0) {
      invalidRows.push({ row: rowNumber, missingFields });
      return;
    }

    participants.push({
      first_name,
      last_name,
      gender,
      phone,
      occupation,
      organization,
      community_type,
      letracy_level,
      region,
      woreda,
      kebele,
      created_by,
    });
  });

  if (invalidRows.length > 0) {
    const errorMessage = `File contains rows with missing required fields:\n${invalidRows
      .map((r) => `Row ${r.row}: missing ${r.missingFields.join(', ')}`)
      .join('\n')}`;
    throw new BadRequestException(errorMessage);
  }

  if (participants.length === 0) {
    throw new BadRequestException('No valid participant rows found in the file.');
  }

  //  Save participants into DB
  const participantRepo = this.dataSource.getRepository(Participant);
  const savedParticipants = await participantRepo.save(participants);

  //  Assign saved participants to event
  const participantIds = savedParticipants.map((p) => p.id);
  if (participantIds.length > 0) {
    await this.eventService.assignParticipantsToEvent(eventId, participantIds);
  }

  return {
    success: true,
    count: savedParticipants.length,
  };
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
      where: { deleted_at: IsNull() },
      order: { created_at: 'DESC' },
      page,
      limit,
    };

    if (search && search.trim() !== '') {
      options.search = {
        term: search,
        fields: ['first_name', 'last_name', 'region','woreda','kebele'], 
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
