import { eslintCompatPlugin } from "@oxlint/plugins";

import { noCrossSliceDependencyRule } from "./rules/no-cross-slice-dependency.js";
import { forbiddenImportsRule } from "./rules/forbidden-imports.js";
import { noGlobalStoreImportsRule } from "./rules/no-global-store-imports.js";
import { orderedImportsRule } from "./rules/ordered-imports.js";
import { noPublicApiSidestepRule } from "./rules/no-public-api-sidestep.js";
import { noRelativeImportsRule } from "./rules/no-relative-imports.js";
import { noUiInBusinessLogicRule } from "./rules/no-ui-in-business-logic.js";

export const rules = {
  "no-cross-slice-dependency": noCrossSliceDependencyRule,
  "forbidden-imports": forbiddenImportsRule,
  "no-global-store-imports": noGlobalStoreImportsRule,
  "ordered-imports": orderedImportsRule,
  "no-public-api-sidestep": noPublicApiSidestepRule,
  "no-relative-imports": noRelativeImportsRule,
  "no-ui-in-business-logic": noUiInBusinessLogicRule,
};

export const configs = {
  recommended: {
    rules: {
      "fsd/no-cross-slice-dependency": "error",
      "fsd/forbidden-imports": "error",
      "fsd/no-global-store-imports": "error",
      "fsd/ordered-imports": "warn",
      "fsd/no-public-api-sidestep": "error",
      "fsd/no-relative-imports": "error",
      "fsd/no-ui-in-business-logic": "error",
    },
  },
  strict: {
    rules: {
      "fsd/no-cross-slice-dependency": "error",
      "fsd/forbidden-imports": "error",
      "fsd/no-global-store-imports": "error",
      "fsd/ordered-imports": "error",
      "fsd/no-public-api-sidestep": "error",
      "fsd/no-relative-imports": "error",
      "fsd/no-ui-in-business-logic": "error",
    },
  },
  base: {
    rules: {
      "fsd/no-cross-slice-dependency": "warn",
      "fsd/forbidden-imports": "warn",
      "fsd/no-global-store-imports": "error",
      "fsd/ordered-imports": "warn",
      "fsd/no-public-api-sidestep": "warn",
      "fsd/no-relative-imports": "off",
      "fsd/no-ui-in-business-logic": "error",
    },
  },
};

const plugin = eslintCompatPlugin({
  meta: {
    name: "fsd",
  },
  rules,
});

export default plugin;
