// file-selector.ts

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

export async function getProjectStructure(dir: string, indent: string = '', isLast: boolean = true): Promise<string> {
  const baseName = path.basename(dir);
  let structure = `${indent}${isLast ? '└── ' : '├── '}${baseName}/\n`;

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const directories = entries.filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules');
  const files = entries.filter(entry => entry.isFile());

  // Sort directories and files alphabetically
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

interface FileInfo {
  name: string;
  content: string;
  size: number;
  score?: number;
}

interface LLMResponse {
  allFilesFound: boolean;
  tools: Tool[];
  relevantFiles: Array<{ name: string, score: number }>;
  reasoning: string;
}

interface Tool {
  name: string;
  params: Record<string, any>;
}

interface FileInfo {
  name: string;
  content: string;
  size: number;
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
          if (!relevantFiles.some(f => f.name === file.name) && relevantFiles.length < maxFiles) {
            if (totalSize + file.size <= maxTotalSize) {
              relevantFiles.push(file);
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
      if (!relevantFiles.some(f => f.name === suggestedFile.name)) {
        try {
          const fileInfo = await findAndReadFile(suggestedFile.name, workingDir);
          if (fileInfo && relevantFiles.length < maxFiles) {
            if (totalSize + fileInfo.size <= maxTotalSize) {
              relevantFiles.push({
                ...fileInfo,
                score: suggestedFile.score
              });
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
              score: suggestedFile.score
            });
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

async function getFileInfo(fileName: string, workingDir: string): Promise<FileInfo | null> {
  try {
    const fullPath = path.join(workingDir, fileName);
    const stats = await fs.promises.stat(fullPath);
    if (stats.isFile()) {
      const content = await fs.promises.readFile(fullPath, 'utf-8');
      return {
        name: fileName,
        content,
        size: stats.size
      };
    }
  } catch (error) {
    console.error(`Error getting file info for ${fileName}:`, error instanceof Error ? error.message : String(error));
  }
  return null;
}


async function findAndReadFile(fileName: string, workingDir: string): Promise<FileInfo | null> {
  // List of Node.js built-in modules
  const builtinModules = ['fs', 'path', 'child_process', 'http', 'https', 'url', 'util', 'events', 'stream', 'crypto'];

  if (builtinModules.includes(fileName.replace('.ts', ''))) {
    console.log(`${fileName} is a built-in Node.js module and doesn't exist as a separate file.`);
    return {
      name: fileName,
      content: `// This is a built-in Node.js module`,
      size: 0
    };
  }

  const ignoreDirs = ['node_modules', '.git', 'dist', 'build'];
  
  async function searchDir(dir: string): Promise<string | null> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!ignoreDirs.includes(entry.name)) {
          const found = await searchDir(fullPath);
          if (found) return found;
        }
      } else if (entry.isFile() && entry.name === path.basename(fileName)) {
        return fullPath;
      }
    }
    
    return null;
  }

  const filePath = await searchDir(workingDir);
  
  if (filePath) {
    const stats = await fs.promises.stat(filePath);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return {
      name: path.relative(workingDir, filePath),
      content,
      size: stats.size
    };
  }

  console.log(`File not found: ${fileName}`);
  return null;
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
        content: file.content.substring(0, 2000) // Limit content to first 1000 characters
      })),
      projectStructure,
      instructions: `
        Analyze the task and suggest tools to find relevant files. Include previously found files in your response.
        Pay special attention to class relationships:
        - For any TypeScript (.ts) files found, use the findRelatedClasses tool to identify base classes, imported classes, and any classes that extend from them.
        - Consider the inheritance hierarchy and composition of classes when determining relevance.
        
        Important:
        - Include in your relevantFiles list any files that you believe might be relevant, even if they haven't been confirmed to exist yet.
        - Assign a relevance score to each file on a scale of 1 to 10, where 10 is the highest relevance to the task. Include this score in your relevantFiles list.
        - Sort the relevantFiles list by relevance score in descending order.
        - Ignore files that are provided by node.js (e.g., fs, path, http, etc.) as they are built-in modules.
        - Ignore files in the node_modules directory, as they are dependencies.
        - Ignore files that are not in the project directory.
        
        If all necessary files are found, indicate so. Provide detailed reasoning for your choices, explaining why each file or class is relevant to the task and justify the relevance score you've assigned. 
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
        { name: "findRelatedClasses", description: "Find related classes and files that are imported or extended by a given file" }
      ]
    };
  }

async function sendPromptToLLM(prompt: Record<string, any>): Promise<string> {
  //console.log('Sending prompt to LLM:', JSON.stringify(prompt, null, 2));

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
    
    //console.log('LLM response:', response);

    return response;
  } catch (error) {
    console.log(`Error getting LLM response - prompt size ${prompt.length}`);
    console.log(`Error getting LLM response: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

function parseLLMResponse(response: string): LLMResponse {
  try {
    // First, try to parse the response as-is
    return JSON.parse(response);
  } catch (error) {
    console.warn('Failed to parse LLM response as JSON. Attempting to clean the response.');

    try {
      // Remove any line breaks from the reasoning field
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
  try {
    const fileNames = await executeToolForFileNames(tool, workingDir);
    const fileInfos: FileInfo[] = [];
    for (const fileName of fileNames) {
      try {
        const fileInfo = await findAndReadFile(path.basename(fileName), workingDir);
        if (fileInfo) {
          fileInfos.push(fileInfo);
        }
      } catch (error) {
        console.error(`Error processing file ${fileName}:`, error instanceof Error ? error.message : String(error));
      }
    }
    return fileInfos;
  } catch (error) {
    console.error(`Error executing tool ${tool.name}:`, error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function executeToolForFileNames(tool: Tool, workingDir: string): Promise<string[]> {
  switch (tool.name) {
    case "findFilesByName":
      return findFilesByName(tool.params.pattern, workingDir);
    case "findFilesByContent":
      return findFilesByContent(tool.params.pattern, workingDir);
    case "findImportedFiles":
      return findImportedFiles(path.join(workingDir, tool.params.file), workingDir);
    case "findRelatedTests":
      return findRelatedTests(path.join(workingDir, tool.params.file), workingDir);
    case "findComponentUsage":
      return findComponentUsage(tool.params.component, workingDir);
    case "findAPIUsage":
      return findAPIUsage(tool.params.endpoint, workingDir);
    case "findStyleDependencies":
      return findStyleDependencies(tool.params.component, workingDir);
    case "findFunctionDefinition":
      return findFunctionDefinition(tool.params.functionName, workingDir);
    case "findDependencies":
      return findDependencies(path.join(workingDir, tool.params.file), workingDir);
    case "findRecentlyModifiedFiles":
      return findRecentlyModifiedFiles(tool.params.days, workingDir);
    case "findRelatedClasses":
      return findRelatedClasses(tool.params.file, workingDir);
    default:
      throw new Error(`Unknown tool: ${tool.name}`);
  }
}

export { selectRelevantFiles };