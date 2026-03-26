import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RoleAssignment } from './role-assignment.entity';
import { Permission } from './permission.entity';

export enum OverrideType {
  GRANT = 'GRANT',
  REVOKE = 'REVOKE',
  RESTRICT = 'RESTRICT',
}

@Entity('permission_overrides')
@Index(['roleAssignmentId'])
@Index(['permissionId'])
export class PermissionOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'role_assignment_id', type: 'uuid' })
  roleAssignmentId: string;

  @ManyToOne(() => RoleAssignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_assignment_id' })
  roleAssignment: RoleAssignment;

  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;

  @Column({
    name: 'override_type',
    type: 'enum',
    enum: OverrideType,
  })
  overrideType: OverrideType;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  get isActive(): boolean {
    return !this.isExpired;
  }
}