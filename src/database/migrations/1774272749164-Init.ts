import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1774272749164 implements MigrationInterface {
    name = 'Init1774272749164'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."roles_role_type_enum" AS ENUM('SYSTEM', 'HOSPITAL_CUSTOM', 'DEPARTMENT_CUSTOM')`);
        await queryRunner.query(`CREATE TYPE "public"."roles_scope_type_enum" AS ENUM('GLOBAL', 'HOSPITAL', 'DEPARTMENT', 'SERVICE')`);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "code" character varying(50) NOT NULL, "description" text, "role_type" "public"."roles_role_type_enum" NOT NULL DEFAULT 'SYSTEM', "scope_type" "public"."roles_scope_type_enum" NOT NULL DEFAULT 'GLOBAL', "scope_id" uuid, "created_by" uuid, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "UQ_f6d54f95c31b73fb1bdd8e91d0c" UNIQUE ("code"), CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d56fe002be9b1d95fe393b7975" ON "roles" ("scope_type", "scope_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_c32357cb156abd270a6fd9abec" ON "roles" ("role_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6d54f95c31b73fb1bdd8e91d0" ON "roles" ("code") `);
        await queryRunner.query(`CREATE TYPE "public"."permissions_resource_type_enum" AS ENUM('PATIENT', 'MEDICAL_RECORD', 'ENCOUNTER', 'BIOLOGICAL_TEST', 'MEDICAL_IMAGE', 'DIAGNOSIS', 'TREATMENT', 'PRESCRIPTION', 'AI_MODEL', 'AI_PREDICTION', 'CONSENT', 'USER', 'ROLE', 'HOSPITAL', 'DEPARTMENT', 'SERVICE')`);
        await queryRunner.query(`CREATE TYPE "public"."permissions_action_enum" AS ENUM('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXECUTE', 'EXPORT', 'SHARE')`);
        await queryRunner.query(`CREATE TYPE "public"."permissions_scope_enum" AS ENUM('SYSTEM', 'HOSPITAL', 'DEPARTMENT', 'SERVICE', 'SPECIALTY', 'SELF')`);
        await queryRunner.query(`CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(100) NOT NULL, "name" character varying(255) NOT NULL, "resource_type" "public"."permissions_resource_type_enum" NOT NULL, "action" "public"."permissions_action_enum" NOT NULL, "scope" "public"."permissions_scope_enum" NOT NULL DEFAULT 'SYSTEM', "requires_consent" boolean NOT NULL DEFAULT false, "description" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "created_by" uuid, "deleted_at" TIMESTAMP, CONSTRAINT "UQ_8dad765629e83229da6feda1c1d" UNIQUE ("code"), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_040b46a6900f0619cc4a0e4cda" ON "permissions" ("resource_type", "action") `);
        await queryRunner.query(`CREATE INDEX "IDX_8dad765629e83229da6feda1c1" ON "permissions" ("code") `);
        await queryRunner.query(`CREATE TABLE "role_permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role_id" uuid NOT NULL, "permission_id" uuid NOT NULL, "is_granted" boolean NOT NULL DEFAULT true, "constraints" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_84059017c90bfcb701b8fa42297" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_25d24010f53bb80b78e412c965" ON "role_permissions" ("role_id", "permission_id") `);
        await queryRunner.query(`CREATE TYPE "public"."role_assignments_scope_type_enum" AS ENUM('GLOBAL', 'HOSPITAL', 'DEPARTMENT', 'SERVICE')`);
        await queryRunner.query(`CREATE TABLE "role_assignments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "role_id" uuid NOT NULL, "scope_type" "public"."role_assignments_scope_type_enum" NOT NULL DEFAULT 'GLOBAL', "scope_id" uuid, "assigned_by" uuid, "assigned_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP, "is_active" boolean NOT NULL DEFAULT true, "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fc2df9835ac1d2a34839f113783" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_40ab5b26d33013f57a4d7e4361" ON "role_assignments" ("scope_type", "scope_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_a0268fc16c3777758f7683a440" ON "role_assignments" ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d91c8ac0c10fd8c6acdcc5ee94" ON "role_assignments" ("user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."permission_overrides_override_type_enum" AS ENUM('GRANT', 'REVOKE', 'RESTRICT')`);
        await queryRunner.query(`CREATE TABLE "permission_overrides" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "role_assignment_id" uuid NOT NULL, "permission_id" uuid NOT NULL, "override_type" "public"."permission_overrides_override_type_enum" NOT NULL, "reason" text, "approved_by" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP, CONSTRAINT "PK_a0aea7c2062c150d4895d6958d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a4e1349fdf809150e1a5ad2566" ON "permission_overrides" ("permission_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_081bdee5d5bc6ff77f0ee8ec84" ON "permission_overrides" ("role_assignment_id") `);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_assignments" ADD CONSTRAINT "FK_a0268fc16c3777758f7683a4401" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "permission_overrides" ADD CONSTRAINT "FK_081bdee5d5bc6ff77f0ee8ec840" FOREIGN KEY ("role_assignment_id") REFERENCES "role_assignments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "permission_overrides" ADD CONSTRAINT "FK_a4e1349fdf809150e1a5ad2566f" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "permission_overrides" DROP CONSTRAINT "FK_a4e1349fdf809150e1a5ad2566f"`);
        await queryRunner.query(`ALTER TABLE "permission_overrides" DROP CONSTRAINT "FK_081bdee5d5bc6ff77f0ee8ec840"`);
        await queryRunner.query(`ALTER TABLE "role_assignments" DROP CONSTRAINT "FK_a0268fc16c3777758f7683a4401"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"`);
        await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_081bdee5d5bc6ff77f0ee8ec84"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a4e1349fdf809150e1a5ad2566"`);
        await queryRunner.query(`DROP TABLE "permission_overrides"`);
        await queryRunner.query(`DROP TYPE "public"."permission_overrides_override_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d91c8ac0c10fd8c6acdcc5ee94"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a0268fc16c3777758f7683a440"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_40ab5b26d33013f57a4d7e4361"`);
        await queryRunner.query(`DROP TABLE "role_assignments"`);
        await queryRunner.query(`DROP TYPE "public"."role_assignments_scope_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_25d24010f53bb80b78e412c965"`);
        await queryRunner.query(`DROP TABLE "role_permissions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8dad765629e83229da6feda1c1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_040b46a6900f0619cc4a0e4cda"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
        await queryRunner.query(`DROP TYPE "public"."permissions_scope_enum"`);
        await queryRunner.query(`DROP TYPE "public"."permissions_action_enum"`);
        await queryRunner.query(`DROP TYPE "public"."permissions_resource_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6d54f95c31b73fb1bdd8e91d0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c32357cb156abd270a6fd9abec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d56fe002be9b1d95fe393b7975"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP TYPE "public"."roles_scope_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."roles_role_type_enum"`);
    }

}
