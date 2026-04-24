import { Guard } from "@/core/guard";
import { WorkUseCase } from "@/modules/work/application";
import { UserApplicationApi } from "@/modules/user/application";
import { SharedToken } from "@/shared/token";

export const controller = [Guard, WorkUseCase, UserApplicationApi, SharedToken];
