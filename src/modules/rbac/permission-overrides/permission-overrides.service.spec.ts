import { Test, TestingModule } from '@nestjs/testing';
import { PermissionOverridesService } from './permission-overrides.service';

describe('PermissionOverridesService', () => {
  let service: PermissionOverridesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionOverridesService],
    }).compile();

    service = module.get<PermissionOverridesService>(PermissionOverridesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
