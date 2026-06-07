import { Test, TestingModule } from '@nestjs/testing';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

describe('AssignmentsController', () => {
  let controller: AssignmentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssignmentsController],
      providers: [
        {
          provide: AssignmentsService,
          useValue: {
            assignRole: jest.fn(),
            removeRole: jest.fn(),
            updateAssignment: jest.fn(),
            getUserRoles: jest.fn(),
            getEffectivePermissionsByRole: jest.fn(),
            getPermissionCodesForAssignment: jest.fn(),
            checkPermissionForAssignment: jest.fn(),
            addPermissionOverride: jest.fn(),
            grantTemporaryPermission: jest.fn(),
            getUserOverrides: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AssignmentsController>(AssignmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
