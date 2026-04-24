import { Guard } from "@/core/guard";
import { WorkUseCase } from "@/modules/work/application";
import { DomainEntity } from "@/modules/work/domain/model";
import { UserInfraApi } from "@/modules/user/infra";
import { ApiDto } from "@/modules/work/api/dto";

export const repo = [Guard, WorkUseCase, DomainEntity, UserInfraApi, {} as ApiDto];
