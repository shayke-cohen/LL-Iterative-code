"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRunner = void 0;
const child_process_1 = require("child_process");
const FileManager_1 = require("./FileManager");
const Logger_1 = require("./Logger");
const glob_1 = __importDefault(require("glob"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class ToolRunner {
    static initialize(projectRoot) {
        this.fileManager = new FileManager_1.FileManager(projectRoot);
        this.projectRoot = projectRoot;
    }
    // For testing purposes
    static setFileManager(fileManager) {
        this.fileManager = fileManager;
    }
    static async runTools(workingFiles, toolUsages) {
        const results = {};
        let newFiles = [];
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
                        results[usage.name] = this.fileManager.updateFile({ fileName: usage.params.fileName, contentSnippet: usage.params.content }) ? 'success' : 'failed';
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
                        Logger_1.Logger.log(`Unrecognized tool: ${usage.name}`);
                }
                Logger_1.Logger.log(`Executed ${usage.name} with reasoning: ${usage.reasoning}`);
            }
            catch (error) {
                Logger_1.Logger.error(`Error executing ${usage.name}: ${error.message}`);
                results[usage.name] = `failed: ${error.message}`;
            }
        }
        // Run standard tools
        results.tsc = await this.runCommand('tsc');
        results.jest = await this.runCommand('jest');
        results.eslint = await this.runCommand('eslint .');
        results.npmAudit = await this.runCommand('npm audit');
        return { results, newFiles };
    }
    static async requestFiles(filePattern) {
        return new Promise((resolve, reject) => {
            (0, glob_1.default)(filePattern, { cwd: this.projectRoot }, (err, files) => {
                if (err) {
                    reject(err);
                }
                else {
                    const fileContents = files.map(file => ({
                        fileName: file,
                        contentSnippet: fs_1.default.readFileSync(path_1.default.join(this.projectRoot, file), 'utf-8')
                    }));
                    resolve(fileContents);
                }
            });
        });
    }
    static runCommand(command) {
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)(command, { cwd: this.projectRoot }, (error, stdout, stderr) => {
                if (error) {
                    Logger_1.Logger.error(`Command execution failed: ${command}`);
                    reject(`${error.message}\n${stderr}`);
                }
                else {
                    Logger_1.Logger.log(`Command executed successfully: ${command}`);
                    resolve(stdout);
                }
            });
        });
    }
}
exports.ToolRunner = ToolRunner;
