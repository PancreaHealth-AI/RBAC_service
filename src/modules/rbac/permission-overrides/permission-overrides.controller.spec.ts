import { Test, TestingModule } from '@nestjs/testing';
import { PermissionOverridesController } from './permission-overrides.controller';
import { PermissionOverridesService } from './permission-overrides.service';

describe('PermissionOverridesController', () => {
  let controller: PermissionOverridesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionOverridesController],
      providers: [
        {
          provide: PermissionOverridesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            revoke: jest.fn(),
            getUserOverrides: jest.fn(),
            getAssignmentOverrides: jest.fn(),
            getPermissionOverrides: jest.fn(),
            cleanExpiredOverrides: jest.fn(),
            getStatistics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PermissionOverridesController>(PermissionOverridesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
