import { TaskInitializer, Task, File } from './core/TaskInitializer';
import { LLMInterface, ToolResults, LLMResponse } from './core/LLMInterface';
import { ToolRunner } from './core/ToolRunner';
import { IterationController } from './core/IterationController';
import { Logger } from './core/Logger';
import { HistoryManager } from './core/HistoryManager';
import { CLIInterface } from './cli/CLIInterface';
import { RealLLM } from './core/RealLLM';
import * as path from 'path';
import * as fs from 'fs';

async function ensureProjectSetup(projectRoot: string): Promise<void> {
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    console.log('No tsconfig.json found. Creating a basic configuration...');
    const basicTsConfig = {
      compilerOptions: {
        target: "es2018",
        module: "commonjs",
        strict: true,
        esModuleInterop: true,
        outDir: "./dist",
        rootDir: "./src"
      },
      include: ["src/**/*", "*.ts"],
      exclude: ["node_modules", "**/*.test.ts"]
    };
    fs.writeFileSync(tsconfigPath, JSON.stringify(basicTsConfig, null, 2));
  }

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    console.log('No package.json found. Creating a basic package configuration...');
    const basicPackageJson = {
      name: "typescript-project",
      version: "1.0.0",
      main: "index.js",
      license: "MIT",
      scripts: {
        build: "tsc",
        test: "jest",
        lint: "eslint ."
      },
      devDependencies: {
        typescript: "^4.5.4",
        "@types/node": "^16.11.12",
        "eslint": "^8.0.0",
        "jest": "^27.0.0",
        "@types/jest": "^27.0.0",
        "ts-jest": "^27.0.0"
      }
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(basicPackageJson, null, 2));
  }

  const eslintConfigPath = path.join(projectRoot, 'eslint.config.js');
  if (!fs.existsSync(eslintConfigPath)) {
    console.log('No eslint.config.js found. Creating a basic ESLint configuration...');
    const basicEslintConfig = `
module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {},
};
`;
    fs.writeFileSync(eslintConfigPath, basicEslintConfig);
  }

  const jestConfigPath = path.join(projectRoot, 'jest.config.js');
  if (!fs.existsSync(jestConfigPath)) {
    console.log('No jest.config.js found. Creating a basic Jest configuration...');
    const basicJestConfig = `
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
};
`;
    fs.writeFileSync(jestConfigPath, basicJestConfig);
  }

  console.log('Ensuring src directory exists...');
  const srcDir = path.join(projectRoot, 'src');
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir);
  }

  console.log('Project setup completed.');
}


async function main() {
  const cli = new CLIInterface();
  
  // Ask for the project directory with /tmp as the default
  const defaultProjectRoot = '/Users/shayco/GitHub/temp';
  const projectRootInput = await cli.askQuestion(`Enter the project directory (default: ${defaultProjectRoot}): `);
  const projectRoot = projectRootInput.trim() || defaultProjectRoot;

  // Resolve the absolute path
  const absoluteProjectRoot = path.resolve(projectRoot);

  console.log(`Using project directory: ${absoluteProjectRoot}`);

  await ensureProjectSetup(absoluteProjectRoot);

  Logger.initialize(projectRoot);
  ToolRunner.initialize(projectRoot);

  const llm = new RealLLM();
  const iterationController = new IterationController(10);
  const historyManager = new HistoryManager(projectRoot);

  // Clear the history before beginning
  historyManager.clearHistory();

  // Ask for the task description
  const defaultTask = "add more logs, improve code and fix issues and bugs";
  const taskDescription = await cli.askQuestion(`Enter the task description (default: "${defaultTask}"): `);
  const finalTaskDescription = taskDescription.trim() || defaultTask;

  const task: Task = TaskInitializer.initialize(
    'add a todo list react app with typescript and jest',
    [{ fileName: 'example.ts', contentSnippet: '// TODO: Implement function' }],
    [{ fileName: 'example.ts', contentSnippet: '// TODO: Implement function' }],
    projectRoot,
    true
  );

  try {
    let isTaskComplete = false;
    const llm = new RealLLM();
    while (iterationController.shouldContinue(isTaskComplete)) {
      iterationController.incrementIteration();
      Logger.log(`Starting iteration ${iterationController.getCurrentIteration()}`);

      // Re-read relevant and working files from disk
      task.relevantFiles = await readFilesFromDisk(task.relevantFiles.map(file => file.fileName), projectRoot);
      task.workingFiles = await readFilesFromDisk(task.workingFiles.map(file => file.fileName), projectRoot);

      // Code Generation Phase
      const codeGeneration = await llm.generateCode(task, {});

      // Run tools including LLM-suggested actions
      const { results: toolResults, newFiles } = await ToolRunner.runTools(task.workingFiles, codeGeneration.toolUsages);

      // Update relevant and working files
      const updatedFiles = await updateFileList(task.relevantFiles, newFiles, projectRoot);
      task.relevantFiles = updatedFiles;
      task.workingFiles = updatedFiles;

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
        
        continue; // Restart the iteration after getting answers
      }

      // Clear additional clarifications for the next iteration
      llm.setAdditionalClarifications([]);

      // Update history with action summary
      historyManager.addEntry(iterationController.getCurrentIteration(), codeGeneration.actionsSummary);

      // Analysis Phase (always run)
      const analysis = await llm.analyzeResults(task, toolResults);

      // Check if task is complete after analysis
      if (analysis.isTaskComplete) {
        Logger.log(`Task completed successfully after analysis. Reason: ${analysis.completionReason}`);
        isTaskComplete = true;
        break;
      }

      // Run any additional tools suggested in the analysis phase
      if (analysis.toolUsages.length > 0) {
        const { results: additionalResults, newFiles: additionalFiles } = await ToolRunner.runTools(task.workingFiles, analysis.toolUsages);
        Object.assign(toolResults, additionalResults);
        
        // Update relevant and working files again if necessary
        const updatedFilesAfterAnalysis = await updateFileList(task.relevantFiles, additionalFiles, projectRoot);
        task.relevantFiles = updatedFilesAfterAnalysis;
        task.workingFiles = updatedFilesAfterAnalysis;
      }

      // Update history with analysis summary
      historyManager.addEntry(iterationController.getCurrentIteration(), analysis.actionsSummary);
    }

    if (!isTaskComplete && iterationController.getCurrentIteration() >= 10) {
      Logger.log('Maximum iterations reached. Task may not be complete.');
    }

  } catch (error) {
    Logger.error(`An error occurred: ${(error as Error).message}`);
  } finally {
    cli.close();
  }
}

// Helper function to read files from disk
async function readFilesFromDisk(fileNames: string[], projectRoot: string): Promise<File[]> {
  return Promise.all(fileNames.map(async (fileName) => {
    const filePath = path.join(projectRoot, fileName);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return { fileName, contentSnippet: content };
  }));
}

// Helper function to update file list
async function updateFileList(existingFiles: File[], newFiles: File[], projectRoot: string): Promise<File[]> {
  const updatedFileNames = new Set([...existingFiles, ...newFiles].map(file => file.fileName));
  return readFilesFromDisk(Array.from(updatedFileNames), projectRoot);
}

main();