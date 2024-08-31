import { TaskInitializer, Task, File, FileHistory } from './core/TaskInitializer';
import { ToolResults, LLMResponse } from './core/LLMInterface';
import { ToolRunner } from './core/ToolRunner';
import { IterationController } from './core/IterationController';
import { HistoryManager } from './core/HistoryManager';
import { RealLLM } from './core/RealLLM';
import { selectRelevantFiles, getProjectStructure } from './core/file-selector';
import * as path from 'path';
import * as fs from 'fs';
import { Logger } from './core/Logger';

export interface ShragaConfig {
  maxIterations?: number;
  maxFiles?: number;
  maxTotalSize?: number;
  logger?: Logger;
}

export class Shraga {
  private projectDir: string;
  private task: string;
  private config: Required<ShragaConfig>;
  private logger: Logger;

  constructor(projectDir: string, task: string, config?: ShragaConfig) {
    this.projectDir = path.resolve(projectDir);
    this.task = task;
    this.config = {
      maxIterations: 10,
      maxFiles: 30,
      maxTotalSize: 100000,
      logger: Logger.getInstance(),
      ...config
    };
    this.logger = this.config.logger;
  }

  public async run(): Promise<void> {
    try {
      await this.initializeComponents();
      const relevantFiles = await this.selectRelevantFiles();
      await this.executeIterations(relevantFiles);
    } catch (error) {
      this.logger.logToolStderr(`An error occurred: ${(error as Error).message}`);
      throw error;
    }
  }

  public configure(config: Partial<ShragaConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger = this.config.logger;
  }

  private async initializeComponents(): Promise<void> {
    this.logger.logMainFlow(`Using project directory: ${this.projectDir}`);
    ToolRunner.initialize(this.projectDir);
  }

  private async selectRelevantFiles(): Promise<File[]> {
    const projectStructure = await getProjectStructure(this.projectDir);
    const relevantFiles = await selectRelevantFiles(
      this.task,
      projectStructure,
      this.config.maxIterations,
      this.config.maxFiles,
      this.config.maxTotalSize,
      this.projectDir
    );

    return Promise.all(relevantFiles.map(async file => ({
      fileName: file.name,
      contentSnippet: await this.readFileContent(path.join(this.projectDir, file.name))
    })));
  }

  private async executeIterations(relevantFiles: File[]): Promise<void> {
    const task: Task = TaskInitializer.initialize(
      this.task,
      relevantFiles,
      this.projectDir,
      true,
      []
    );

    const llm = new RealLLM();
    const iterationController = new IterationController(this.config.maxIterations);
    const historyManager = new HistoryManager();

    historyManager.clearHistory();

    let isTaskComplete = false;
    let toolResults: ToolResults = {};

    while (iterationController.shouldContinue(isTaskComplete)) {
      iterationController.incrementIteration();
      this.logger.logMainFlow(`Starting iteration ${iterationController.getCurrentIteration()}`);

      const codeGeneration = await llm.generateCode(task, toolResults);

      if (codeGeneration.toolUsages && codeGeneration.toolUsages.length > 0) {
        const { results: newToolResults, newFiles, modifiedFiles, updatedFileHistory } = await ToolRunner.runTools(codeGeneration.toolUsages);
        toolResults = { ...toolResults, ...newToolResults };
        task.relevantFiles = await this.readFilesFromDisk([...new Set([...task.relevantFiles.map(f => f.fileName), ...modifiedFiles, ...newFiles.map(f => f.fileName)])]);
        task.relevantFilesHistory = updatedFileHistory;
      }

      const standardToolResults = await ToolRunner.runStandardTools();
      toolResults = { ...toolResults, ...standardToolResults };

      const analysis = await llm.analyzeResults(task, toolResults);

      if (analysis.newTaskDefinition) {
        task.currentTaskDescription = analysis.newTaskDefinition;
        this.logger.logMainFlow(`New task definition: ${task.currentTaskDescription}`);
      }

      historyManager.addEntry(iterationController.getCurrentIteration(), analysis.actionsSummary);

      if (analysis.isTaskComplete) {
        this.logger.logMainFlow(`Task completed successfully after analysis. Reason: ${analysis.completionReason}`);
        isTaskComplete = true;
      }
    }

    if (!isTaskComplete) {
      this.logger.logMainFlow('Maximum iterations reached. Task may not be complete.');
    }

    this.logger.logMainFlow('Task execution completed. Final status:');
    this.logger.logMainFlow(`Is task complete: ${isTaskComplete}`);
    this.logger.logMainFlow('Action history:');
    historyManager.getHistory().forEach(entry => this.logger.logMainFlow(entry));
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      this.logger.logToolStderr(`Error reading file ${filePath}: ${error}`);
      return '';
    }
  }

  private async readFilesFromDisk(fileNames: string[]): Promise<File[]> {
    return Promise.all(fileNames.map(async (fileName) => {
      const filePath = path.join(this.projectDir, fileName);
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return { fileName, contentSnippet: content };
      } catch (error) {
        this.logger.logToolStderr(`Warning: Failed to read file ${fileName}: ${error}`);
        return { fileName, contentSnippet: '' };
      }
    }));
  }
}