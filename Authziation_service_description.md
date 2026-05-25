# Description Complète du Service RBAC (Role-Based Access Control)

## Vue d'ensemble

Le service RBAC est un microservice NestJS dédié à la gestion des autorisations basées sur les rôles dans une plateforme médicale. Il fournit une API REST complète et un serveur gRPC pour l'interopérabilité, permettant de gérer les rôles, permissions, assignments et overrides de permissions de manière flexible et sécurisée.

Le service fonctionne sur le port 3002 pour l'API REST et 3003 pour gRPC, avec une documentation Swagger disponible sur `/api/docs`.

## Fonctionnalités principales

### 1. Gestion des Rôles
- Création, lecture, mise à jour et suppression (soft delete) des rôles
- Support des types de rôles : SYSTEM, HOSPITAL_CUSTOM, DEPARTMENT_CUSTOM
- Gestion des scopes : GLOBAL, HOSPITAL, DEPARTMENT, SERVICE
- Association des permissions aux rôles

### 2. Gestion des Permissions
- CRUD complet sur les permissions système
- Permissions groupées par ressource
- Seed des permissions initiales
- Recherche et filtrage des permissions

### 3. Assignments (Attribution des Rôles)
- Attribution et retrait des rôles aux utilisateurs
- Gestion des permissions temporaires
- Calcul des permissions effectives pour un utilisateur
- Vérification des permissions individuelles

### 4. Permission Overrides
- Création d'overrides pour accorder ou révoquer des permissions spécifiques
- Gestion des périodes d'expiration
- Révocation manuelle des overrides
- Nettoyage automatique des overrides expirés
- Statistiques des overrides

### 5. Audit et Logging
- (Module en développement pour le suivi des actions)

## Modèle de données

Le service utilise PostgreSQL avec TypeORM pour la persistance des données. Les entités principales sont :

### Role
- `id`: UUID primaire
- `name`: Nom unique du rôle
- `code`: Code unique du rôle
- `description`: Description optionnelle
- `roleType`: Enum (SYSTEM, HOSPITAL_CUSTOM, DEPARTMENT_CUSTOM)
- `scopeType`: Enum (GLOBAL, HOSPITAL, DEPARTMENT, SERVICE)
- `scopeId`: UUID de l'entité scope (optionnel)
- `createdBy`: UUID de l'utilisateur créateur
- `isActive`: Statut actif/inactif
- Timestamps: createdAt, updatedAt, deletedAt (soft delete)

### Permission
- `id`: UUID primaire
- `name`: Nom de la permission
- `code`: Code unique de la permission
- `resourceType`: Type de ressource (PATIENT, USER, etc.)
- `action`: Action autorisée (READ, WRITE, etc.)
- `description`: Description
- `isActive`: Statut actif

### RoleAssignment
- `id`: UUID primaire
- `userId`: UUID de l'utilisateur
- `roleId`: UUID du rôle
- `assignedBy`: UUID de l'assignateur
- `assignedAt`: Date d'attribution
- `expiresAt`: Date d'expiration (optionnel)
- `isActive`: Statut actif

### RolePermission
- `id`: UUID primaire
- `roleId`: UUID du rôle
- `permissionId`: UUID de la permission
- `constraints`: Contraintes JSON optionnelles

### PermissionOverride
- `id`: UUID primaire
- `userId`: UUID de l'utilisateur
- `permissionId`: UUID de la permission
- `assignmentId`: UUID de l'assignment (optionnel)
- `overrideType`: Enum (GRANT, REVOKE)
- `reason`: Raison de l'override
- `expiresAt`: Date d'expiration
- `createdBy`: UUID du créateur
- `revokedAt`: Date de révocation (optionnel)
- `revokedBy`: UUID du révoueur (optionnel)

## Endpoints API

