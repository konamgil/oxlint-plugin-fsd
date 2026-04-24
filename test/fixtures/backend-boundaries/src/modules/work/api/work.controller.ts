import { Guard } from "@/core/guard";
import { SharedType } from "@/shared/types";
import { WorkUseCase } from "@/modules/work/application";
import { DomainEntity } from "@/modules/work/domain/model";

export const controller = [Guard, SharedType, WorkUseCase, DomainEntity];
