import { TaskInitializer, Task, File } from './core/TaskInitializer';
import { LLMInterface, ToolResults, LLMResponse } from './core/LLMInterface';
import { ToolRunner } from './core/ToolRunner';
import { IterationController } from './core/IterationController';
import { Logger } from './core/Logger';
import { ConfigManager } from './core/ConfigManager';
import { HistoryManager } from './core/HistoryManager';
import { CLIInterface } from './cli/CLIInterface';
import { RealLLM } from './core/RealLLM';
import * as path from 'path';
import * as fs from 'fs';


async function main() {
  const cli = new CLIInterface();

  const defaultProjectRoot = '/Users/shayco/GitHub/temp';
  const projectRootInput = await cli.askQuestion(`Enter the project directory (default: ${defaultProjectRoot}): `);
  const projectRoot = projectRootInput.trim() || defaultProjectRoot;

  const absoluteProjectRoot = path.resolve(projectRoot);

  console.log(`Using project directory: ${absoluteProjectRoot}`);

  // Initialize ConfigManager and load configuration
  const configManager = ConfigManager.getInstance();
  configManager.loadConfig();
  const logConfig = configManager.getConfig();

  // Initialize Logger
  Logger.initialize(logConfig, absoluteProjectRoot);
  const logger = Logger.getInstance();

  ToolRunner.initialize(absoluteProjectRoot);

  const llm = new RealLLM();
  const iterationController = new IterationController(10);
  const historyManager = new HistoryManager();

  historyManager.clearHistory();

  const defaultTask = "create a node project in typescript that expose a function that calculate average of array of numbers. add jest test test. make sure you setup all project relevant files.";
  const taskDescription = await cli.askQuestion(`Enter the task description (default: "${defaultTask}"): `);
  const finalTaskDescription = taskDescription.trim() || defaultTask;

  const task: Task = TaskInitializer.initialize(
    finalTaskDescription,
    [],
    [],
    absoluteProjectRoot,
    true
  );

  // Helper function to read files from disk
  async function readFilesFromDisk(fileNames: string[], projectRoot: string): Promise<File[]> {
    return Promise.all(fileNames.map(async (fileName) => {
      const filePath = path.join(projectRoot, fileName);
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return { fileName, contentSnippet: content };
      } catch (error) {
        logger.logToolStderr(`Failed to read file ${fileName}: ${error}`);
        return { fileName, contentSnippet: '' };
      }
    }));
  }

  try {
    let isTaskComplete = false;
    let toolResults: ToolResults = {};
    let currentTaskDescription = finalTaskDescription;

    while (iterationController.shouldContinue(isTaskComplete)) {
      iterationController.incrementIteration();
      logger.logMainFlow(`Starting iteration ${iterationController.getCurrentIteration()}`);

      // Re-read relevant and working files from disk
      task.relevantFiles = await readFilesFromDisk(task.relevantFiles.map(file => file.fileName), absoluteProjectRoot);
      task.workingFiles = await readFilesFromDisk(task.workingFiles.map(file => file.fileName), absoluteProjectRoot);

      // Update the task with the current task description
      task.currentTaskDescription = currentTaskDescription;

      // Code Generation Phase
      const codeGeneration = await llm.generateCode(task, toolResults);

      // Run tools including LLM-suggested actions
      const { results: newToolResults, newFiles, modifiedFiles } = await ToolRunner.runTools(task.workingFiles, codeGeneration.toolUsages);

      // Update toolResults for the next iteration
      toolResults = newToolResults;

      // Handle questions if any
      if (codeGeneration.questions && codeGeneration.questions.length > 0) {
        const clarifications: { question: string; answer: string }[] = [];
        for (const question of codeGeneration.questions) {
          const answer = await cli.askQuestion(question);
          clarifications.push({ question, answer });
        }
        llm.setAdditionalClarifications(clarifications);

        // Update history with action summary, including that questions were asked and answered
        historyManager.addEntry(
          iterationController.getCurrentIteration(), 
          `${codeGeneration.actionsSummary} Questions were asked and answered.`
        );
      }

      // Update relevant and working files
      const allRelevantFileNames = new Set([
        ...task.relevantFiles.map(file => file.fileName),
        ...task.workingFiles.map(file => file.fileName),
        ...modifiedFiles,
        ...newFiles.map(file => file.fileName)
      ]);

      const updatedFiles = await readFilesFromDisk(Array.from(allRelevantFileNames), absoluteProjectRoot);

      // Ensure uniqueness of relevant files
      const uniqueRelevantFiles = new Map<string, File>(updatedFiles.map(file => [file.fileName, file]));
      task.relevantFiles = Array.from(uniqueRelevantFiles.values());
      task.workingFiles = task.relevantFiles;

      // Analysis Phase
      const analysis = await llm.analyzeResults(task, toolResults);

      // Update the current task description for the next iteration
      if (analysis.newTaskDefinition) {
        currentTaskDescription = analysis.newTaskDefinition;
        logger.logMainFlow(`New task definition: ${currentTaskDescription}`);
      }

      // Update relevant files based on analysis
      if (analysis.relevantFiles && analysis.relevantFiles.length > 0) {
        const analysisRelevantFiles = await readFilesFromDisk(analysis.relevantFiles, absoluteProjectRoot);
        // Merge new relevant files while maintaining uniqueness
        analysisRelevantFiles.forEach(file => uniqueRelevantFiles.set(file.fileName, file));
        task.relevantFiles = Array.from(uniqueRelevantFiles.values());
      }

      // Update history with action summary
      historyManager.addEntry(iterationController.getCurrentIteration(), analysis.actionsSummary);

      // Check if task is complete after analysis
      if (analysis.isTaskComplete) {
        logger.logMainFlow(`Task completed successfully after analysis. Reason: ${analysis.completionReason}`);
        isTaskComplete = true;
        break;
      }
    }

    if (!isTaskComplete && iterationController.getCurrentIteration() >= 10) {
      logger.logMainFlow('Maximum iterations reached. Task may not be complete.');
    }

  } catch (error) {
    logger.logToolStderr(`An error occurred: ${(error as Error).message}`);
  } finally {
    cli.close();
  }
}

main();