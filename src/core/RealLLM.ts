import { LLMInterface, ToolResults, LLMResponse } from './LLMInterface';
import { Task } from './TaskInitializer';
import { Logger } from './Logger';
import { runPrompt } from './runPrompt';

export class RealLLM extends LLMInterface {
  private lastAnalysisRecommendations: string = '';
  private additionalClarifications: { question: string; answer: string }[] = [];
  private logger: Logger;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  async generateCode(task: Task, toolResults: ToolResults): Promise<LLMResponse> {
    return this.retryOperation(async () => {
      const prompt = this.generateCodePrompt(task, toolResults);
      
      // Log relevant files
      const relevantFiles = task.relevantFiles.map(file => file.fileName).join(', ');
      this.logger.logMainFlow(`Relevant files for LLM request: ${relevantFiles}`);
      
      this.logger.logLLMRequest("Generating code prompt:\n" + prompt);

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

        this.logger.logLLMResponse("Received generate response from LLM:\n " + response);

        try {
          const parsedResponse = this.parseJSONResponse(response);
          if (!parsedResponse.actionsSummary) {
            parsedResponse.actionsSummary = "No actions summary provided";
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
      const prompt = this.generateAnalysisPrompt(task, toolResults);

      // Log relevant files
      const relevantFiles = task.relevantFiles.map(file => file.fileName).join(', ');
      this.logger.logMainFlow(`Relevant files for LLM analysis request: ${relevantFiles}`);

      this.logger.logLLMRequest("Prompt for result analysis: " + prompt);

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

        this.logger.logLLMResponse("Received analyze response from LLM:\n " + response);

  
        // Extract JSON part from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No valid JSON found in the response');
        }
        const jsonString = jsonMatch[0];
  
        // Parse the JSON response
        const parsedResponse = JSON.parse(jsonString);
  
        // Convert the parsed response to LLMResponse format
        const llmResponse: LLMResponse = {
          toolUsages: [], // Always empty for analysis step
          questions: [], // Always empty for analysis step
          isTaskComplete: parsedResponse.isTaskComplete || false,
          completionReason: parsedResponse.completionReason,
          actionsSummary: parsedResponse.actionsSummary || '',
          relevantFiles: parsedResponse.relevantFiles || [],
          newTaskDefinition: parsedResponse.newTaskDefinition || ''
        };
  
        return llmResponse;
      } catch (error) {
        this.logger.logToolStderr("Error in result analysis: " + error);
        throw error;
      }
    });
  }

  protected generateCodePrompt(task: Task, toolResults: ToolResults): string {
    let prompt = `
You are an AI assistant specialized in TypeScript development. Your task is to generate or update code based on the following information:

Original Task Description: ${task.description}
Current Task Description: ${task.currentTaskDescription || task.description}

Relevant Files:
${task.relevantFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}

Working Files:
${task.workingFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}

Previous Tool Results:
${Object.entries(toolResults).map(([tool, result]) => {
  if (typeof result === 'object' && result !== null && 'success' in result) {
    return `${tool}: ${result.success ? 'Success' : 'Failure'}\nMessage: ${result.message}`;
  } else {
    return `${tool}: ${result}`;
  }
}).join('\n\n')}
`;

    if (this.additionalClarifications.length > 0) {
      prompt += `
Accumulated Questions and Answers:
${this.additionalClarifications.map(qa => `Q: ${qa.question}\nA: ${qa.answer}`).join('\n\n')}
`;
    }

    prompt += `
${this.generateToolInstructions()}

Important Instructions:
1. Focus on addressing the current task description while keeping the original task in mind.
2. Do not ask for file contents. If a file is mentioned in the relevant files, its content will be provided automatically.
3. Do not ask for Jest test results or TypeScript compilation results. These will be provided automatically in the next iteration if you run the respective tools.
4. If you need to create a new file or update an existing one, use the "updateFile" tool.
5. If you have any new questions, add them to the "questions" array. Each question should be prefixed with a running number (e.g., "1. ", "2. ", etc.).
6. If there are any questions in the "questions" array, set "isTaskComplete" to false and do not provide a "completionReason".
7. Only set "isTaskComplete" to true if you are certain that the entire task has been successfully completed and there are no new questions.
8. Provide a brief summary of the actions taken in this iteration in the "actionsSummary" field.

Based on this information, please generate or update the TypeScript code to address the current task description. Your response should be a JSON object with the following structure:

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
    "Any new questions for the user, if applicable"
  ],
  "isTaskComplete": false,
  "completionReason": "If isTaskComplete is true, provide a reason here",
  "actionsSummary": "A brief summary of the actions taken in this iteration"
}

Ensure that your response is a valid JSON string.
`;

    return prompt;
  }

  protected generateAnalysisPrompt(task: Task, toolResults: ToolResults): string {
    let prompt = `
  You are an AI assistant specialized in analyzing TypeScript development results. Your task is to analyze the results of the latest code changes and tool outputs, and then construct a new task definition for the next iteration. Here's the relevant information:
  
  Original Task Description: ${task.description}
  Current Task Description: ${task.currentTaskDescription || task.description}
  
  Current Working Files:
  ${task.workingFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}
  
  Tool Results:
  ${Object.entries(toolResults).map(([tool, result]) => {
    if (typeof result === 'object' && result !== null && 'success' in result) {
      return `${tool}: ${result.success ? 'Success' : 'Failure'}\nMessage: ${result.message}`;
    } else {
      return `${tool}: ${result}`;
    }
  }).join('\n\n')}
  
  Based on this information, please provide a comprehensive analysis of the current state of the project and construct a new task definition for the next iteration. Your analysis should include:
  
  1. A summary of the current state of the project
  2. Any issues or errors identified from the tool results
  3. Suggestions for next steps or improvements
  4. An assessment of whether the overall task is complete or what remains to be done
  5. A list of relevant files that need attention based on the tool results
  6. A new task definition for the next iteration, following this format:
     "After trying to [last task], now you need to [new task], keep in mind that the original task was [original task]"
  
  Your response should be a valid JSON object with the following structure:

{
  "actionsSummary": "A brief summary of the analysis and suggested actions",
  "isTaskComplete": boolean,
  "completionReason": "Reason for task completion, if applicable",
  "relevantFiles": [
    "List of relevant file names"
  ],
  "newTaskDefinition": "The new task definition as described above"
}

IMPORTANT: Your response must be a valid JSON object only, without any additional text before or after. Do not include any explanations or text outside of the JSON structure.

  `;
  
    return prompt;
  }

  // Add a method to set additional clarifications
  setAdditionalClarifications(clarifications: { question: string; answer: string }[]): void {
    this.additionalClarifications.push(...clarifications);
  }

  private parseJSONResponse(response: string): LLMResponse {
    // First, try to parse the entire response as JSON
    try {
      return JSON.parse(response) as LLMResponse;
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