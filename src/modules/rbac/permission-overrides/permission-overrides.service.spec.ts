import { Test, TestingModule } from '@nestjs/testing';
import { PermissionOverridesService } from './permission-overrides.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PermissionOverride } from '@database/entities/permission-override.entity';
import { RoleAssignment } from '@database/entities/role-assignment.entity';
import { Permission } from '@database/entities/permission.entity';

describe('PermissionOverridesService', () => {
  let service: PermissionOverridesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionOverridesService,
        {
          provide: getRepositoryToken(PermissionOverride),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RoleAssignment),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Permission),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PermissionOverridesService>(PermissionOverridesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
