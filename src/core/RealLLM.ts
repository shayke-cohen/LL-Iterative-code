import { LLMInterface, ToolResults, LLMResponse } from './LLMInterface';
import { Task, File, FileHistory, FileUpdate } from './TaskInitializer';
import { Logger } from './Logger';
import { runPrompt } from './runPrompt';
import { updateFileHistories } from './fileHistoryUtils';

export class RealLLM extends LLMInterface {
  private lastAnalysisRecommendations: string = '';
  private additionalClarifications: { question: string; answer: string }[] = [];
  private logger: Logger;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  private logRelevantFiles(files: File[]): void {
    const nonEmptyFiles = files.filter(file => file.contentSnippet && file.contentSnippet.trim() !== '');
    const emptyFiles = files.filter(file => !file.contentSnippet || file.contentSnippet.trim() === '');
  
    let totalSize = 0;
  
    this.logger.logInfo(`Relevant non-empty files being sent to LLM:`);
    nonEmptyFiles.forEach(file => {
      const fileSize = file.contentSnippet ? file.contentSnippet.length : 0;
      totalSize += fileSize;
      this.logger.logInfo(`- ${file.fileName} (${fileSize} characters)`);
    });
  
    emptyFiles.forEach(file => {
      this.logger.logToolStderr(`WARNING: Empty file not being sent to LLM: ${file.fileName}`);
    });
  
    this.logger.logInfo(`Total size of all files: ${totalSize} characters`);
  
    if (totalSize > 100000) {
      this.logger.logToolStderr(`WARNING: Total file size is large (${totalSize} characters). This may impact LLM performance.`);
    }
  }

  async generateCode(task: Task, toolResults: ToolResults): Promise<LLMResponse> {
    return this.retryOperation(async () => {
      this.logger.logInfo("Files for code generation:");
      this.logRelevantFiles(task.relevantFiles);

      const prompt = this.generateCodePrompt(task, toolResults);

      this.logger.logLLMRequest(`Generating code for task: ${task.currentTaskDescription || task.description}`);
      this.logger.logLLMRequest(`Prompt: ${prompt}`);

      try {
        const response = await runPrompt({
          prompt,
          taskDescription: 'Code Generation',
          useCache: true, 
          model: 'gpt-4o' 
        });

        if (!response) {
          throw new Error('No response received from LLM');
        }

        this.logger.logLLMResponse("Received generate response from LLM");
        this.logger.logLLMResponse(`Response: ${response}`);

        
        try {
          const parsedResponse = this.parseJSONResponse(response);
          if (!parsedResponse.actionsSummary) {
            parsedResponse.actionsSummary = "No actions summary provided";
          }
  
          // Ensure files_history is present in the response
          if (!parsedResponse.filesHistory) {
            parsedResponse.filesHistory = [];
          }

          if (parsedResponse.toolUsages && parsedResponse.toolUsages.length > 0) {
            const requestedTools = parsedResponse.toolUsages.map(tool => tool.name).join(', ');
            this.logger.logInfo(`Tools requested by LLM in generateCode: ${requestedTools}`);
          } else {
            this.logger.logInfo("No tools were requested by LLM in generateCode");
          }

          return parsedResponse;
        } catch (parseError) {
          this.logger.logToolStderr("Failed to parse LLM response: " + parseError);
          throw new Error('Invalid response format from LLM');
        }
      } catch (error) {
        this.logger.logToolStderr("Error in code generation: " + error);
        throw error;
      }
    });
  }



