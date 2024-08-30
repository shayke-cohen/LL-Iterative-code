import { exec } from 'child_process';
import { File } from './TaskInitializer';
import { ToolResults, ToolResult, ToolUsage } from './LLMInterface';
import { FileManager } from './FileManager';
import { Logger } from './Logger';
import glob from 'glob';
import fs from 'fs';
import path from 'path';

export class ToolRunner {
  private static fileManager: FileManager;
  private static projectRoot: string;
  private static logger: Logger;

  static initialize(projectRoot: string): void {
    this.fileManager = new FileManager(projectRoot);
    this.projectRoot = projectRoot;
    this.logger = Logger.getInstance();
  }

  static async runCommand(command: string): Promise<ToolResult> {
    return new Promise((resolve) => {
      const timeout = 120000; // 120 seconds in milliseconds
      const child = exec(command, { cwd: this.projectRoot }, (error, stdout, stderr) => {
        if (error) {
          this.logger.logToolStderr(`Command execution failed: ${command}`);
          this.logger.logToolStderr(`Error: ${error.message}`);
          this.logger.logToolStderr(`stderr: ${stderr}`);
          this.logger.logToolStderr(`stdout: ${stdout}`);
          resolve({
            success: false,
            message: `Execution failed. Error: ${error.message}\nstderr: ${stderr}\nstdout: ${stdout}`
          });
        } else {
          this.logger.logToolExecution(`Command executed successfully: ${command}`);
          resolve({
            success: true,
            message: "Execution successful."
          });
        }
      });

      // Set up the timeout
      const timer = setTimeout(() => {
        child.kill(); // Terminate the child process
        this.logger.logToolStderr(`Command timed out after ${timeout / 1000} seconds: ${command}`);
        resolve({
          success: false,
          message: `Command timed out after ${timeout / 1000} seconds`
        });
      }, timeout);

      // Clear the timeout if the command completes before the timeout
      child.on('exit', () => {
        clearTimeout(timer);
      });
    });
  }

  static async runTools(workingFiles: File[], toolUsages: ToolUsage[]): Promise<{ results: ToolResults; newFiles: File[]; modifiedFiles: string[] }> {
    const results: ToolResults = {};
    let newFiles: File[] = [];
    let modifiedFiles: string[] = [];

    if (!toolUsages || toolUsages.length === 0) {
      this.logger.logMainFlow('No tool usages specified. Skipping tool execution.');
      return { results, newFiles, modifiedFiles };
    }

    for (const usage of toolUsages) {
      try {
        if (!usage.name) {
          this.logger.logToolStderr('Invalid tool usage: missing tool name');
          continue;
        }

        const resultKey = `${usage.name}|${Object.entries(usage.params || {}).map(([key, value]) => `${key}=${value}`).join(',')}`;
        
        switch (usage.name.toLowerCase()) {
          case 'movefile':
            results[resultKey] = {
              success: this.fileManager.moveFile(usage.params.source, usage.params.destination),
              message: this.fileManager.moveFile(usage.params.source, usage.params.destination) ? "File moved successfully." : "Failed to move file."
            };
            if (results[resultKey].success) {
              modifiedFiles.push(usage.params.destination);
            }
            break;
          case 'deletefile':
            results[resultKey] = {
              success: this.fileManager.deleteFile(usage.params.fileName),
              message: this.fileManager.deleteFile(usage.params.fileName) ? "File deleted successfully." : "Failed to delete file."
            };
            break;
          case 'updatefile':
            results[resultKey] = {
              success: this.fileManager.updateFile({fileName: usage.params.fileName, contentSnippet: usage.params.content}),
              message: this.fileManager.updateFile({fileName: usage.params.fileName, contentSnippet: usage.params.content}) ? "File updated successfully." : "Failed to update file."
            };
            if (results[resultKey].success) {
              modifiedFiles.push(usage.params.fileName);
            }
            break;
          case 'requestfiles':
            const files = await this.requestFiles(usage.params.filePattern);
            newFiles = [...newFiles, ...files];
            results[resultKey] = {
              success: true,
              message: `Found ${files.length} files matching pattern ${usage.params.filePattern}`
            };
            modifiedFiles.push(...files.map(file => file.fileName));
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
            this.logger.logMainFlow(`Unrecognized tool: ${usage.name}`);
        }
        this.logger.logMainFlow(`Executed ${usage.name} with reasoning: ${usage.reasoning}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results[`${usage.name}|${Object.entries(usage.params || {}).map(([key, value]) => `${key}=${value}`).join(',')}`] = {
          success: false,
          message: `Failed: ${errorMessage}`
        };
        this.logger.logToolStderr(`Error executing ${usage.name}: ${errorMessage}`);
      }
    }

    if (!fs.existsSync(path.join(this.projectRoot, 'node_modules'))) {
      try {
        this.logger.logMainFlow('Installing dependencies...');
        results['yarnInstall'] = await ToolRunner.runCommand('yarn install');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.logToolStderr(`Failed to install dependencies: ${errorMessage}`);
        results['yarnInstall'] = {
          success: false,
          message: `Failed to install dependencies: ${errorMessage}`
        };
      }
    }

    // Run standard tools
    //const standardTools = ['tsc', 'jest', 'eslint .', 'npm audit'];
    const standardTools = ['tsc', 'jest'];
    for (const tool of standardTools) {
      try {
        results[tool] = await ToolRunner.runCommand(`yarn ${tool}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results[tool] = {
          success: false,
          message: `Failed: ${errorMessage}`
        };
      }
    }

    return { results, newFiles, modifiedFiles };
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

  static async getUpdatedFiles(projectRoot: string, fileNames: string[]): Promise<File[]> {
    return Promise.all(fileNames.map(async (fileName) => {
      const filePath = path.join(projectRoot, fileName);
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return { fileName, contentSnippet: content };
      } catch (error) {
        this.logger.logToolStderr(`Failed to read file ${fileName}: ${error}`);
        return { fileName, contentSnippet: '' };
      }
    }));
  }
}