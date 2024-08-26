import { TaskInitializer, Task, File } from './core/TaskInitializer';
import { LLMInterface, ToolResults, LLMResponse } from './core/LLMInterface';
import { ToolRunner } from './core/ToolRunner';
import { IterationController } from './core/IterationController';
import { Logger } from './core/Logger';
import { HistoryManager } from './core/HistoryManager';
import { CLIInterface } from './cli/CLIInterface';

class RealLLM extends LLMInterface {
  async generateCode(task: Task, toolResults: ToolResults, history: string[]): Promise<LLMResponse> {
    return this.retryOperation(async () => {
      const prompt = this.generateCodePrompt(task, toolResults, history);
      // Implement your actual LLM call here, passing the prompt
      // This is a mock implementation
      console.log("Sending prompt to LLM for code generation:", prompt);
      const response = JSON.stringify({
        updatedFiles: task.workingFiles,
        toolUsages: [
          {
            name: "updateFile",
            params: {
              fileName: "example.ts",
              content: "// Updated TypeScript code here"
            },
            reasoning: "Updated the file to implement the required functionality"
          },
          {
            name: "requestFiles",
            params: {
              filePattern: "src/**/*.ts"
            },
            reasoning: "Need to examine all TypeScript files in the src directory"
          }
        ],
        questions: ['Is this implementation correct?'],
      });
      return this.parseResponse(response);
    });
  }

  async analyzeResults(task: Task, toolResults: ToolResults, history: string[]): Promise<LLMResponse> {
    return this.retryOperation(async () => {
      const prompt = this.generateAnalysisPrompt(task, toolResults, history);
      // Implement your actual LLM call here, passing the prompt
      // This is a mock implementation
      console.log("Sending prompt to LLM for result analysis:", prompt);
      const response = JSON.stringify({
        updatedFiles: task.workingFiles,
        toolUsages: [
          {
            name: "yarnTest",
            params: {},
            reasoning: "Run tests to verify the implementation"
          }
        ],
      });
      return this.parseResponse(response);
    });
  }
}

async function main() {
  const projectRoot = process.cwd();
  Logger.initialize(projectRoot);
  ToolRunner.initialize(projectRoot);

  const task: Task = TaskInitializer.initialize(
    'Implement a simple TypeScript function',
    [{ fileName: 'example.ts', contentSnippet: '// TODO: Implement function' }],
    [{ fileName: 'example.ts', contentSnippet: '// TODO: Implement function' }],
    projectRoot,
    true
  );

  const llm = new RealLLM();
  const iterationController = new IterationController(10);
  const historyManager = new HistoryManager(projectRoot);
  const cli = new CLIInterface();

  try {
    while (iterationController.shouldContinue(false)) {
      iterationController.incrementIteration();
      Logger.log(`Starting iteration ${iterationController.getCurrentIteration()}`);

      // Code Generation Phase
      const codeGeneration = await llm.generateCode(task, {}, historyManager.getHistory());
      
      // Update task with new files
      task.workingFiles = codeGeneration.updatedFiles;

      // Run tools including LLM-suggested actions
      const { results: toolResults, newFiles } = await ToolRunner.runTools(task.workingFiles, codeGeneration.toolUsages);

      // Add new files to the task
      task.relevantFiles = [...task.relevantFiles, ...newFiles];

      // Analysis Phase
      const analysis = await llm.analyzeResults(task, toolResults, historyManager.getHistory());

      // Update history
      historyManager.addEntry(`Iteration ${iterationController.getCurrentIteration()}: ${analysis.toolUsages.map(tu => tu.name).join(', ')}`);

      // Handle questions
      if (analysis.questions && analysis.questions.length > 0) {
        for (const question of analysis.questions) {
          const answer = await cli.askQuestion(question);
          historyManager.addEntry(`User answered: ${answer}`);
        }
      }

      // Check if task is complete
      if (analysis.toolUsages.some(tu => tu.name === 'completeTask')) {
        Logger.log('Task completed successfully');
        break;
      }

      // Run any additional tools suggested in the analysis phase
      if (analysis.toolUsages.length > 0) {
        const { results: additionalResults, newFiles: additionalFiles } = await ToolRunner.runTools(task.workingFiles, analysis.toolUsages);
        Object.assign(toolResults, additionalResults);
        task.relevantFiles = [...task.relevantFiles, ...additionalFiles];
      }
    }

    if (iterationController.getCurrentIteration() >= 10) {
      Logger.log('Maximum iterations reached. Task may not be complete.');
    }

  } catch (error) {
    Logger.error(`An error occurred: ${(error as Error).message}`);
  } finally {
    cli.close();
  }
}

main();