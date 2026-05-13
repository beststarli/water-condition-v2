-- CreateTable
CREATE TABLE "data" (
    "data_id" UUID NOT NULL,
    "data_name" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "data_style" TEXT NOT NULL,
    "data_extent" DOUBLE PRECISION[],
    "data_identifier" TEXT NOT NULL,
    "data_file_path" TEXT NOT NULL,
    "model_type" TEXT NOT NULL,
    "data_visualization" TEXT[],
    "status" TEXT NOT NULL,
    "update_time" TEXT NOT NULL,
    "create_time" TEXT NOT NULL,

    CONSTRAINT "data_pkey" PRIMARY KEY ("data_id")
);

-- CreateTable
CREATE TABLE "dataset" (
    "dataset_id" UUID NOT NULL,
    "dataset_name" TEXT NOT NULL,
    "dataset_identifier" TEXT NOT NULL,
    "dataset_folder_path" TEXT NOT NULL,
    "dataset_type" TEXT NOT NULL,
    "model_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "update_time" TEXT NOT NULL,
    "create_time" TEXT NOT NULL,

    CONSTRAINT "dataset_pkey" PRIMARY KEY ("dataset_id")
);

-- CreateTable
CREATE TABLE "dataset_data" (
    "dataset_data_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "data_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "update_time" TEXT NOT NULL,
    "create_time" TEXT NOT NULL,

    CONSTRAINT "dataset_data_pkey" PRIMARY KEY ("dataset_data_id")
);

-- CreateTable
CREATE TABLE "model" (
    "model_id" UUID NOT NULL,
    "model_dataset_id" TEXT NOT NULL,
    "model_pid" INTEGER NOT NULL,
    "model_progress" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "update_time" TEXT NOT NULL,
    "create_time" TEXT NOT NULL,

    CONSTRAINT "model_pkey" PRIMARY KEY ("model_id")
);

-- CreateTable
CREATE TABLE "project" (
    "project_id" UUID NOT NULL,
    "project_name" TEXT NOT NULL,
    "project_extent" DOUBLE PRECISION[],
    "project_identifier" TEXT NOT NULL,
    "project_folder_path" TEXT NOT NULL,
    "model_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "update_time" TEXT NOT NULL,
    "create_time" TEXT NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "project_dataset" (
    "project_dataset_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "update_time" TEXT NOT NULL,
    "create_time" TEXT NOT NULL,

    CONSTRAINT "project_dataset_pkey" PRIMARY KEY ("project_dataset_id")
);

-- CreateTable
CREATE TABLE "case" (
  "case_id" UUID NOT NULL,
  "case_name" TEXT NOT NULL,
  "area_bounds" DOUBLE PRECISION[] NOT NULL,
  CONSTRAINT "case_pkey" PRIMARY KEY ("case_id")
);

-- CreateIndex
CREATE INDEX "project_model_type_index" ON "project"("model_type");

-- CreateIndex
CREATE UNIQUE INDEX "data_id" ON "dataset_data"("data_id");

-- CreateIndex
CREATE INDEX "dataset_id_index" ON "dataset_data"("dataset_id");

-- CreateIndex
CREATE UNIQUE INDEX "dataset_id" ON "project_dataset"("dataset_id");

-- CreateIndex
CREATE INDEX "project_id_index" ON "project_dataset"("project_id");


