import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum ResourceType {
  PATIENT = 'PATIENT',
  MEDICAL_RECORD = 'MEDICAL_RECORD',
  ENCOUNTER = 'ENCOUNTER',
  BIOLOGICAL_TEST = 'BIOLOGICAL_TEST',
  MEDICAL_IMAGE = 'MEDICAL_IMAGE',
  DIAGNOSIS = 'DIAGNOSIS',
  TREATMENT = 'TREATMENT',
  PRESCRIPTION = 'PRESCRIPTION',
  AI_MODEL = 'AI_MODEL',
  AI_PREDICTION = 'AI_PREDICTION',
  CONSENT = 'CONSENT',
  USER = 'USER',
  ROLE = 'ROLE',
  HOSPITAL = 'HOSPITAL',
  DEPARTMENT = 'DEPARTMENT',
  SERVICE = 'SERVICE',
}

export enum Action {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXECUTE = 'EXECUTE',
  EXPORT = 'EXPORT',
  SHARE = 'SHARE',
}

export enum PermissionScope {
  SYSTEM = 'SYSTEM',
  HOSPITAL = 'HOSPITAL',
  DEPARTMENT = 'DEPARTMENT',
  SERVICE = 'SERVICE',
  SPECIALTY = 'SPECIALTY',
  SELF = 'SELF',
}

@Entity('permissions')
@Index(['code'])
@Index(['resourceType', 'action'])
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 100 })
  code!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({
    name: 'resource_type',
    type: 'enum',
    enum: ResourceType,
  })
  resourceType!: ResourceType;

  @Column({
    type: 'enum',
    enum: Action,
  })
  action!: Action;

  @Column({
    type: 'enum',
    enum: PermissionScope,
    default: PermissionScope.SYSTEM,
  })
  scope!: PermissionScope;

  @Column({ name: 'requires_consent', default: false })
  requiresConsent!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt!: Date;
}