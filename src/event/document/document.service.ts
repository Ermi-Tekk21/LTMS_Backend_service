import { Injectable } from '@nestjs/common';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DeepPartial } from 'typeorm';
import { QueryRunner } from 'typeorm/browser';
import { DocumentDAL } from './dal/document.dal';
import { Document } from './entities/document.entity';
import { AwsS3Service } from 'src/common/aws-s3/aws-s3.service';

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

  findAll() {
    return `This action returns all document`;
  }

  viewDoc(key: string) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME!;
    return this.awsS3Service.getPresignedUrl(bucketName, key)
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
