CREATE TABLE "peru_departments" (
    "code" CHAR(3) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    CONSTRAINT "peru_departments_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "peru_provinces" (
    "code" CHAR(5) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "departmentCode" CHAR(3) NOT NULL,
    CONSTRAINT "peru_provinces_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "peru_districts" (
    "code" CHAR(7) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provinceCode" CHAR(5) NOT NULL,
    CONSTRAINT "peru_districts_pkey" PRIMARY KEY ("code")
);

ALTER TABLE "sites" ADD COLUMN "districtCode" CHAR(7);

CREATE INDEX "peru_provinces_departmentCode_name_idx" ON "peru_provinces"("departmentCode", "name");
CREATE INDEX "peru_districts_provinceCode_name_idx" ON "peru_districts"("provinceCode", "name");

ALTER TABLE "peru_provinces" ADD CONSTRAINT "peru_provinces_departmentCode_fkey"
  FOREIGN KEY ("departmentCode") REFERENCES "peru_departments"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "peru_districts" ADD CONSTRAINT "peru_districts_provinceCode_fkey"
  FOREIGN KEY ("provinceCode") REFERENCES "peru_provinces"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sites" ADD CONSTRAINT "sites_districtCode_fkey"
  FOREIGN KEY ("districtCode") REFERENCES "peru_districts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
