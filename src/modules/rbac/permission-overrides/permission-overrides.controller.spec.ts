import { Test, TestingModule } from '@nestjs/testing';
import { PermissionOverridesController } from './permission-overrides.controller';

describe('PermissionOverridesController', () => {
  let controller: PermissionOverridesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionOverridesController],
    }).compile();

    controller = module.get<PermissionOverridesController>(PermissionOverridesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
