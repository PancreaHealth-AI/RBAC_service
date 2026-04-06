import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { AssignmentsService } from '../modules/rbac/assignments/assignments.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Injectable()
export class RbacGrpcServer implements OnModuleInit {
  private server: grpc.Server;
  private readonly logger = new Logger(RbacGrpcServer.name);
  private port: number;

  constructor(
    private assignmentsService: AssignmentsService,
    private configService: ConfigService,
  ) {
    this.port = this.configService.get<number>('GRPC_PORT', 3003);
  }

  async onModuleInit() {
    await this.start();
  }

  async start() {
    const protoPath = this.configService.get<string>(
      'RBAC_PROTO_PATH',
      './src/proto/rbac.proto',
    );

    if (!fs.existsSync(protoPath)) {
      this.logger.error(`Proto file not found at ${protoPath}`);
      return;
    }

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const rbacProto = grpc.loadPackageDefinition(packageDefinition).rbac as any;

    this.server = new grpc.Server();
    this.server.addService(rbacProto.RBACService.service, {
      CheckPermission: this.checkPermission.bind(this),
      GetUserRoles: this.getUserRoles.bind(this),
    });

    return new Promise<void>((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${this.port}`,
        grpc.ServerCredentials.createInsecure(),
        (err, boundPort) => {
          if (err) {
            this.logger.error(`Failed to bind gRPC server: ${err.message}`);
            reject(err);
            return;
          }
          this.logger.log(`gRPC server bound on port ${boundPort}`);
          resolve();
        },
      );
    });
  }

  private async checkPermission(call: any, callback: any) {
    const { user_id, permission_code, assignment_id } = call.request;
    try {
      let hasPermission = false;
      if (assignment_id) {
        hasPermission =
          await this.assignmentsService.checkPermissionForAssignment(
            user_id,
            assignment_id,
            permission_code,
          );
      }
      console.log(`cote server grpc : User ${user_id} has permission ${permission_code}:`, hasPermission);
      callback(null, { has_permission: hasPermission });
    } catch (err) {
      this.logger.error(err);
      callback(err, null);
    }
  }

  private async getUserRoles(call: any, callback: any) {
    const { user_id } = call.request;
    try {
      const roles = await this.assignmentsService.getUserRoles(user_id);
      const mapped = roles.map((r) => ({
        assignment_id: r.id,
        role_id: r.roleId,
        role_name: r.roleName,
        role_code: r.roleCode,
        role_type: r.roleType,
        scope_type: r.scopeType ?? '',
        scope_id: r.scopeId ?? '',
      }));
      console.log(`cote server grpc : User ${user_id} has roles:`, mapped);
      callback(null, { roles: mapped });
    } catch (err) {
      this.logger.error(err);
      callback(err, null);
    }
  }
}