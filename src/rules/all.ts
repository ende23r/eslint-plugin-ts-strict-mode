import { ESLintUtils } from "@typescript-eslint/utils";
import { createEslintRule } from "../utils/create-eslint-rule.js";
import { DiagnosticCategory } from "typescript";
import { posToLoc } from "../utils/pos-to-loc.js";

export const RULE_NAME = "all";
export type MessageIds = "typescriptError";
export type Options = [];

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description: "Enforce strict null checks",
      /*
      recommended: {
        
      },
      */
    },
    schema: [],
    messages: {
      typescriptError: "{{ errorMessage }}",
    },
  },
  defaultOptions: [],
  create: (context) => {
    const parserServices = ESLintUtils.getParserServices(context);

    return {
      Program(astNode) {
        const semErrors = parserServices.program.getSemanticDiagnostics();
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(astNode);
        const code = tsNode.text;

        semErrors.forEach((error) => {
          // Only report errors in the current file.
          if (!error.file || error.file.fileName !== tsNode.fileName) {
            return;
          }
          if (error.reportsUnnecessary) return;
          if (error.category !== DiagnosticCategory.Error) return;

          const firstMessageInChain =
            typeof error.messageText === "string"
              ? error.messageText
              : error.messageText.messageText;

          context.report({
            messageId: "typescriptError",
            data: { errorMessage: firstMessageInChain },
            loc: posToLoc(code, error.start!, error.start! + error.length!),
          });
        });
      },
    };
  },
});
