import { exec } from 'child_process';
import { File } from './TaskInitializer';
import { ToolResults, ToolUsage } from './LLMInterface';
import { FileManager } from './FileManager';
import { Logger } from './Logger';
import glob from 'glob';
import fs from 'fs';
import path from 'path';

export class ToolRunner {
  private static fileManager: FileManager;
  private static projectRoot: string;

  static initialize(projectRoot: string): void {
    this.fileManager = new FileManager(projectRoot);
    this.projectRoot = projectRoot;
  }

  // For testing purposes
  static setFileManager(fileManager: FileManager): void {
    this.fileManager = fileManager;
  }

  static async runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.projectRoot }, (error, stdout, stderr) => {
        if (error) {
          Logger.error(`Command execution failed: ${command}`);
          reject(`${error.message}\n${stderr}`);
        } else {
          Logger.log(`Command executed successfully: ${command}`);
          resolve(stdout);
        }
      });
    });
  }

  static async runTools(workingFiles: File[], toolUsages: ToolUsage[]): Promise<{ results: ToolResults; newFiles: File[] }> {
    const results: ToolResults = {};
    let newFiles: File[] = [];

    // Execute specific tool usages
    for (const usage of toolUsages) {
      try {
        switch (usage.name) {
          case 'moveFile':
            results[usage.name] = this.fileManager.moveFile(usage.params.source, usage.params.destination) ? 'success' : 'failed';
            break;
          case 'deleteFile':
            results[usage.name] = this.fileManager.deleteFile(usage.params.fileName) ? 'success' : 'failed';
            break;
          case 'updateFile':
            results[usage.name] = this.fileManager.updateFile({fileName: usage.params.fileName, contentSnippet: usage.params.content}) ? 'success' : 'failed';
            break;
          case 'requestFiles':
            const files = await this.requestFiles(usage.params.filePattern);
            newFiles = [...newFiles, ...files];
            results[usage.name] = `Found ${files.length} files matching pattern ${usage.params.filePattern}`;
            break;
          case 'yarnInstall':
            results[usage.name] = await this.runCommand('yarn install');
            break;
          case 'yarnBuild':
            results[usage.name] = await this.runCommand('yarn build');
            break;
          case 'yarnTest':
            results[usage.name] = await this.runCommand('yarn test');
            break;
          case 'removeNodeModules':
            results[usage.name] = await this.runCommand('rm -rf node_modules');
            break;
          case 'completeTask':
            results[usage.name] = 'Task marked as complete';
            break;
          default:
            Logger.log(`Unrecognized tool: ${usage.name}`);
        }
        Logger.log(`Executed ${usage.name} with reasoning: ${usage.reasoning}`);
      } catch (error) {
        Logger.error(`Error executing ${usage.name}: ${(error as Error).message}`);
        results[usage.name] = `failed: ${(error as Error).message}`;
      }
    }

    // Run standard tools
    results.tsc = await this.runCommand('tsc');
    results.jest = await this.runCommand('jest');
    results.eslint = await this.runCommand('eslint .');
    results.npmAudit = await this.runCommand('npm audit');

    return { results, newFiles };
  }

  private static async requestFiles(filePattern: string): Promise<File[]> {
    return new Promise((resolve, reject) => {
      glob(filePattern, { cwd: this.projectRoot }, (err: Error | null, files: string[]) => {
        if (err) {
          reject(err);
        } else {
          const fileContents: File[] = files.map(file => ({
            fileName: file,
            contentSnippet: fs.readFileSync(path.join(this.projectRoot, file), 'utf-8')
          }));
          resolve(fileContents);
        }
      });
    });
  }

}