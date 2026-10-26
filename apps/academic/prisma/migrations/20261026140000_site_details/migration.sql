ALTER TABLE "sites"
  ADD COLUMN "department" VARCHAR(100),
  ADD COLUMN "province" VARCHAR(100),
  ADD COLUMN "district" VARCHAR(100),
  ADD COLUMN "street" VARCHAR(255),
  ADD COLUMN "postalCode" VARCHAR(10),
  ADD COLUMN "phone" VARCHAR(30),
  ADD COLUMN "email" VARCHAR(254),
  ADD COLUMN "contactName" VARCHAR(100),
  ADD COLUMN "contactPhone" VARCHAR(30);
