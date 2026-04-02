import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RolePermission } from './role-permission.entity';

export enum RoleType {
  SYSTEM = 'SYSTEM',
  HOSPITAL_CUSTOM = 'HOSPITAL_CUSTOM',
  DEPARTMENT_CUSTOM = 'DEPARTMENT_CUSTOM',
}

export enum ScopeType {
  GLOBAL = 'GLOBAL',
  HOSPITAL = 'HOSPITAL',
  DEPARTMENT = 'DEPARTMENT',
  SERVICE = 'SERVICE',
}

@Entity('roles')
@Index(['code'])
@Index(['roleType'])
@Index(['scopeType', 'scopeId'])
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  name: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'role_type',
    type: 'enum',
    enum: RoleType,
    default: RoleType.SYSTEM,
  })
  roleType: RoleType;

  @Column({
    name: 'scope_type',
    type: 'enum',
    enum: ScopeType,
    default: ScopeType.GLOBAL,
  })
  scopeType: ScopeType;

  @Column({ name: 'scope_id', type: 'uuid', nullable: true })
  scopeId: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date;

  // Relations seront définies dans les modules respectifs
  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions: RolePermission[];
}