### Rôles (`/rbac/roles`)
- `POST /rbac/roles` - Créer un rôle
- `GET /rbac/roles` - Lister les rôles avec filtres
- `GET /rbac/roles/:id` - Obtenir un rôle par ID
- `PUT /rbac/roles/:id` - Mettre à jour un rôle
- `DELETE /rbac/roles/:id` - Supprimer un rôle (soft delete)
- `POST /rbac/roles/:id/permissions/:permissionId` - Ajouter une permission à un rôle
- `DELETE /rbac/roles/:id/permissions/:permissionId` - Retirer une permission d'un rôle
- `POST /rbac/roles/:id/permissions` - Ajouter plusieurs permissions
- `DELETE /rbac/roles/:id/permissions` - Retirer plusieurs permissions

### Permissions (`/rbac/permissions`)
- `POST /rbac/permissions` - Créer une permission
- `GET /rbac/permissions` - Lister les permissions
- `GET /rbac/permissions/:id` - Obtenir une permission par ID
- `PUT /rbac/permissions/:id` - Mettre à jour une permission
- `DELETE /rbac/permissions/:id` - Supprimer une permission
- `POST /rbac/permissions/seed` - Initialiser les permissions système
- `GET /rbac/permissions/resource/:resourceType` - Permissions par ressource
- `GET /rbac/permissions/grouped/by-resource` - Permissions groupées
- `GET /rbac/permissions/role/:roleId` - Permissions d'un rôle

### Assignments (`/rbac/assignments`)
- `POST /rbac/assignments/users/:userId/roles` - Attribuer un rôle
- `DELETE /rbac/assignments/users/:assignmentId/roles` - Retirer un rôle
- `GET /rbac/assignments/users/:userId/roles` - Rôles d'un utilisateur
- `GET /rbac/assignments/me/roles` - Rôles de l'utilisateur connecté
- `GET /rbac/assignments/users/:userId/effective-permissions` - Permissions effectives
- `GET /rbac/assignments/:assignmentId/permissions/codes` - Codes de permissions
- `GET /rbac/assignments/me/effective-permissions` - Permissions effectives (moi)
- `GET /rbac/assignments/:assignmentId/check-permission` - Vérifier une permission
- `POST /rbac/assignments/users/:userId/temporary-permissions` - Permissions temporaires
- `GET /rbac/assignments/users/:userId/permission-overrides` - Overrides d'un utilisateur

### Permission Overrides (`/rbac/permission-overrides`)
- `POST /rbac/permission-overrides` - Créer un override
- `GET /rbac/permission-overrides` - Lister les overrides
- `GET /rbac/permission-overrides/:id` - Obtenir un override par ID
- `PUT /rbac/permission-overrides/:id` - Mettre à jour un override
- `DELETE /rbac/permission-overrides/:id` - Supprimer un override
- `POST /rbac/permission-overrides/:id/revoke` - Révoquer un override
- `GET /rbac/permission-overrides/user/:userId` - Overrides par utilisateur
- `GET /rbac/permission-overrides/assignment/:assignmentId` - Overrides par assignment
- `GET /rbac/permission-overrides/permission/:permissionId` - Overrides par permission
- `POST /rbac/permission-overrides/cleanup/expired` - Nettoyer les expirés
- `GET /rbac/permission-overrides/stats/summary` - Statistiques des overrides

## Mécanismes de sécurité

### Authentification JWT
- Utilise des tokens JWT signés avec RSA-256
- Clé publique chargée depuis un fichier (JWT_PUBLIC_KEY_PATH)
- Extraction du token depuis les headers Authorization (Bearer)
- Validation des tokens et exposition des claims dans `req.user`

### Guards
- `JwtGatewayGuard`: Valide les tokens JWT et enrichit la requête
- `HeaderAuthGuard`: (Présent mais non utilisé dans les contrôleurs actuels)
- Support pour les rôles dans les tokens (role, assignedId, scope, etc.)

### Autorisation
- Les guards de rôles sont commentés mais préparés (@Roles)
- Vérification des permissions basée sur les assignments et overrides
- Support des scopes hiérarchiques (global → hospital → department → service)

