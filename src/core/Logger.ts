import colors from 'ansi-colors';
import { LogConfig } from './ConfigManager';
import fs from 'fs';
import path from 'path';

type ColorFunction = (text: string) => string;

export class Logger {
  private static instance: Logger;
  private config: LogConfig;
  private logFile: string;

  private constructor(config: LogConfig, projectRoot: string) {
    this.config = config;
    this.logFile = path.join(process.cwd(), 'app.log');
  }

  static initialize(config: LogConfig, projectRoot: string): void {
    Logger.instance = new Logger(config, projectRoot);
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      throw new Error('Logger has not been initialized. Call Logger.initialize() first.');
    }
    return Logger.instance;
  }

  logLLMRequest(message: string): void {
    if (this.config.llm.requests) {
      this.log('LLM Request', message, colors.blue);
    }
  }

  logLLMResponse(message: string): void {
    if (this.config.llm.responses) {
      this.log('LLM Response', message, colors.green);
    }
  }

  logToolExecution(message: string): void {
    if (this.config.tools.execution) {
      this.log('Tool Execution', message, colors.yellow);
    }
  }

  logToolStdout(message: string): void {
    if (this.config.tools.stdout) {
      this.log('Tool Stdout', message, colors.cyan);
    }
  }

  logToolStderr(message: string): void {
    if (this.config.tools.stderr) {
      this.log('Tool Stderr', message, colors.red);
    }
  }

  logMainFlow(message: string): void {
    if (this.config.main.flow) {
      this.log('Main Flow', message, colors.magenta);
    }
  }

  logIterationProgress(message: string): void {
    if (this.config.main.iterationProgress) {
      this.log('Iteration Progress', message, colors.white);
    }
  }

  private log(category: string, message: string, colorFunc: ColorFunction): void {
    if (this.shouldLog(category)) {
      const timestamp = new Date().toISOString();
      const logMessage = `${timestamp} [${category}] ${message}`;
      console.log(colors.gray(timestamp), colorFunc(`[${category}]`), message);
      fs.appendFileSync(this.logFile, logMessage + '\n');
    }
  }

  private shouldLog(category: string): boolean {
    const logLevels = ['error', 'warn', 'info', 'debug', 'trace'];
    const categoryLevel = this.getCategoryLevel(category);
    return logLevels.indexOf(this.config.logLevel) >= logLevels.indexOf(categoryLevel);
  }

  private getCategoryLevel(category: string): string {
    switch (category) {
      case 'Tool Stderr':
        return 'error';
      case 'Tool Execution':
        return 'warn';
      case 'Main Flow':
      case 'Iteration Progress':
        return 'info';
      case 'LLM Request':
      case 'LLM Response':
        return 'debug';
      case 'Tool Stdout':
        return 'trace';
      default:
        return 'info';
    }
  }
}