import { Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { UpdateTrainerDto } from './dto/update-trainer.dto';
import { TrainerDAL } from './dal/trainer.dal';
import { FindManyOptions, IsNull } from 'typeorm';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { ConfigService } from '@nestjs/config';
import { Trainer } from './entities/trainer.entity';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Injectable()
export class TrainerService {
  private readonly bucketName: string;
  constructor(private readonly trainerDAL: TrainerDAL,
    private readonly awsS3Service: AwsS3Service,
    private readonly configService: ConfigService,) { this.bucketName = this.configService.getOrThrow<string>('AWS_S3_BUCKET_NAME'); }
  async create(createTrainerDto: CreateTrainerDto, created_by:string,file?: Express.Multer.File) {
    let file_key: string | undefined = undefined;
    if (file) {
      const folder = 'trainers/';
      const uploaded = await this.awsS3Service.uploadFile(file, this.bucketName, folder);
      file_key = uploaded.key;
    }
    const trainer = await this.trainerDAL.create({
      ...createTrainerDto,
      file_key,
      // created_at: new Date(),
      created_by
    });
    return trainer;
  }


  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{ data: Trainer[]; total: number; page: number; limit: number }> {
    try {
      const options: FindManyOptions<Trainer> & {
        search?: { term: string; fields: (keyof Trainer)[] };
        page?: number;
        limit?: number;
      } = {
        order: { created_at: 'DESC' },
        page,
        limit,
      };

      // Optional search support
      if (search && search.trim() !== '') {
        options.search = {
          term: search,
          fields: ['first_name', 'last_name', 'email', 'occupation'],
        };
      }

      const result = await this.trainerDAL.findAll(options);

      return {
        data: result.data,
        total: result.meta.total,
        page: result.meta.page,
        limit: result.meta.limit,
      };
    } catch (error) {
      throw new Error(
        `TrainerService.findAll failed: ${error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findOne(id: string) {
    const trainer = await this.trainerDAL.findById(id);
    if (!trainer || trainer.deleted_at) {
      throw new NotFoundException(`Trainer with id ${id} not found`);
    }
    let file_url: string | null = null;
    if (trainer.file_key) {
      file_url = await this.awsS3Service.getPresignedUrl(
        this.bucketName,
        trainer.file_key,
      );
    }
    return {
      ...trainer,
      file_url,
    };
  }

  async update(
    id: string,
    dto: UpdateTrainerDto,
    updated_by: string,
    file?: Express.Multer.File,
  ) {
    const trainer = await this.trainerDAL.findById(id);
    if (!trainer || trainer.deleted_at) {
      throw new NotFoundException(`Trainer with id ${id} not found`);
    }

    let file_key = trainer.file_key;

    if (file) {
      const folder = 'trainers/';

      // delete the old file if exists
      if (trainer.file_key) {
        try {
          await this.awsS3Service.deleteFile(this.bucketName, trainer.file_key);
        } catch (err) {
          console.warn(`Failed to delete old file: ${trainer.file_key}`, err);
        }
      }

      const uploaded = await this.awsS3Service.uploadFile(file, this.bucketName, folder);
      file_key = uploaded.key;
    }

    await this.trainerDAL.update(id, {
      ...dto,
      file_key,
      updated_by,
      updated_at: new Date(),
    });

    return await this.trainerDAL.findById(id);
  }

  async softDelete(id: string, deleted_by: string) {
    const trainer = await this.trainerDAL.findById(id);
    if (!trainer || trainer.deleted_at) {
      throw new NotFoundException(`Trainer with id ${id} not found`);
    }
    await this.trainerDAL.softDelete(id, 'deleted_at');
    await this.trainerDAL.update(id, { deleted_by, deleted_at: new Date() });
    return { message: 'Trainer soft-deleted successfully', softDeleted: true };
  }
}
