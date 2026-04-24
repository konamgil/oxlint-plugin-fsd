import { SharedType } from "@/shared/types";
import { DomainEntity } from "@/modules/work/domain/model";
import { UserApplicationApi } from "@/modules/user/application";
import { InternalUserCommand } from "@/modules/user/application/commands/internal";
import { UserRepository } from "@/modules/user/infra";

export const useCase = [
  SharedType,
  DomainEntity,
  UserApplicationApi,
  InternalUserCommand,
  UserRepository,
];
