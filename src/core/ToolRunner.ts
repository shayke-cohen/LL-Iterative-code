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

  static async runCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(command, { cwd: this.projectRoot }, (error, stdout, stderr) => {
        if (error) {
          Logger.error(`Command execution failed: ${command}`);
          Logger.error(`Error: ${error.message}`);
          Logger.error(`stderr: ${stderr}`);
          reject({ error: error.message, stderr });
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
        const resultKey = `${usage.name}|${Object.entries(usage.params).map(([key, value]) => `${key}=${value}`).join(',')}`;
        switch (usage.name) {
          case 'moveFile':
            results[resultKey] = this.fileManager.moveFile(usage.params.source, usage.params.destination) ? 'success' : 'failed';
            break;
          case 'deleteFile':
            results[resultKey] = this.fileManager.deleteFile(usage.params.fileName) ? 'success' : 'failed';
            break;
          case 'updateFile':
            results[resultKey] = this.fileManager.updateFile({fileName: usage.params.fileName, contentSnippet: usage.params.content}) ? 'success' : 'failed';
            break;
          case 'requestFiles':
            const files = await this.requestFiles(usage.params.filePattern);
            newFiles = [...newFiles, ...files];
            results[resultKey] = `Found ${files.length} files matching pattern ${usage.params.filePattern}`;
            break;
          case 'yarnInstall':
            results[resultKey] = await this.runCommand('yarn install');
            break;
          case 'yarnBuild':
            results[resultKey] = await this.runCommand('yarn build');
            break;
          case 'yarnTest':
            results[resultKey] = await this.runCommand('yarn test');
            break;
          case 'removeNodeModules':
            results[resultKey] = await this.runCommand('rm -rf node_modules');
            break;
          default:
            Logger.log(`Unrecognized tool: ${usage.name}`);
        }
        Logger.log(`Executed ${usage.name} with reasoning: ${usage.reasoning}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error(`Error executing ${usage.name}: ${errorMessage}`);
        results[`${usage.name}|${Object.entries(usage.params).map(([key, value]) => `${key}=${value}`).join(',')}`] = `failed: ${errorMessage}`;
      }
    }

    // Ensure dependencies are installed
    if (!fs.existsSync(path.join(this.projectRoot, 'node_modules'))) {
      try {
        Logger.log('Installing dependencies...');
        //await this.runCommand('yarn install');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error(`Failed to install dependencies: ${errorMessage}`);
      }
    }

    // Run standard tools
    //const standardTools = ['tsc', 'jest', 'eslint .', 'npm audit'];
    const standardTools = ['tsc'];
    for (const tool of standardTools) {
      try {
        results[tool] = await this.runCommand(`yarn ${tool}`);
      } catch (error) {
        const { error: errorMessage, stderr } = error as { error: string; stderr: string };
        results[tool] = `failed: ${errorMessage}\nstderr: ${stderr}`;
      }
    }

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