  async analyzeResults(task: Task, toolResults: ToolResults): Promise<LLMResponse> {
    return this.retryOperation(async () => {
      this.logger.logInfo("Files for result analysis:");
      this.logRelevantFiles(task.relevantFiles);

      const prompt = this.generateAnalysisPrompt(task, toolResults);

      this.logger.logLLMRequest(`Analyzing results for task: ${task.currentTaskDescription || task.description}`);
      this.logger.logLLMRequest(`Prompt: ${prompt}`);

      try {
        const response = await runPrompt({
          prompt,
          taskDescription: 'Result Analysis',
          useCache: true, 
          model: 'gpt-4o' 
        });

        if (!response) {
          throw new Error('No response received from LLM');
        }

        this.logger.logLLMResponse("Received analyze response from LLM");
        this.logger.logLLMResponse(`Response: ${response}`);

        const parsedResponse = this.parseJSONResponse(response);

        this.logger.logInfo(`Analysis recommendations: ${parsedResponse.actionsSummary}`);

        const llmResponse: LLMResponse = {
          toolUsages: [],
          questions: [],
          isTaskComplete: parsedResponse.isTaskComplete || false,
          completionReason: parsedResponse.completionReason,
          actionsSummary: parsedResponse.actionsSummary || '',
          relevantFiles: parsedResponse.relevantFiles || [],
          newTaskDefinition: parsedResponse.newTaskDefinition || '',
          filesHistory: parsedResponse.filesHistory || []
        };

        if (llmResponse.isTaskComplete) {
          this.logger.logInfo(`Task complete. Reason: ${llmResponse.completionReason}`);
        } else if (llmResponse.newTaskDefinition) {
          this.logger.logInfo(`New task definition: ${llmResponse.newTaskDefinition}`);
        }

        return llmResponse;
      } catch (error) {
        this.logger.logToolStderr(`Error in result analysis: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }


  protected generateCodePrompt(task: Task, toolResults: ToolResults): string {
    const toolInstructions = this.generateToolInstructions();
    
    return `
You are an AI assistant specialized in TypeScript development. Your task is to generate or update code based on the following information:

Task Description: ${task.description}
Current Task Description: ${task.currentTaskDescription || task.description}

Relevant Files:
${task.relevantFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}

File History:
${JSON.stringify(task.relevantFilesHistory, null, 2)}

Previous Tool Results:
${Object.entries(toolResults).map(([tool, result]) => `${tool}:\n${JSON.stringify(result)}`).join('\n\n')}

Tool Instructions:
${toolInstructions}

Based on this information, please generate or update the TypeScript code. Your response should be a JSON object with the following structure:

{
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
  ],
  "isTaskComplete": false,
  "completionReason": "If isTaskComplete is true, provide a reason here",
  "filesHistory": [
    {
      "file_name": "example.ts",
      "new_version": {
        "version": 2,
        "code": "// Updated code content",
        "diff": "- old line\n+ new line",
        "comment": "Explanation of changes made"
      },
      "change_history": [
        {
          "from_version": 1,
          "to_version": 2,
          "diff": "- old line\n+ new line",
          "comment": "Explanation of changes made"
        }
      ]
    }
  ]
}

Important Instructions:
1. If you have any questions, add them to the "questions" array. Each question should be prefixed with a running number (e.g., "1. ", "2. ", etc.).
2. If there are any questions in the "questions" array, set "isTaskComplete" to false and do not provide a "completionReason".
3. Only set "isTaskComplete" to true if you are certain that the entire task has been successfully completed and there are no questions.
4. For each file you modify, you MUST use the "updateFile" tool to actually update the file content. Include this in the "toolUsages" array.
5. After using the "updateFile" tool, include the file details in the "filesHistory" array, including the new version, diff, and change history.
6. Make sure to use the "updateFile" tool for EACH file you modify, before including it in the "filesHistory" array.

Ensure that your response is a valid JSON string.
`;
  }

  protected generateAnalysisPrompt(task: Task, toolResults: ToolResults): string {
    const toolInstructions = this.generateToolInstructions();

    return `
You are an AI assistant specialized in analyzing TypeScript development results. Your task is to analyze the results of the latest code changes and tool outputs. Here's the relevant information:

Original Task Description: ${task.description}
Current Task Description: ${task.currentTaskDescription || task.description}

Relevant Files:
${task.relevantFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}

Tool Results:
${Object.entries(toolResults).map(([tool, result]) => {
  if (typeof result === 'object' && result !== null && 'success' in result) {
    return `${tool}: ${result.success ? 'Success' : 'Failure'}\nMessage: ${result.message}`;
  } else {
    return `${tool}: ${result}`;
  }
}).join('\n\n')}

Tool Instructions:
${toolInstructions}

Based on this information, please analyze the results and provide feedback. Your response should be a JSON object with the following structure:

{
  "toolUsages": [],
  "questions": [],
  "isTaskComplete": false,
  "completionReason": null,
  "actionsSummary": "A brief summary of the analysis and suggested actions",
  "relevantFiles": ["List of relevant file names"],
  "newTaskDefinition": "If needed, a new task definition"
}

Important Instructions:
1. Do not include any questions in the "questions" array. Leave it empty.
2. Do not suggest any tool usages. Leave the "toolUsages" array empty.
3. Set "isTaskComplete" to true only if you're certain the entire task is complete.
4. Provide a brief summary of the analysis in the "actionsSummary" field.
5. List any relevant files that need attention in the "relevantFiles" array.
6. If a new task definition is needed, provide it in the "newTaskDefinition" field.

Ensure that your response is a valid JSON string.
`;
  }

  // Add a method to set additional clarifications
  setAdditionalClarifications(clarifications: { question: string; answer: string }[]): void {
    this.additionalClarifications.push(...clarifications);
  }

  private parseJSONResponse(response: string): LLMResponse {
    try {
      const parsedResponse = JSON.parse(response);
      return {
        ...parsedResponse,
        filesHistory: parsedResponse.filesHistory || []
      };
    } catch (error) {
      // If that fails, try to extract the JSON part
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonPart = jsonMatch[0];
        try {
          // Try to parse the extracted JSON
          return JSON.parse(jsonPart) as LLMResponse;
        } catch (innerError) {
          // If that also fails, try to clean the JSON string
          const cleanedJson = this.cleanJSONString(jsonPart);
          return JSON.parse(cleanedJson) as LLMResponse;
        }
      }
      // If we can't extract JSON, throw an error
      throw new Error('No valid JSON found in the response');
    }
  }

  private updateFileHistory(task: Task, updatedFiles: FileUpdate[]): void {
    task.relevantFilesHistory = updateFileHistories(task, updatedFiles);
  }
  
  private cleanJSONString(jsonString: string): string {
    // Remove any potential leading/trailing non-JSON content
    jsonString = jsonString.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
  
    // Escape special characters in string values
    return jsonString.replace(/("(?:\\.|[^"\\])*")/g, (match) => {
      return match.replace(/[\n\r\t]/g, (escapeChar) => {
        switch (escapeChar) {
          case '\n': return '\\n';
          case '\r': return '\\r';
          case '\t': return '\\t';
          default: return escapeChar;
        }
      });
    });
  }

  private extractRelevantFiles(toolResults: ToolResults): string[] {
    const relevantFiles = new Set<string>();
  
    for (const [tool, result] of Object.entries(toolResults)) {
      if (typeof result === 'object' && result !== null && 'message' in result) {
        const message = result.message;
        
        // Extract file paths from TypeScript compiler errors
        const tsErrors = message.match(/(?:^|\n)(.+\.ts)\(\d+,\d+\):/g);
        if (tsErrors) {
          tsErrors.forEach(error => {
            const match = error.match(/(.+\.ts)/);
            if (match) relevantFiles.add(match[1]);
          });
        }
  
        // Extract file paths from Jest test results
        const jestErrors = message.match(/(?:^|\n)\s*●\s(.+\.test\.ts):/g);
        if (jestErrors) {
          jestErrors.forEach(error => {
            const match = error.match(/(.+\.test\.ts)/);
            if (match) relevantFiles.add(match[1]);
          });
        }
  
        // Extract file paths from ESLint results
        const eslintErrors = message.match(/(?:^|\n)(.+\.ts):/g);
        if (eslintErrors) {
          eslintErrors.forEach(error => {
            const match = error.match(/(.+\.ts)/);
            if (match) relevantFiles.add(match[1]);
          });
        }
  
        // Extract file paths from stack traces
        const stackTraces = message.match(/(?:^|\n)\s+at\s.+\((.+\.ts):\d+:\d+\)/g);
        if (stackTraces) {
          stackTraces.forEach(trace => {
            const match = trace.match(/\((.+\.ts):\d+:\d+\)/);
            if (match) relevantFiles.add(match[1]);
          });
        }
      }
    }
  
    return Array.from(relevantFiles);
  }
}