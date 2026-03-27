// recuprer x_ header et les mettre dans req.user

// import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
// import { Request } from 'express';
// import { RequestUser } from '../interfaces/user.interface'

// @Injectable()
// export class HeaderAuthGuard implements CanActivate {
//   canActivate(context: ExecutionContext): boolean {
//     const request = context.switchToHttp().getRequest<Request>();
    
//     // Récupérer le header x-user-id (convertir si tableau)
//     let userId = request.headers['x-user-id'];
//     if (Array.isArray(userId)) userId = userId[0];
//     if (!userId) {
//       throw new UnauthorizedException('User not identified');
//     }

//     // Extraire les autres headers
//     let email = request.headers['x-user-email'];
//     if (Array.isArray(email)) email = email[0];
//     let username = request.headers['x-user-username'];
//     if (Array.isArray(username)) username = username[0];
//     let sessionId = request.headers['x-user-sessionid'];
//     if (Array.isArray(sessionId)) sessionId = sessionId[0];
//     let rolesRaw = request.headers['x-user-roles'];
//     let roles: string[] = [];
//     if (rolesRaw) {
//       try {
//         if (Array.isArray(rolesRaw)) rolesRaw = rolesRaw[0];
//         roles = JSON.parse(rolesRaw);
//       } catch (e) {
//         roles = [];
//       }
//     }

//     // Attacher l'utilisateur à la requête
//     request.user = {
//       id: userId,
//       email: email as string,
//       username: username as string,
//       roles,
//       sessionId: sessionId as string,
//     };

//     return true;
//   }
// }