import React from "react";
import { editorPage } from "@/pages/editor";import { taskModel } from "@/features/tasks/model";
import { formatDate } from "@/shared/lib/date";
import { localUtil } from "./local";

export const panelState = `${React.version}:${editorPage}:${taskModel}:${formatDate()}:${localUtil}`;
