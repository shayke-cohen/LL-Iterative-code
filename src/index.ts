import { logger } from './core/initLogger';
import { TaskInitializer, Task, File, FileHistory } from './core/TaskInitializer';
import { LLMInterface, ToolResults, LLMResponse } from './core/LLMInterface';
import { ToolRunner } from './core/ToolRunner';
import { IterationController } from './core/IterationController';
import { HistoryManager } from './core/HistoryManager';
import { CLIInterface } from './cli/CLIInterface';
import { RealLLM } from './core/RealLLM';
import { selectRelevantFiles, getProjectStructure } from './core/file-selector';
import * as path from 'path';
import * as fs from 'fs';

async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (error) {
    logger.logToolStderr(`Error reading file ${filePath}: ${error}`);
    return '';
  }
}

async function readFilesFromDisk(fileNames: string[], projectRoot: string): Promise<File[]> {
  return Promise.all(fileNames.map(async (fileName) => {
    const filePath = path.join(projectRoot, fileName);
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return { fileName, contentSnippet: content };
    } catch (error) {
      logger.logToolStderr(`Warning: Failed to read file ${fileName}: ${error}`);
      return { fileName, contentSnippet: '' };
    }
  }));
}

export async function main() {
  const cli = new CLIInterface();

  try {
    // Get project directory from user
    const defaultProjectRoot = '/Users/shayco/GitHub/temp-playground';
    const projectRootInput = await cli.askQuestion(`Enter the project directory (default: ${defaultProjectRoot}): `);
    const projectRoot = projectRootInput.trim() || defaultProjectRoot;
    const absoluteProjectRoot = path.resolve(projectRoot);

    logger.logMainFlow(`Using project directory: ${absoluteProjectRoot}`);

    // Initialize ToolRunner
    ToolRunner.initialize(absoluteProjectRoot);

    // Get task description from user
    //const defaultTask = "create a node project in typescript that expose a function that calculate average of array of numbers. add jest test test. make sure you setup all project relevant files.";
    const defaultTask = "add performance log for every function";
    const taskDescription = await cli.askQuestion(`Enter the task description (default: "${defaultTask}"): `);
    const finalTaskDescription = taskDescription.trim() || defaultTask;

    // Get project structure and select relevant files
    const projectStructure = await getProjectStructure(absoluteProjectRoot);
    const relevantFiles = await selectRelevantFiles(
      finalTaskDescription,
      projectStructure,
      5, // maxIterations
      20, // maxFiles
      100000, // maxTotalSize (100k)
      absoluteProjectRoot
    );

    // Initialize task
    const taskFiles: File[] = await Promise.all(relevantFiles.map(async file => ({
      fileName: file.name,
      contentSnippet: await readFileContent(path.join(absoluteProjectRoot, file.name))
    })));

    const task: Task = TaskInitializer.initialize(
      finalTaskDescription,
      taskFiles,
      absoluteProjectRoot,
      true,
      [] // Initial empty file history
    );

    // Initialize other components
    const llm = new RealLLM();
    const iterationController = new IterationController(10);
    const historyManager = new HistoryManager();

    historyManager.clearHistory();

    let isTaskComplete = false;
    let toolResults: ToolResults = {};

    // Main iteration loop
    while (iterationController.shouldContinue(isTaskComplete)) {
      iterationController.incrementIteration();
      logger.logMainFlow(`Starting iteration ${iterationController.getCurrentIteration()}`);

      // Code Generation Phase
      const codeGeneration = await llm.generateCode(task, toolResults);

      // Execute tools based on LLM response
      if (codeGeneration.toolUsages && codeGeneration.toolUsages.length > 0) {
        logger.logMainFlow(`Executing ${codeGeneration.toolUsages.length} tools requested by LLM`);
        const { results: newToolResults, newFiles, modifiedFiles, updatedFileHistory } = await ToolRunner.runTools(codeGeneration.toolUsages);

        // Update toolResults, relevantFiles, and fileHistories
        toolResults = { ...toolResults, ...newToolResults };
        task.relevantFiles = await readFilesFromDisk([...new Set([...task.relevantFiles.map(f => f.fileName), ...modifiedFiles, ...newFiles.map(f => f.fileName)])], absoluteProjectRoot);
        task.relevantFilesHistory = updatedFileHistory;
      }

      // Run standard tools
      logger.logMainFlow('Running standard tools (tsc, jest)');
      const standardToolResults = await ToolRunner.runStandardTools();
      toolResults = { ...toolResults, ...standardToolResults };

      // Handle questions from LLM
      if (codeGeneration.questions && codeGeneration.questions.length > 0) {
        for (const question of codeGeneration.questions) {
          const answer = await cli.askQuestion(question);
          // You might want to store these answers and pass them to the LLM in the next iteration
        }
      }

      // Analysis Phase
      const analysis = await llm.analyzeResults(task, toolResults);

      // Update task if needed
      if (analysis.newTaskDefinition) {
        task.currentTaskDescription = analysis.newTaskDefinition;
        logger.logMainFlow(`New task definition: ${task.currentTaskDescription}`);
      }

      // Update history
      historyManager.addEntry(iterationController.getCurrentIteration(), analysis.actionsSummary);

      // Check if task is complete
      if (analysis.isTaskComplete) {
        logger.logMainFlow(`Task completed successfully after analysis. Reason: ${analysis.completionReason}`);
        isTaskComplete = true;
      }
    }

    if (!isTaskComplete) {
      logger.logMainFlow('Maximum iterations reached. Task may not be complete.');
    }

    // Display final results or summary
    logger.logMainFlow('Task execution completed. Final status:');
    logger.logMainFlow(`Is task complete: ${isTaskComplete}`);
    logger.logMainFlow('Action history:');
    historyManager.getHistory().forEach(entry => logger.logMainFlow(entry));

  } catch (error) {
    logger.logToolStderr(`An error occurred: ${(error as Error).message}`);
  } finally {
    cli.close();
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error in main process:', error);
  process.exit(1);
});