import { Injectable } from '@nestjs/common';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DeepPartial } from 'typeorm';
import { QueryRunner } from 'typeorm/browser';
import { DocumentDAL } from './dal/document.dal';
import { Document } from './entities/document.entity';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';
import { doc_type } from 'src/common/enums/status_enums';

@Injectable()
export class DocumentService {

  constructor(
    private readonly documentDal: DocumentDAL,
    private readonly awsS3Service: AwsS3Service,
  ) { }

  async create(data: DeepPartial<Document>, queryRunner?: QueryRunner) {
    try {
      return await this.documentDal.create(data, queryRunner)
    } catch (error) {
      throw new Error(`EventDateService.create failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async viewFile(type: doc_type, event_id?: string, trainer_id?: string, event_activity_status_id?: string) {

    const bucket = process.env.AWS_S3_BUCKET_NAME;
    if (!bucket) {
      throw new Error('AWS_S3_BUCKET_NAME is not set in environment');
    }

    let key: string | string[];
    let res: string | string[];

    if (type == doc_type.ATTENDANCE || type == doc_type.FEEDBACK || type == doc_type.MEDIA) {
      const docs = await this.documentDal.findAll({
        where: {
          doc_type: type,
          event: {
            id: event_id
          }
        }
      })

      key = docs.map(d => d.path)
      res = await Promise.all(key.map(k => this.awsS3Service.getPresignedUrl(bucket, k, 5000)));
      return res
    } else if (type == doc_type.PORTFOLIO) {
      const doc = await this.documentDal.findOne({
        where: {
          doc_type: type, // needs to be modified after linking to the trainer table
          event: {
            id: event_id
          }
        }
      })
      key = doc?.path as string
      res = await this.awsS3Service.getPresignedUrl(bucket, key, 5000);
      return res
    } else {

    }

    // res = await this.awsS3Service.getPresignedUrl(bucket, key, 5000);

  }

  findAll() {
    return `This action returns all document`;
  }

  findOne(id: number) {
    return `This action returns a #${id} document`;
  }

  update(id: number, updateDocumentDto: UpdateDocumentDto) {
    return `This action updates a #${id} document`;
  }

  remove(id: number) {
    return `This action removes a #${id} document`;
  }
}
