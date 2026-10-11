import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class InitialSchema1791644900501 implements MigrationInterface {
  name = 'InitialSchema1791644900501';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'REVIEWER', 'SALES')`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "passwordHash" character varying(255) NOT NULL, "fullName" character varying(120) NOT NULL, "role" "public"."users_role_enum" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('APPLICATION_CREATED', 'APPLICATION_UPDATED', 'APPLICATION_SUBMITTED', 'REVIEWER_ASSIGNED', 'RISK_REVIEW_COMPLETED', 'REVIEW_DECISION_RECORDED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorId" uuid, "actorRole" character varying(20), "action" "public"."audit_logs_action_enum" NOT NULL, "entityType" character varying(40) NOT NULL, "entityId" uuid NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2dc33f7f3c22e2e7badafca1d1" ON "audit_logs" ("actorId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c69efb19bf127c97e6740ad530" ON "audit_logs" ("createdAt") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_13c69424c440a0e765053feb4b" ON "audit_logs" ("entityType", "entityId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."merchant_applications_businesstype_enum" AS ENUM('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLC', 'CORPORATION', 'NON_PROFIT')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."merchant_applications_status_enum" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."merchant_applications_riskstatus_enum" AS ENUM('NOT_STARTED', 'PENDING', 'PASSED', 'FAILED', 'MANUAL_REVIEW')`,
    );
    await queryRunner.query(
      `CREATE TABLE "merchant_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "businessName" character varying(160) NOT NULL, "legalBusinessName" character varying(200) NOT NULL, "businessType" "public"."merchant_applications_businesstype_enum" NOT NULL, "ownerFullName" character varying(120) NOT NULL, "ownerEmail" character varying(255) NOT NULL, "ownerPhone" character varying(32) NOT NULL, "ownerTaxId" text, "addressLine1" character varying(160) NOT NULL, "city" character varying(80) NOT NULL, "state" character varying(80) NOT NULL, "postalCode" character varying(16) NOT NULL, "country" character(2) NOT NULL, "requestedMonthlyVolume" numeric(14,2) NOT NULL, "averageTicketSize" numeric(12,2) NOT NULL, "currency" character(3) NOT NULL, "mcc" character(4) NOT NULL, "status" "public"."merchant_applications_status_enum" NOT NULL DEFAULT 'DRAFT', "riskStatus" "public"."merchant_applications_riskstatus_enum" NOT NULL DEFAULT 'NOT_STARTED', "riskScore" integer, "riskReference" character varying(64), "riskReason" text, "riskCheckedAt" TIMESTAMP WITH TIME ZONE, "createdById" uuid NOT NULL, "assignedReviewerId" uuid, "decisionReason" text, "decidedAt" TIMESTAMP WITH TIME ZONE, "submittedAt" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT 1, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_09b9df0877db73b8a232c8c7ed4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f9b444dd14c28c317a317eddac" ON "merchant_applications" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7eaffe0b47c39ed3fd0f17aa66" ON "merchant_applications" ("riskStatus") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_524da5b7f60bec9e2c86797f58" ON "merchant_applications" ("createdById") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7cebc08ee446c36158cbd584a0" ON "merchant_applications" ("assignedReviewerId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "FK_524da5b7f60bec9e2c86797f58c" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "FK_7cebc08ee446c36158cbd584a0a" FOREIGN KEY ("assignedReviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "FK_7cebc08ee446c36158cbd584a0a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" DROP CONSTRAINT "FK_524da5b7f60bec9e2c86797f58c"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_7cebc08ee446c36158cbd584a0"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_524da5b7f60bec9e2c86797f58"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_7eaffe0b47c39ed3fd0f17aa66"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f9b444dd14c28c317a317eddac"`);
    await queryRunner.query(`DROP TABLE "merchant_applications"`);
    await queryRunner.query(`DROP TYPE "public"."merchant_applications_riskstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."merchant_applications_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."merchant_applications_businesstype_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_13c69424c440a0e765053feb4b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c69efb19bf127c97e6740ad530"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_2dc33f7f3c22e2e7badafca1d1"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