## Interopérabilité

### Protocole gRPC
- Serveur gRPC sur port 3003
- Définition dans `src/proto/rbac.proto`
- Méthodes exposées :
  - `CheckPermission`: Vérifie si un utilisateur a une permission
  - `GetUserRoles`: Récupère les rôles d'un utilisateur

### API REST
- API RESTful complète avec Swagger/OpenAPI
- Validation des DTOs avec class-validator
- Transformation automatique avec class-transformer
- Support du Bearer Auth dans Swagger

## Communication

### Base de données
- PostgreSQL avec TypeORM
- Migrations gérées avec TypeORM CLI
- Configuration via variables d'environnement
- Logging optionnel

### Cache Redis
- Redis pour le cache (configuration présente mais utilisation limitée)
- Configuration via variables d'environnement
- Support pour mot de passe et base de données spécifique

### Communication inter-services
- gRPC pour les appels synchrones entre services
- Headers personnalisés pour l'authentification (x-user-id, x-user-email, etc.)
- Intégration avec une bibliothèque partagée (`medical_platform_shared`)

## Technologies utilisées

### Framework
- **NestJS**: Framework Node.js pour applications serveur
- **TypeScript**: Langage de programmation typé

### Base de données et ORM
- **PostgreSQL**: Base de données relationnelle
- **TypeORM**: ORM pour TypeScript

### Authentification et sécurité
- **jsonwebtoken**: Gestion des JWT
- **RSA-256**: Algorithme de signature des tokens

### Communication
- **gRPC**: Framework RPC haute performance
- **@grpc/grpc-js**: Implémentation Node.js de gRPC
- **@grpc/proto-loader**: Chargement des fichiers .proto

### Cache
- **Redis**: Base de données en mémoire
- **@nestjs-modules/ioredis**: Module NestJS pour Redis

### Validation et sérialisation
- **class-validator**: Validation des DTOs
- **class-transformer**: Transformation des objets
- **reflect-metadata**: Métadonnées pour la réflexion

### Documentation
- **@nestjs/swagger**: Génération de documentation OpenAPI/Swagger

### Outils de développement
- **ESLint**: Linting du code
- **Prettier**: Formatage du code
- **Jest**: Framework de tests
- **Supertest**: Tests d'intégration HTTP

## Configuration

### Variables d'environnement
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`: Configuration PostgreSQL
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`: Configuration Redis
- `JWT_PUBLIC_KEY_PATH`: Chemin vers la clé publique JWT
- `GRPC_PORT`: Port du serveur gRPC (défaut: 3003)
- `RBAC_PROTO_PATH`: Chemin vers le fichier .proto

### Scripts npm
- `start:dev`: Démarrage en mode développement avec hot-reload
- `build`: Compilation TypeScript
- `test`: Exécution des tests unitaires
- `test:e2e`: Tests end-to-end
- `typeorm`: Commandes TypeORM (migrations)

## Tests

### Tests unitaires
- Tests pour les services avec Jest
- Mocks pour les dépendances externes
- Couverture de code disponible

### Tests d'intégration (e2e)
- Tests des endpoints API avec Supertest
- Configuration Jest spécifique dans `test/jest-e2e.json`

### Structure des tests
- Tests pour chaque module (roles, permissions, assignments, permission-overrides)
- Tests des contrôleurs et services
- Validation des DTOs et guards

## Architecture

Le service suit l'architecture modulaire de NestJS :
- Modules séparés pour chaque domaine métier
- Injection de dépendances
- Séparation claire entre contrôleurs, services et entités
- DTOs pour la validation et transformation des données
- Guards pour la sécurité
- Intercepteurs et filtres d'exception (non détaillés dans le code actuel)

Ce service fournit une base solide pour la gestion des autorisations dans une architecture de microservices, avec une flexibilité permettant d'adapter les permissions selon les besoins métier spécifiques de la plateforme médicale.