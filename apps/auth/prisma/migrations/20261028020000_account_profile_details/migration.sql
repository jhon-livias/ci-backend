CREATE TYPE "ProfileGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED');

ALTER TABLE "user_profiles" ADD COLUMN "gender" "ProfileGender";
ALTER TABLE "user_profiles" ADD COLUMN "birthDate" DATE;
ALTER TABLE "user_profiles" ADD COLUMN "maritalStatus" "MaritalStatus";
ALTER TABLE "user_profiles" ADD COLUMN "personalEmail" VARCHAR(254);
ALTER TABLE "user_profiles" ADD COLUMN "address" VARCHAR(240);
