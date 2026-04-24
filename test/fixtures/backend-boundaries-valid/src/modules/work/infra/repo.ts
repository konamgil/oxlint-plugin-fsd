import { Guard } from "@/core/guard";
import { WorkUseCase } from "@/modules/work/application";
import { WorkDomainModel } from "@/modules/work/domain/model";
import { WorkInfraHelper } from "@/modules/work/infra/helper";
import { UserApplicationApi } from "@/modules/user/application";
import { UserModule } from "@/modules/user/user.module";
import { SharedToken } from "@/shared/token";

export const repo = [
  Guard,
  WorkUseCase,
  WorkDomainModel,
  WorkInfraHelper,
  UserApplicationApi,
  UserModule,
  SharedToken,
];
