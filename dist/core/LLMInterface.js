"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMInterface = void 0;
class LLMInterface {
    generateToolInstructions() {
        return `
Available Tools and How to Use Them in Your Response:

1. Automatic Tools (These run automatically, but you can reference their results):
   - TypeScript Compiler (tsc): Compiles TypeScript code
   - Jest: Runs unit tests
   - ESLint: Lints the code
   - npm audit: Checks for vulnerabilities in dependencies

2. File Operations:
   - Move File:
     name: "moveFile"
     params: { "source": "path/to/source", "destination": "path/to/destination" }

   - Delete File:
     name: "deleteFile"
     params: { "fileName": "path/to/file" }

   - Update File:
     name: "updateFile"
     params: { "fileName": "path/to/file", "content": "new file content" }

   - Request Additional Files:
     name: "requestFiles"
     params: { "filePattern": "glob pattern to match files" }
     Example: { "filePattern": "src/**/*.ts" } to request all TypeScript files in the src directory and its subdirectories

3. Yarn Operations:
   - Install Dependencies:
     name: "yarnInstall"
     params: {}

   - Build Project:
     name: "yarnBuild"
     params: {}

   - Run Tests:
     name: "yarnTest"
     params: {}

   - Remove node_modules:
     name: "removeNodeModules"
     params: {}

4. Task Completion:
   - To indicate the task is complete:
     name: "completeTask"
     params: {}

For each tool usage, provide the tool name, parameters, and reasoning. For example:

"toolUsages": [
  {
    "name": "requestFiles",
    "params": {
      "filePattern": "src/**/*.ts"
    },
    "reasoning": "Need to examine all TypeScript files in the src directory to understand the project structure"
  },
  {
    "name": "updateFile",
    "params": {
      "fileName": "src/index.ts",
      "content": "// Updated TypeScript code here"
    },
    "reasoning": "Updated the main entry point to fix a bug and improve performance"
  },
  {
    "name": "yarnInstall",
    "params": {},
    "reasoning": "Installing dependencies after updating package.json"
  }
]

Include these toolUsages in your JSON response along with any updated files and questions.
`;
    }
    generateCodePrompt(task, toolResults, history) {
        return `
You are an AI assistant specialized in TypeScript development. Your task is to generate or update code based on the following information:

Task Description: ${task.description}

Relevant Files:
${task.relevantFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}

Working Files:
${task.workingFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}

Previous Tool Results:
${Object.entries(toolResults).map(([tool, result]) => `${tool}:\n${result}`).join('\n\n')}

Task History:
${history.join('\n')}

${this.generateToolInstructions()}

Based on this information, please generate or update the TypeScript code. Your response should be a JSON object with the following structure:

{
  "updatedFiles": [
    {
      "fileName": "example.ts",
      "contentSnippet": "// Updated TypeScript code here"
    }
  ],
  "toolUsages": [
    {
      "name": "toolName",
      "params": {
        "param1": "value1",
        "param2": "value2"
      },
      "reasoning": "Explanation for using this tool"
    }
  ],
  "questions": [
    "Any questions for the user, if applicable"
  ]
}

Ensure that your response is a valid JSON string.
`;
    }
    generateAnalysisPrompt(task, toolResults, history) {
        return `
You are an AI assistant specialized in analyzing TypeScript development results. Your task is to analyze the results of the latest code changes and tool outputs. Here's the relevant information:

Task Description: ${task.description}

Current Working Files:
${task.workingFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}

Tool Results:
${Object.entries(toolResults).map(([tool, result]) => `${tool}:\n${result}`).join('\n\n')}

Task History:
${history.join('\n')}

${this.generateToolInstructions()}

Based on this information, please analyze the results and provide feedback. Your response should be a JSON object with the following structure:

{
  "updatedFiles": [
    {
      "fileName": "example.ts",
      "contentSnippet": "// Updated TypeScript code here, if any changes are needed"
    }
  ],
  "toolUsages": [
    {
      "name": "toolName",
      "params": {
        "param1": "value1",
        "param2": "value2"
      },
      "reasoning": "Explanation for using this tool"
    }
  ],
  "questions": [
    "Any questions for the user, if applicable"
  ]
}

Ensure that your response is a valid JSON string.
`;
    }
    async retryOperation(operation, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation();
            }
            catch (error) {
                if (i === maxRetries - 1)
                    throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // Exponential backoff
            }
        }
        throw new Error('Max retries reached');
    }
    parseResponse(response) {
        try {
            return JSON.parse(response);
        }
        catch (error) {
            throw new Error(`Failed to parse LLM response: ${error.message}`);
        }
    }
}
exports.LLMInterface = LLMInterface;
