import { LLMInterface, ToolResults, LLMResponse } from './LLMInterface';
import { Task } from './TaskInitializer';
import { Logger } from './Logger';
import { runPrompt } from './runPrompt';

export class RealLLM extends LLMInterface {

  private additionalClarifications: { question: string; answer: string }[] = [];

  async generateCode(task: Task, toolResults: ToolResults, history: string[]): Promise<LLMResponse> {
    return this.retryOperation(async () => {
      const prompt = this.generateCodePrompt(task, toolResults, history);
      Logger.log("Generating code prompt:\n" + prompt);

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

        Logger.log("Received generate response from LLM:\n " + response);

        try {
          const cleanedResponse = this.cleanJsonString(response);
          let parsedResponse = this.parseResponse(cleanedResponse);
          if (!parsedResponse.actionsSummary) {
            parsedResponse.actionsSummary = "No actions summary provided";
          }
          return parsedResponse;
        } catch (parseError) {
          Logger.error("Failed to parse LLM response: "+ parseError);
          throw new Error('Invalid response format from LLM');
        }
      } catch (error) {
        Logger.error("Error in code generation: " + error);
        throw error;
      }
    });
  }

  async analyzeResults(task: Task, toolResults: ToolResults, history: string[]): Promise<LLMResponse> {
    return this.retryOperation(async () => {
      const prompt = this.generateAnalysisPrompt(task, toolResults, history);
      
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

        Logger.log("Received analyze response from LLM:\n " + response);

        try {
          const cleanedResponse = this.cleanJsonString(response);
          let parsedResponse = this.parseResponse(cleanedResponse);
          // Ensure actionsSummary is present
          if (!parsedResponse.actionsSummary) {
            parsedResponse.actionsSummary = "No actions summary provided";
          }
          return parsedResponse;
        } catch (parseError) {
          Logger.error("Failed to parse LLM response: "+ parseError);
          throw new Error('Invalid response format from LLM');
        }
      } catch (error) {
        Logger.error("Error in result analysis: " + error);
        throw error;
      }
    });
  }

  protected generateCodePrompt(task: Task, toolResults: ToolResults, history: string[]): string {
    let prompt = `
You are an AI assistant specialized in TypeScript development. Your task is to generate or update code based on the following information:

Task Description: ${task.description}

Relevant Files:
${task.relevantFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}

Working Files:
${task.workingFiles.map(file => `${file.fileName}:\n${file.contentSnippet}`).join('\n\n')}
`;

    if (Object.keys(toolResults).length > 0) {
      prompt += `
Previous Tool Results:
${Object.entries(toolResults).map(([tool, result]) => `${tool}:\n${result}`).join('\n\n')}
`;
    }

    if (history.length > 0) {
      prompt += `
Task History:
${history.join('\n')}
`;
    }

    if (this.additionalClarifications.length > 0) {
      prompt += `
Additional Clarifications:
${this.additionalClarifications.map(({ question, answer }) => `Q: ${question}\nA: ${answer}`).join('\n\n')}
`;
    }

    prompt += `
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
  "actionsSummary": "A brief summary of the actions taken in this iteration"
}

Important Instructions:
1. To update or create files, use the "updateFile" tool with the following structure:
   {
     "name": "updateFile",
     "params": {
       "fileName": "path/to/file",
       "content": "New or updated file content"
     },
     "reasoning": "Explanation for updating this file"
   }
2. If you have any questions, add them to the "questions" array. Each question should be prefixed with a running number (e.g., "1. ", "2. ", etc.).
3. If there are any questions in the "questions" array, set "isTaskComplete" to false and do not provide a "completionReason".
4. Only set "isTaskComplete" to true if you are certain that the entire task has been successfully completed and there are no questions.
5. Provide a brief summary of the actions taken in this iteration in the "actionsSummary" field.

Ensure that your response is a valid JSON string.
`;

    return prompt;
  }

  // Add a method to set additional clarifications
  setAdditionalClarifications(clarifications: { question: string; answer: string }[]): void {
    this.additionalClarifications = clarifications;
  }

  private cleanJsonString(jsonString: string): string {
    // Remove any potential leading/trailing non-JSON content
    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}') + 1;
    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('No valid JSON object found in the response');
    }
    jsonString = jsonString.slice(jsonStart, jsonEnd);

    // Escape special characters in string values
    return jsonString.replace(/("(?:\\"|[^"])*")/g, (match) => {
      return match.replace(/[\n\r\t]/g, (escapeChar) => {
        switch (escapeChar) {
          case '\n': return '\\n';
          case '\r': return '\\r';
          case '\t': return '\\t';
          default: return escapeChar; // This line ensures we always return a string
        }
      });
    });
  }
}