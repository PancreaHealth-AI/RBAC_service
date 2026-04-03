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
    this.port = this.configService.get<number>('GRPC_PORT', 50051);
  }

  async onModuleInit() {
    await this.start();
  }

  async start() {
    const protoPath = this.configService.get<string>('RBAC_PROTO_PATH', './proto/rbac.proto');
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
    });

    return new Promise<void>((resolve, reject) => {
      this.server.bindAsync(`0.0.0.0:${this.port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
        if (err) {
          this.logger.error(`Failed to bind gRPC server on port ${this.port}: ${err.message}`);
          reject(err);
          return;
        }
        this.logger.log(`gRPC server bound on port ${boundPort}`);
        this.server.start();
        resolve();
      });
    });
  }

  private async checkPermission(call: any, callback: any) {
    const { user_id, permission_code, assignment_id } = call.request;
    console.log(`Received CheckPermission request: user_id=${user_id}, permission_code=${permission_code}`);
    try {
      let hasPermission = false;
      if (assignment_id) {

        hasPermission = await this.assignmentsService.checkPermissionForAssignment(user_id, assignment_id, permission_code);
      } else {

        console.log('Checking permission without assignment_id is not implemented yet');
        // hasPermission = await this.assignmentsService.checkPermission(user_id, permission_code);
      }
      callback(null, { has_permission: hasPermission });
    } catch (err) {
      this.logger.error(err);
      callback(err, null);
    }
  }
}