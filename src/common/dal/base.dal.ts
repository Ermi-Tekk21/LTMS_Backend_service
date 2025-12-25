import {
  DeepPartial,
  Repository,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  QueryRunner,
  ObjectLiteral,
  Brackets,
} from 'typeorm';

/**
 * BaseDAL<T> — A generic base Data Access Layer class
 * 
 * Features:
 * - Reusable CRUD methods (create, find, update, delete)
 * - Supports transactions via QueryRunner
 * - Supports pagination
 * - Works with any TypeORM Entity
 */

export abstract class BaseDAL<T extends ObjectLiteral> {
  protected readonly repo: Repository<T>;

  constructor(repo: Repository<T>) {
    this.repo = repo;
  }

  async create(data: DeepPartial<T>, queryRunner?: QueryRunner): Promise<T> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      const entity = repository.create(data);
      return await repository.save(entity);
    } catch (error) {
      throw new Error(
        `DAL.create failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createMany(data: DeepPartial<T>[], queryRunner?: QueryRunner): Promise<T[]> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      const entities = repository.create(data);
      return await repository.save(entities);
    } catch (error) {
      throw new Error(
        `DAL.createMany failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async findAll(
    options?: FindManyOptions<T> & {
      search?: { term: string; fields: (keyof T)[] };
      page?: number;
      limit?: number;
    },
    queryRunner?: QueryRunner,
  ): Promise<{ data: T[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      const alias = 'entity';
      const qb = repository.createQueryBuilder(alias);

      // Relations - support nested relations with '.' separation, arbitrary depth
      if (options?.relations) {
        const joinedAliases = new Set<string>();
        (options.relations as string[]).forEach(relation => {
          if (relation.includes('.')) {
            const parts = relation.split('.');
            let currentAlias = alias;
            for (let i = 0; i < parts.length; i++) {
              const nextAlias = parts.slice(0, i + 1).join('_');
              const joinPath = i === 0 ? `${alias}.${parts[i]}` : `${currentAlias}.${parts[i]}`;
              if (!joinedAliases.has(nextAlias)) {
                qb.leftJoinAndSelect(joinPath, nextAlias);
                joinedAliases.add(nextAlias);
              }
              currentAlias = nextAlias;
            }
          } else {
            // Direct relation
            if (!joinedAliases.has(relation)) {
              qb.leftJoinAndSelect(`${alias}.${relation}`, relation);
            }
          }
        });
      }

      // Where clauses from options
      if (options?.where) {
        const where = options.where as Record<string, any>;
        for (const [key, value] of Object.entries(where)) {
          if (value && typeof value === 'object' && (value as any)._type === 'between') {
            qb.andWhere(`${alias}.${key} >= :${key}_start AND ${alias}.${key} <= :${key}_end`, {
              [`${key}_start`]: (value as any)._value[0],
              [`${key}_end`]: (value as any)._value[1],
            });
          } else if (typeof value === 'object' && value !== null && !('_type' in value)) {
            // Handle nested relation filtering if the relation is loaded
            if (options.relations && Array.isArray(options.relations) && options.relations.includes(key)) {
              for (const subKey in value) {
                qb.andWhere(`${key}.${subKey} = :${key}_${subKey}`, { [`${key}_${subKey}`]: value[subKey] });
              }
            } else {
              throw new Error(`Unsupported nested or complex where clause for key '${key}'. Ensure the relation '${key}' is included in the relations array.`);
            }
          } else {
            qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
          }
        }
      }

      // 🔍 Search logic
      if (options?.search?.term && options.search.fields.length) {
        const { term, fields } = options.search;
        qb.andWhere(
          new Brackets((qbWhere) => {
            fields.forEach((field, i) => {
              const param = `term${i}`;
              qbWhere.orWhere(`LOWER(${alias}.${String(field)}) LIKE LOWER(:${param})`, {
                [param]: `%${term}%`,
              });
            });
          }),
        );
      }

      // Pagination setup
      const page = options?.page && options.page > 0 ? options.page : 1;
      const limit = options?.limit && options.limit > 0 ? options.limit : 10;
      const skip = (page - 1) * limit;

      // Sorting logic (simplified)
      if (options?.order) {
        const order = options.order as Record<string, string>;
        Object.entries(order).forEach(([key, value]) => {
          const direction = (value || '').toString().trim().toUpperCase();
          if (direction === 'ASC' || direction === 'DESC') {
            qb.addOrderBy(`${alias}.${key}`, direction as 'ASC' | 'DESC');
          } else {
            console.warn(`⚠️ Invalid order direction for "${key}": "${value}" — skipping`);
          }
        });
      }

      // Execute with pagination and count
      const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

      // Return structured response
      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(
        `DAL.findAll failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }


  async findOne(
    options: FindOneOptions<T>,
    queryRunner?: QueryRunner,
  ): Promise<T | null> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      if (!options?.where) {
        const finalOptions: FindOneOptions<T> = { ...options };
        return await repository.findOne(finalOptions);
      }

      const whereObj: any = options.where as any;

      // Detect nested/complex where that targets relations (object values)
      const hasNested = Object.values(whereObj).some(v => typeof v === 'object' && v !== null);

      if (!options?.relations && !hasNested) {
        const finalOptions: FindOneOptions<T> = {
          ...options,
          where: { ...(options?.where) },
        };
        return await repository.findOne(finalOptions);
      }

      // For relation-heavy or nested-where queries, build queryBuilder explicitly
      const alias = 'entity';
      const qb = repository.createQueryBuilder(alias);

      // Relations - support nested relations with '.' separation, arbitrary depth
      const joinedAliases = new Set<string>();
      if (options?.relations) {
        (options.relations as string[]).forEach(relation => {
          if (relation.includes('.')) {
            const parts = relation.split('.');
            let currentAlias = alias;
            for (let i = 0; i < parts.length; i++) {
              const nextAlias = parts.slice(0, i + 1).join('_');
              const joinPath = i === 0 ? `${alias}.${parts[i]}` : `${currentAlias}.${parts[i]}`;
              if (!joinedAliases.has(nextAlias)) {
                qb.leftJoinAndSelect(joinPath, nextAlias);
                joinedAliases.add(nextAlias);
              }
              currentAlias = nextAlias;
            }
          } else {
            if (!joinedAliases.has(relation)) {
              qb.leftJoinAndSelect(`${alias}.${relation}`, relation);
              joinedAliases.add(relation);
            }
          }
        });
      }

      // Apply where clauses (best-effort mapping for nested relation objects)
      for (const [key, value] of Object.entries(whereObj)) {
        if (value && typeof value === 'object' && (value as any)._type === 'between') {
          qb.andWhere(`${alias}.${key} >= :${key}_start AND ${alias}.${key} <= :${key}_end`, {
            [`${key}_start`]: (value as any)._value[0],
            [`${key}_end`]: (value as any)._value[1],
          });
        } else if (typeof value === 'object' && value !== null && !('_type' in value)) {
          // relation object filtering
          if ('id' in value && Object.keys(value).length === 1) {
            if (!joinedAliases.has(key)) {
              qb.leftJoin(`${alias}.${key}`, key);
              joinedAliases.add(key);
            }
            qb.andWhere(`${key}.id = :${key}_id`, { [`${key}_id`]: value.id });
          } else {
            // nested object with multiple fields — join and apply subfield filters
            if (!joinedAliases.has(key)) {
              qb.leftJoin(`${alias}.${key}`, key);
              joinedAliases.add(key);
            }
            for (const subKey in value) {
              qb.andWhere(`${key}.${subKey} = :${key}_${subKey}`, { [`${key}_${subKey}`]: value[subKey] });
            }
          }
        } else {
          qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
        }
      }

      const entity = await qb.getOne();
      return entity;
    } catch (error) {
      // Include some debug context for intermittent issues
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`DAL.findOne failed: ${msg}`);
    }
  }

  async findById(id: any, queryRunner?: QueryRunner): Promise<T | null> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      return await repository.findOne({
        where: { id } as FindOptionsWhere<T>,
      });
    } catch (error) {
      throw new Error(
        `DAL.findById failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async findByEmail(email: string, queryRunner?: QueryRunner): Promise<T | null> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      return await repository.findOne({
        where: { email } as unknown as FindOptionsWhere<T>,
      });
    } catch (error) {
      throw new Error(`DAL.findByEmail failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async update(id: any, data: DeepPartial<T>, queryRunner?: QueryRunner): Promise<T | null> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      await repository.update(id, data as any);
      return await repository.findOne({ where: { id } as FindOptionsWhere<T> });
    } catch (error) {
      throw new Error(`DAL.update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async delete(id: any, queryRunner?: QueryRunner): Promise<void> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      await repository.delete(id);
    } catch (error) {
      throw new Error(`DAL.delete failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async softDelete(
    id: any,
    extraFields: Partial<T> = {},
    softField: keyof T = 'deleted_at' as keyof T,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      await repository.update(id, {
        [softField]: new Date(),
        ...extraFields,
      } as any);
    } catch (error) {
      throw new Error(
        `DAL.softDelete failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }


  async restore(
    id: any,
    softField: keyof T = 'deleted_at' as keyof T,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      await repository.update(id, { [softField]: null } as any);
    } catch (error) {
      throw new Error(`DAL.restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async query(query: string, parameters?: any[], queryRunner?: QueryRunner): Promise<any> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      return await repository.query(query, parameters);
    } catch (error) {
      throw new Error(`DAL.query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async runInTransaction<R>(
    queryRunner: QueryRunner,
    fn: (qr: QueryRunner) => Promise<R>,
  ): Promise<R> {
    await queryRunner.startTransaction();
    try {
      const result = await fn(queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async count(options?: FindManyOptions<T>, queryRunner?: QueryRunner): Promise<number> {
    try {
      const repository = queryRunner
        ? queryRunner.manager.getRepository(this.repo.target)
        : this.repo;

      // Check if we need to use queryBuilder (for relations or complex where)
      const hasRelations = options?.relations && (options.relations as string[]).length > 0;
      const hasComplexWhere = options?.where && typeof options.where === 'object' && Object.keys(options.where).some(key =>
        typeof (options.where as any)[key] === 'object' && (options.where as any)[key] !== null && key !== 'deleted_at'
      );

      if (hasRelations || hasComplexWhere) {
        // Use queryBuilder for complex counts
        const alias = 'entity';
        const qb = repository.createQueryBuilder(alias);
        const joinedAliases = new Set<string>();

        // Soft delete filter
        qb.where(`${alias}.deleted_at IS NULL`);

        // Relations
        if (options?.relations) {
          (options.relations as string[]).forEach(relation => {
            if (relation.includes('.')) {
              const parts = relation.split('.');
              let currentAlias = alias;
              for (let i = 0; i < parts.length; i++) {
                const nextAlias = i === parts.length - 1 ? parts[i] : `${currentAlias}_${parts[i]}`;
                const joinPath = i === 0 ? `${alias}.${parts[i]}` : `${currentAlias}.${parts[i]}`;
                if (!joinedAliases.has(nextAlias)) {
                  qb.leftJoin(joinPath, nextAlias);
                  joinedAliases.add(nextAlias);
                }
                currentAlias = nextAlias;
              }
            } else {
              if (!joinedAliases.has(relation)) {
                qb.leftJoin(`${alias}.${relation}`, relation);
                joinedAliases.add(relation);
              }
            }
          });
        }

        // Where clauses - recursive function for deep relations
        if (options?.where) {
          const applyWhere = (qb: any, alias: string, whereObj: any, joinedAliases: Set<string>) => {
            for (const [key, value] of Object.entries(whereObj)) {
              if (key === 'deleted_at') continue; // Already handled
              if (value && typeof value === 'object' && (value as any)._type === 'between') {
                qb.andWhere(`${alias}.${key} >= :${key}_start AND ${alias}.${key} <= :${key}_end`, {
                  [`${key}_start`]: (value as any)._value[0],
                  [`${key}_end`]: (value as any)._value[1],
                });
              } else if (typeof value === 'object' && value !== null && !('_type' in value)) {
                if ('id' in value && Object.keys(value).length === 1) {
                  // Foreign Key relation
                  if (!joinedAliases.has(key)) {
                    qb.leftJoin(`${alias}.${key}`, key);
                    joinedAliases.add(key);
                  }
                  qb.andWhere(`${key}.id = :${key}_id`, { [`${key}_id`]: value.id });
                } else if (Object.values(value).some(v => typeof v === 'object' && v !== null)) {
                  // Contains nested relations
                  if (!joinedAliases.has(key)) {
                    qb.leftJoin(`${alias}.${key}`, key);
                    joinedAliases.add(key);
                  }
                  applyWhere(qb, key, value, joinedAliases);
                } else {
                  // Assume JSON column sub-fields
                  for (const subKey in value) {
                    qb.andWhere(`${alias}.${key} ->> '${subKey}' = :${key}_${subKey}`, { [`${key}_${subKey}`]: value[subKey] });
                  }
                }
              } else {
                qb.andWhere(`${alias}.${key} = :${key}`, { [key]: value });
              }
            }
          };
          applyWhere(qb, alias, options.where as any, joinedAliases);
        }

        return await qb.getCount();
      } else {
        // Simple count without relations or complex where
        const where = { ...(options?.where as any), deleted_at: null } as FindOptionsWhere<T>;
        return await repository.count({ where });
      }
    } catch (error) {
      throw new Error(
        `DAL.count failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
