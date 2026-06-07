import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from '@database/entities/role.entity';
import { Permission } from '@database/entities/permission.entity';
import { RolePermission } from '@database/entities/role-permission.entity';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

// ─── Constants ───────────────────────────────────────────────────────────────
const ROLE_ID       = 'role-001';
const PERMISSION_ID = 'perm-001';
const CREATED_BY    = 'admin-001';

// ─── Mock factories ───────────────────────────────────────────────────────────
const makeRole = (overrides = {}) => ({
  id: ROLE_ID,
  name: 'Médecin',
  code: 'DOCTOR',
  description: 'Rôle médecin',
  roleType: 'SYSTEM',
  scopeType: 'HOSPITAL',
  scopeId: 'hosp-001',
  isActive: true,
  deletedAt: null,
  createdBy: CREATED_BY,
  ...overrides,
});

const makePermission = (overrides = {}) => ({
  id: PERMISSION_ID,
  code: 'PATIENT:READ',
  name: 'Consulter un patient',
  resourceType: 'PATIENT',
  action: 'READ',
  ...overrides,
});

const makeRolePermission = (overrides = {}) => ({
  roleId: ROLE_ID,
  permissionId: PERMISSION_ID,
  isGranted: true,
  constraints: null,
  permission: makePermission(),
  ...overrides,
});

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('RolesService', () => {
  let service: RolesService;

  let roleRepo: Record<string, jest.Mock>;
  let permissionRepo: Record<string, jest.Mock>;
  let rolePermissionRepo: Record<string, jest.Mock>;

  // QueryBuilder mock (needed by findAll)
  let qbMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    qbMock = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    roleRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    permissionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findByIds: jest.fn(),
    };

    rolePermissionRepo = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role),           useValue: roleRepo },
        { provide: getRepositoryToken(Permission),     useValue: permissionRepo },
        { provide: getRepositoryToken(RolePermission), useValue: rolePermissionRepo },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  // ═══════════════════════════════════════════════════════════════
  //  create
  // ═══════════════════════════════════════════════════════════════
  describe('create', () => {
    const createDto = {
      name: 'Médecin',
      code: 'DOCTOR',
      description: 'Rôle médecin',
      roleType: 'SYSTEM',
      scopeType: 'HOSPITAL',
    };

    it('should create and return a new role (without permissions)', async () => {
      roleRepo.findOne
        .mockResolvedValueOnce(null)       // no conflict check
        .mockResolvedValueOnce(makeRole()); // findOne inside findOne() call

      roleRepo.create.mockReturnValue(makeRole());
      roleRepo.save.mockResolvedValue(makeRole());
      rolePermissionRepo.find.mockResolvedValue([]);

      const result = await service.create(createDto as any, CREATED_BY);

      expect(roleRepo.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'DOCTOR', createdBy: CREATED_BY }));
      expect(roleRepo.save).toHaveBeenCalled();
      expect(result.code).toBe('DOCTOR');
    });

    it('should assign permissions to the role when permissionIds are provided', async () => {
      const dto = { ...createDto, permissionIds: [PERMISSION_ID] };

      roleRepo.findOne
        .mockResolvedValueOnce(null)         // conflict check → none
        .mockResolvedValueOnce(makeRole());   // findOne inside findOne()

      roleRepo.create.mockReturnValue(makeRole());
      roleRepo.save.mockResolvedValue(makeRole());
      permissionRepo.find.mockResolvedValue([makePermission()]); // assignPermissions
      rolePermissionRepo.create.mockReturnValue(makeRolePermission());
      rolePermissionRepo.save.mockResolvedValue([makeRolePermission()]);
      rolePermissionRepo.find.mockResolvedValue([makeRolePermission()]);

      const result = await service.create(dto as any, CREATED_BY);

      expect(permissionRepo.find).toHaveBeenCalled();
      expect(rolePermissionRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ConflictException when a role with the same code or name already exists', async () => {
      roleRepo.findOne.mockResolvedValue(makeRole()); // duplicate found

      await expect(service.create(createDto as any, CREATED_BY)).rejects.toThrow(ConflictException);
      expect(roleRepo.save).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  findAll
  // ═══════════════════════════════════════════════════════════════
  describe('findAll', () => {
    it('should return paginated roles enriched with permission count', async () => {
      const roles = [makeRole()];
      qbMock.getManyAndCount.mockResolvedValue([roles, 1]);
      rolePermissionRepo.count.mockResolvedValue(5);

      const result = await service.findAll({ page: 1, limit: 10 } as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].permissionsCount).toBe(5);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it('should apply the search filter when provided', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ search: 'médecin', page: 1, limit: 10 } as any);

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%médecin%' }),
      );
    });

    it('should apply the roleType filter when provided', async () => {
      qbMock.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ roleType: 'SYSTEM', page: 1, limit: 10 } as any);

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'role.roleType = :roleType',
        { roleType: 'SYSTEM' },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  findOne
  // ═══════════════════════════════════════════════════════════════
  describe('findOne', () => {
    it('should return the role with its permissions and count', async () => {
      roleRepo.findOne.mockResolvedValue(makeRole());
      rolePermissionRepo.find.mockResolvedValue([
        makeRolePermission({ isGranted: true }),
        makeRolePermission({ permissionId: 'perm-002', isGranted: false, permission: makePermission({ id: 'perm-002', code: 'PATIENT:DELETE' }) }),
      ]);

      const result = await service.findOne(ROLE_ID);

      expect(result.id).toBe(ROLE_ID);
      expect(result.permissions).toHaveLength(2);
      expect(result.permissionsCount).toBe(1); // only isGranted=true
    });

    it('should throw NotFoundException when role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  update
  // ═══════════════════════════════════════════════════════════════
  describe('update', () => {
    it('should update base fields and return the updated role', async () => {
      const role = makeRole();
      roleRepo.findOne
        .mockResolvedValueOnce(role)         // update lookup
        .mockResolvedValueOnce({ ...role, name: 'Nouveau nom' }); // findOne at the end

      roleRepo.save.mockResolvedValue({ ...role, name: 'Nouveau nom' });
      rolePermissionRepo.find.mockResolvedValue([]);

      const result = await service.update(ROLE_ID, { name: 'Nouveau nom' } as any);

      expect(roleRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Nouveau nom');
    });

    it('should replace permissions when permissionIds are provided', async () => {
      const role = makeRole();
      roleRepo.findOne
        .mockResolvedValueOnce(role)
        .mockResolvedValueOnce(role);

      roleRepo.save.mockResolvedValue(role);
      rolePermissionRepo.delete.mockResolvedValue({ affected: 1 });
      permissionRepo.find.mockResolvedValue([makePermission()]);
      rolePermissionRepo.create.mockReturnValue(makeRolePermission());
      rolePermissionRepo.save.mockResolvedValue([makeRolePermission()]);
      rolePermissionRepo.find.mockResolvedValue([makeRolePermission()]);

      await service.update(ROLE_ID, { permissionIds: [PERMISSION_ID] } as any);

      expect(rolePermissionRepo.delete).toHaveBeenCalledWith({ roleId: ROLE_ID });
      expect(permissionRepo.find).toHaveBeenCalled();
    });

    it('should throw NotFoundException when role to update does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.update('bad-id', { name: 'X' } as any)).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  remove (soft delete)
  // ═══════════════════════════════════════════════════════════════
  describe('remove', () => {
    it('should soft-delete the role by setting deletedAt and isActive=false', async () => {
      const role = makeRole();
      roleRepo.findOne.mockResolvedValue(role);
      roleRepo.save.mockResolvedValue({ ...role, deletedAt: new Date(), isActive: false });

      const result = await service.remove(ROLE_ID);

      const savedArg = roleRepo.save.mock.calls[0][0];
      expect(savedArg.isActive).toBe(false);
      expect(savedArg.deletedAt).toBeInstanceOf(Date);
      expect(result.message).toMatch(/supprimé/i);
    });

    it('should throw NotFoundException when role does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  addPermission
  // ═══════════════════════════════════════════════════════════════
  describe('addPermission', () => {
    it('should create a new role-permission link when it does not already exist', async () => {
      roleRepo.findOne.mockResolvedValue(makeRole());
      rolePermissionRepo.find.mockResolvedValue([]);
      permissionRepo.findOne.mockResolvedValue(makePermission());
      rolePermissionRepo.findOne.mockResolvedValue(null); // no existing link
      rolePermissionRepo.create.mockReturnValue(makeRolePermission());
      rolePermissionRepo.save.mockResolvedValue(makeRolePermission());

      await service.addPermission(ROLE_ID, PERMISSION_ID);

      expect(rolePermissionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ roleId: ROLE_ID, permissionId: PERMISSION_ID, isGranted: true }),
      );
      expect(rolePermissionRepo.save).toHaveBeenCalled();
    });

    it('should update the existing link to isGranted=true when the link already exists', async () => {
      const existingLink = makeRolePermission({ isGranted: false });
      roleRepo.findOne.mockResolvedValue(makeRole());
      rolePermissionRepo.find.mockResolvedValue([]);
      permissionRepo.findOne.mockResolvedValue(makePermission());
      rolePermissionRepo.findOne.mockResolvedValue(existingLink);
      rolePermissionRepo.save.mockResolvedValue({ ...existingLink, isGranted: true });

      await service.addPermission(ROLE_ID, PERMISSION_ID);

      expect(rolePermissionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isGranted: true }),
      );
      expect(rolePermissionRepo.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when permission does not exist', async () => {
      roleRepo.findOne.mockResolvedValue(makeRole());
      rolePermissionRepo.find.mockResolvedValue([]);
      permissionRepo.findOne.mockResolvedValue(null);

      await expect(service.addPermission(ROLE_ID, 'bad-perm')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  removePermission
  // ═══════════════════════════════════════════════════════════════
  describe('removePermission', () => {
    it('should delete the role-permission link', async () => {
      roleRepo.findOne.mockResolvedValue(makeRole());
      rolePermissionRepo.find.mockResolvedValue([makeRolePermission()]);
      rolePermissionRepo.findOne.mockResolvedValue(makeRolePermission());
      rolePermissionRepo.delete.mockResolvedValue({ affected: 1 });

      await service.removePermission(ROLE_ID, PERMISSION_ID);

      expect(rolePermissionRepo.delete).toHaveBeenCalledWith({ roleId: ROLE_ID, permissionId: PERMISSION_ID });
    });

    it('should throw NotFoundException when the permission is not assigned to the role', async () => {
      roleRepo.findOne.mockResolvedValue(makeRole());
      rolePermissionRepo.find.mockResolvedValue([]);
      rolePermissionRepo.findOne.mockResolvedValue(null); // not linked

      await expect(service.removePermission(ROLE_ID, 'bad-perm')).rejects.toThrow(NotFoundException);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  cloneRole
  // ═══════════════════════════════════════════════════════════════
  describe('cloneRole', () => {
    it('should create a new role with the same permissions as the source', async () => {
      const sourceRole = makeRole();
      const clonedRole = makeRole({ id: 'role-002', name: 'Médecin Clone', code: 'DOCTOR_CLONE' });

      // findOne is called twice: once to load source role, once to return the cloned result
      roleRepo.findOne
        .mockResolvedValueOnce(sourceRole)   // cloneRole → findOne(sourceRoleId)
        .mockResolvedValueOnce(clonedRole);  // cloneRole → findOne(savedNewRole.id) at the end

      // rolePermissionRepo.find is called twice:
      //   1st call: findOne(sourceRoleId) → to build permissions list of the source
      //   2nd call: getSourcePermissions to copy into the clone
      //   3rd call: findOne(clonedRoleId) → to build permissions list of the clone
      rolePermissionRepo.find
        .mockResolvedValueOnce([makeRolePermission()])                        // findOne(source) internal
        .mockResolvedValueOnce([makeRolePermission()])                        // source perms for copy
        .mockResolvedValueOnce([makeRolePermission({ roleId: 'role-002' })]); // findOne(clone) internal

      roleRepo.create.mockReturnValue(clonedRole);
      roleRepo.save.mockResolvedValue(clonedRole);
      rolePermissionRepo.create.mockReturnValue(makeRolePermission({ roleId: 'role-002' }));
      rolePermissionRepo.save.mockResolvedValue([makeRolePermission({ roleId: 'role-002' })]);

      await service.cloneRole(ROLE_ID, 'Médecin Clone', 'DOCTOR_CLONE', 'HOSPITAL', 'hosp-002');

      expect(roleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Médecin Clone', code: 'DOCTOR_CLONE' }),
      );
      expect(rolePermissionRepo.save).toHaveBeenCalled();
    });
  });
});
