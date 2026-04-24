import { UserApplicationApi } from "@/modules/user/application";
import { UserInternalCommand } from "@/modules/user/application/commands/internal";

export const controller = [UserApplicationApi, UserInternalCommand];
