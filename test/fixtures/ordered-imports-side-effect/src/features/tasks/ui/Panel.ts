import { formatDate } from "@/shared/lib/date";
import "@/shared/config/init";
import { taskModel } from "@/features/tasks/model";

export const panelState = `${taskModel}:${formatDate()}`;
