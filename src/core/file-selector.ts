import * as fs from 'fs';
import * as path from 'path';
import { runPrompt } from './runPrompt';
import { 
  findFilesByName, 
  findFilesByContent, 
  findImportedFiles, 
  findRelatedTests, 
  findComponentUsage, 
  findAPIUsage, 
  findStyleDependencies,
  findFunctionDefinition,
  findDependencies,
  findRecentlyModifiedFiles,
  findRelatedClasses
} from './tools';
import { Logger } from './Logger';
const logger = Logger.getInstance();

interface FileInfo {
  name: string;
  content: string;
  size: number;
  isTypeDefinition: boolean;
  isExternalModule: boolean;
  score?: number;
}

interface Tool {
  name: string;
  params: Record<string, any>;
}

interface LLMResponse {
  allFilesFound: boolean;
  tools: Tool[];
  relevantFiles: Array<{ name: string, score: number }>;
  reasoning: string;
}

async function getProjectStructure(dir: string, indent: string = '', isLast: boolean = true): Promise<string> {
  const baseName = path.basename(dir);
  let structure = `${indent}${isLast ? '└── ' : '├── '}${baseName}/\n`;

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const directories = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules');
  const files = entries.filter(entry => entry.isFile());

  directories.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  for (let i = 0; i < directories.length; i++) {
    const directory = directories[i];
    const isLastDirectory = (i === directories.length - 1) && (files.length === 0);
    const newIndent = indent + (isLast ? '    ' : '│   ');
    structure += await getProjectStructure(path.join(dir, directory.name), newIndent, isLastDirectory);
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isLastFile = i === files.length - 1;
    structure += `${indent}${isLast ? '    ' : '│   '}${isLastFile ? '└── ' : '├── '}${file.name}\n`;
  }

  return structure;
}

async function findExternalDependency(moduleName: string, workingDir: string): Promise<FileInfo[]> {
  logger.logMainFlow(`Searching for external dependency: ${moduleName}`);

  if (!moduleName) {
    logger.logToolStderr("Module name is undefined in findExternalDependency");
    return [];
  }

  const possiblePaths = [
    path.join(workingDir, 'node_modules', moduleName, 'index.js'),
    path.join(workingDir, 'node_modules', moduleName, 'index.d.ts'),
    path.join(workingDir, 'node_modules', '@types', moduleName, 'index.d.ts'),
  ];

  logger.logMainFlow(`Checking paths for ${moduleName}: ${JSON.stringify(possiblePaths)}`);

  const existingPaths = await Promise.all(
    possiblePaths.map(async (p) => {
      try {
        const stats = await fs.promises.stat(p);
        if (stats.isFile()) {
          const content = await fs.promises.readFile(p, 'utf-8');
          logger.logMainFlow(`Found file for ${moduleName}: ${p}`);
          return {
            name: path.relative(workingDir, p),
            content,
            size: stats.size,
            isTypeDefinition: p.endsWith('.d.ts'),
            isExternalModule: true
          };
        }
      } catch (error) {
        // Only log errors for paths we expect to exist
        if (p.includes('@types') || p.endsWith('index.js')) {
          logger.logToolStderr(`Error checking expected path ${p} for ${moduleName}: ${error}`);
        }
      }
      return null;
    })
  );

  const result = existingPaths.filter((file): file is FileInfo => file !== null);
  logger.logMainFlow(`findExternalDependency for ${moduleName} returning ${result.length} files`);
  return result;
}

async function findAndReadFile(fileName: string, workingDir: string): Promise<FileInfo | null> {
  const filePath = path.join(workingDir, fileName);
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.isFile()) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return {
        name: fileName,
        content,
        size: stats.size,
        isTypeDefinition: fileName.endsWith('.d.ts'),
        isExternalModule: false // Assuming local files are not external modules
      };
    }
  } catch (error) {
    console.log(`File not found or cannot be read: ${fileName}`);
  }
  return null;
}

