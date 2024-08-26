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

  static async runCommand(command: string): Promise<{ stdout: string; stderr: string; error?: string }> {
    // log the command to be executed
    Logger.log(`Executing command: ${command}`);
    return new Promise((resolve) => {
      exec(command, { cwd: this.projectRoot }, (error, stdout, stderr) => {
        if (error) {
          Logger.error(`Command execution failed: ${command}`);
          Logger.error(`Error: ${error.message}`);
          Logger.error(`stderr: ${stderr}`);
          Logger.error(`stdout: ${stdout}`);
          resolve({ stdout, stderr, error: error.message });
        } else {
          Logger.log(`Command executed successfully: ${command}`);
          Logger.log(`stdout: ${stdout}`);
          if (stderr) {
            Logger.log(`stderr: ${stderr}`);
          }
          resolve({ stdout, stderr });
        }
      });
    });
  }

  static async runTools(workingFiles: File[], toolUsages: ToolUsage[]): Promise<{ results: ToolResults; newFiles: File[] }> {
    const results: ToolResults = {};
    let newFiles: File[] = [];

    // Check if toolUsages is undefined or empty
    if (!toolUsages || toolUsages.length === 0) {
      Logger.log('No tool usages specified. Skipping tool execution.');
      return { results, newFiles };
    }

    // Execute specific tool usages
    for (const usage of toolUsages) {
      try {
        if (!usage.name) {
          Logger.error('Invalid tool usage: missing tool name');
          continue;
        }

        const resultKey = `${usage.name}|${Object.entries(usage.params || {}).map(([key, value]) => `${key}=${value}`).join(',')}`;
        
        switch (usage.name.toLowerCase()) {
          case 'movefile':
            results[resultKey] = this.fileManager.moveFile(usage.params.source, usage.params.destination) ? 'success' : 'failed';
            break;
          case 'deletefile':
            results[resultKey] = this.fileManager.deleteFile(usage.params.fileName) ? 'success' : 'failed';
            break;
          case 'updatefile':
            results[resultKey] = this.fileManager.updateFile({fileName: usage.params.fileName, contentSnippet: usage.params.content}) ? 'success' : 'failed';
            break;
          case 'requestfiles':
            const files = await this.requestFiles(usage.params.filePattern);
            newFiles = [...newFiles, ...files];
            results[resultKey] = `Found ${files.length} files matching pattern ${usage.params.filePattern}`;
            break;
          case 'yarn':
          case 'yarninstall':
          case 'yarnbuild':
          case 'yarntest':
          case 'removemodules':
            const command = usage.name === 'yarn' ? `yarn ${usage.params.command || ''}` : `yarn ${usage.name.slice(4).toLowerCase()}`;
            results[resultKey] = await ToolRunner.runCommand(command.trim());
            break;
          case 'yarnadd':
            results[resultKey] = await ToolRunner.runCommand(`yarn add ${usage.params.package}`);
            break;
          default:
            Logger.log(`Unrecognized tool: ${usage.name}`);
        }
        Logger.log(`Executed ${usage.name} with reasoning: ${usage.reasoning}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error(`Error executing ${usage.name}: ${errorMessage}`);
        results[`${usage.name}|${Object.entries(usage.params || {}).map(([key, value]) => `${key}=${value}`).join(',')}`] = `failed: ${errorMessage}`;
      }
    }

    // Ensure dependencies are installed
    if (!fs.existsSync(path.join(this.projectRoot, 'node_modules'))) {
      try {
        Logger.log('Installing dependencies...');
        results['yarnInstall'] = await ToolRunner.runCommand('yarn install');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.error(`Failed to install dependencies: ${errorMessage}`);
        results['yarnInstall'] = `failed: ${errorMessage}`;
      }
    }

    // Run standard tools
    const standardTools = ['tsc', 'jest', 'eslint .', 'npm audit'];
    for (const tool of standardTools) {
      try {
        results[tool] = await ToolRunner.runCommand(`yarn ${tool}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results[tool] = `failed: ${errorMessage}`;
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