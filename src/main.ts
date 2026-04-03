import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { RbacGrpcServer } from 'grpc/rbac-grpc.server';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // 🔥 obligatoire
    }),
  );
  // const grpcServer = app.get(RbacGrpcServer);
  // await grpcServer.onModuleInit();
  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('RBAC Service API')
    .setDescription('API pour l\'ABAC ')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 👉 Endpoint JSON pour l'API Gateway
  app.use('/api-json', (req, res) => {
    res.json(document);
  });


  await app.listen(3002);

  console.log(`
    🚀 Authentication Service is running!
    📝 API: http://localhost:3002/api/v1
    📚 Swagger: http://localhost:3002/api/docs
  `);
}
bootstrap();