async function selectRelevantFiles(
  task: string, 
  projectStructure: string, 
  maxIterations: number, 
  maxFiles: number, 
  maxTotalSize: number,
  workingDir: string = process.cwd()
): Promise<FileInfo[]> {
  let relevantFiles: FileInfo[] = [];
  let iteration = 0;
  let totalSize = 0;
  const logger = Logger.getInstance();
  const seenFiles = new Set<string>();

  while (iteration < maxIterations) {
    const llmResponse = await callLLM(task, relevantFiles, projectStructure);

    logger.logMainFlow(`Iteration ${iteration + 1} all files found: ${llmResponse.allFilesFound}`);
    logger.logMainFlow(`Iteration ${iteration + 1} reasoning:\n${llmResponse.reasoning}`);
    logger.logMainFlow(`Iteration ${iteration + 1} relevant files:\n${JSON.stringify(llmResponse.relevantFiles, null, 2)}`);

    if (llmResponse.allFilesFound) {
      logger.logMainFlow("LLM indicates all files have been found.");
      break;
    }

    for (const tool of llmResponse.tools) {
      try {
        const newFiles = await executeTool(tool, workingDir);
        for (const file of newFiles) {
          if (!seenFiles.has(file.name) && relevantFiles.length < maxFiles) {
            if (totalSize + file.size <= maxTotalSize) {
              relevantFiles.push(file);
              seenFiles.add(file.name);
              totalSize += file.size;
            } else {
              logger.logMainFlow(`Skipping file due to size limit: ${file.name}`);
            }
          }
        }
      } catch (error) {
        logger.logToolStderr(`Error executing tool ${tool.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Handle potential files suggested by LLM
    for (const suggestedFile of llmResponse.relevantFiles) {
      if (!seenFiles.has(suggestedFile.name)) {
        try {
          const fileInfo = await findAndReadFile(suggestedFile.name, workingDir);
          if (fileInfo && relevantFiles.length < maxFiles) {
            if (totalSize + fileInfo.size <= maxTotalSize) {
              relevantFiles.push({
                ...fileInfo,
                score: suggestedFile.score
              });
              seenFiles.add(fileInfo.name);
              totalSize += fileInfo.size;
            } else {
              logger.logMainFlow(`Skipping file due to size limit: ${fileInfo.name}`);
            }
          } else if (!fileInfo) {
            // Handle potential new files
            logger.logMainFlow(`Potential new file suggested by LLM: ${suggestedFile.name} (Score: ${suggestedFile.score})`);
            relevantFiles.push({
              name: suggestedFile.name,
              content: `// Potential new file for: ${task}`,
              size: 0,
              score: suggestedFile.score,
              isExternalModule: false,
              isTypeDefinition: suggestedFile.name.endsWith('.d.ts')
            });
            seenFiles.add(suggestedFile.name);
          }
        } catch (error) {
          logger.logToolStderr(`Error processing suggested file ${suggestedFile.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    iteration++;
  }

  // Sort relevantFiles by score in descending order
  relevantFiles.sort((a, b) => ((b.score || 0) - (a.score || 0)));

  return relevantFiles;
}

async function callLLM(task: string, relevantFiles: FileInfo[], projectStructure: string): Promise<LLMResponse> {
  const prompt = constructPrompt(task, relevantFiles, projectStructure);
  const response = await sendPromptToLLM(prompt);
  return parseLLMResponse(response);
}

function constructPrompt(task: string, relevantFiles: FileInfo[], projectStructure: string): Record<string, any> {
  return {
    task,
    relevantFiles: relevantFiles.map(file => ({
      name: file.name,
      content: file.content.substring(0, 2000),
      isTypeDefinition: file.isTypeDefinition,
      isExternalModule: file.isExternalModule
    })),
    projectStructure,
    instructions: `
      Analyze the task and suggest tools to find relevant files. Include previously found files in your response.
      Pay special attention to:
      - Class relationships and type definitions
      - External module imports and their type definitions
      - Inheritance hierarchy and composition of classes

      Important guidelines:
      1. Identify and include type definition files (.d.ts) for external modules.
      2. For each import statement found (e.g., 'import WebSocket from 'ws';'), use the findExternalDependency tool to locate its type definitions.
      3. Assign relevance scores (1-10) to all files, including type definitions.
      4. Sort the relevantFiles list by relevance score in descending order.
      5. Provide reasoning for each file's inclusion and its relevance score.
      6. Focus on files directly relevant to the task, including necessary type definitions from node_modules.

      Your response MUST be a valid JSON object with the following structure: 
      { 
        allFilesFound: boolean, 
        tools: Array<{ name: string, params: object }>, 
        relevantFiles: Array<{ name: string, score: number }>, 
        reasoning: "file1 (Score: 9): reason1\nfile2 (Score: 8): reason2\nfile3 (Score: 3): reason3"
      }
    `,
    availableTools: [
      { name: "findFilesByName", description: "Find files with a specific name or pattern" },
      { name: "findFilesByContent", description: "Find files containing specific text or pattern" },
      { name: "findImportedFiles", description: "Find files imported by other files (TypeScript/JavaScript/JSX)" },
      { name: "findRelatedTests", description: "Find related test files for a given file" },
      { name: "findComponentUsage", description: "Find files where a specific component is used" },
      { name: "findAPIUsage", description: "Find files that use a specific API endpoint" },
      { name: "findStyleDependencies", description: "Find style files (CSS, SCSS) related to a component" },
      { name: "findFunctionDefinition", description: "Find the file where a specific function is defined" },
      { name: "findDependencies", description: "Find dependencies of a specific file" },
      { name: "findRecentlyModifiedFiles", description: "Find files that were recently modified" },
      { name: "findRelatedClasses", description: "Find related classes and files that are imported or extended by a given file" },
      { name: "findExternalDependency", description: "Find type definitions for external module imports" }
    ]
  };
}

async function sendPromptToLLM(prompt: Record<string, any>): Promise<string> {
  return getCompletion(JSON.stringify(prompt));
}

async function getCompletion(prompt: string, model: 'gpt-4o' | 'gemini' = 'gpt-4o'): Promise<string> {
  try {
    const response = await runPrompt({
      prompt,
      imagePath: undefined,
      useCache: true,
      taskDescription: '',
      model
    });

    if (!response) {
      console.log(`Failed to get response from the LLM - prompt size ${prompt.length}`);
      throw new Error('Failed to get response from the LLM');
    }

    return response;
  } catch (error) {
    console.log(`Error getting LLM response - prompt size ${prompt.length}`);
    console.log(`Error getting LLM response: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

function parseLLMResponse(response: string): LLMResponse {
  try {
    return JSON.parse(response);
  } catch (error) {
    console.warn('Failed to parse LLM response as JSON. Attempting to clean the response.');

    try {
      const cleanedResponse = response.replace(/"reasoning": "(.*?)"/gs, (match, p1) => {
        return `"reasoning": "${p1.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;
      });

      return JSON.parse(cleanedResponse);
    } catch (cleanError) {
      console.error('Failed to clean and parse LLM response:', cleanError);
      throw new Error('Invalid JSON response from LLM after cleaning attempt');
    }
  }
}

async function executeTool(tool: Tool, workingDir: string): Promise<FileInfo[]> {
  logger.logToolExecution(`Executing tool: ${tool.name} with params: ${JSON.stringify(tool.params)}`);
  try {
    const result = await executeToolForFileNames(tool, workingDir);
    logger.logToolExecution(`Tool ${tool.name} executed successfully, returning ${result.length} files`);
    return result;
  } catch (error) {
    logger.logToolExecution(`Tool ${tool.name} execution failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}


async function executeToolForFileNames(tool: Tool, workingDir: string): Promise<FileInfo[]> {
  try {
    
    logger.logMainFlow(`executeToolForFileNames called with tool: ${JSON.stringify(tool)}, workingDir: ${workingDir}`);

    switch (tool.name) {
      case "findFilesByName":
        logger.logToolExecution(`Executing findFilesByName with pattern: ${tool.params.pattern}`);
        const files = await findFilesByName(tool.params.pattern, workingDir);
        return files.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findFilesByContent":
        logger.logToolExecution(`Executing findFilesByContent with pattern: ${tool.params.pattern}`);
        const contentFiles = await findFilesByContent(tool.params.pattern, workingDir);
        return contentFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findImportedFiles":
        logger.logToolExecution(`Executing findImportedFiles with file: ${tool.params.file}`);
        const importedFiles = await findImportedFiles(path.join(workingDir, tool.params.file), workingDir);
        return importedFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findRelatedTests":
        logger.logToolExecution(`Executing findRelatedTests with file: ${tool.params.file}`);
        const testFiles = await findRelatedTests(path.join(workingDir, tool.params.file), workingDir);
        return testFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findComponentUsage":
        logger.logToolExecution(`Executing findComponentUsage with component: ${tool.params.component}`);
        const usageFiles = await findComponentUsage(tool.params.component, workingDir);
        return usageFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findAPIUsage":
        logger.logToolExecution(`Calling findAPIUsage with endpoint: ${tool.params.endpoint}`);
        const apiUsageFiles = await findAPIUsage(tool.params.endpoint, workingDir);
        return apiUsageFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findStyleDependencies":
        logger.logToolExecution(`Executing findStyleDependencies with component: ${tool.params.component}`);
        const styleFiles = await findStyleDependencies(tool.params.component, workingDir);
        return styleFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findFunctionDefinition":
        logger.logToolExecution(`Executing findFunctionDefinition with functionName: ${tool.params.functionName}`);
        const functionFiles = await findFunctionDefinition(tool.params.functionName, workingDir);
        return functionFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findDependencies":
        logger.logToolExecution(`Executing findDependencies with file: ${tool.params.file}`);
        const dependencyFiles = await findDependencies(path.join(workingDir, tool.params.file), workingDir);
        return dependencyFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findRecentlyModifiedFiles":
        logger.logToolExecution(`Executing findRecentlyModifiedFiles with days: ${tool.params.days}`);
        const recentFiles = await findRecentlyModifiedFiles(tool.params.days, workingDir);
        return recentFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
      case "findRelatedClasses":
        logger.logToolExecution(`Executing findRelatedClasses with file: ${tool.params.file}`);
        const relatedClassFiles = await findRelatedClasses(tool.params.file, workingDir);
        return relatedClassFiles.map(file => ({ name: file, content: '', size: 0, isTypeDefinition: false, isExternalModule: false }));
        case "findExternalDependency":
        logger.logToolExecution(`Executing findExternalDependency with module: ${tool.params.module}`);
        if (!tool.params.module) {
          logger.logToolStderr("Module name is undefined for findExternalDependency");
          return [];
        }
          return findExternalDependency(tool.params.module, workingDir);
      default:
        throw new Error(`Unknown tool: ${tool.name}`);
    }
  } catch (error) {
    logger.logToolStderr(`Error executing tool ${tool.name}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

export { selectRelevantFiles, getProjectStructure };