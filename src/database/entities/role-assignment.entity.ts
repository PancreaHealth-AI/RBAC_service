import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role, ScopeType } from './role.entity';

@Entity('role_assignments')
@Index(['userId'])
@Index(['roleId'])
@Index(['scopeType', 'scopeId'])
export class RoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({
    name: 'scope_type',
    type: 'enum',
    enum: ScopeType,
    default: ScopeType.GLOBAL,
  })
  scopeType: ScopeType;

  @Column({ name: 'scope_id', type: 'uuid', nullable: true })
  scopeId: string;

  @Column({ name: 'assigned_by', type: 'uuid', nullable: true })
  assignedBy: string;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  get isValid(): boolean {
    return this.isActive && !this.isExpired;
  }
}