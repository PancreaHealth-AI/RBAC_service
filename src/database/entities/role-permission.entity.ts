import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { Permission } from './permission.entity';

@Entity('role_permissions')
@Index(['roleId', 'permissionId'], { unique: true })
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId!: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId!: string;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;

  @Column({ name: 'is_granted', default: true })
  isGranted!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  constraints!: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}