// important comment for imports
import { formatDate } from "@/shared/lib/date";
import { taskModel } from "@/features/tasks/model";

export const panelState = `${taskModel}:${formatDate()}`;
