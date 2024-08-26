import { ToolRunner } from '../src/core/ToolRunner';
import { FileManager } from '../src/core/FileManager';
import { Logger } from '../src/core/Logger';
import { File } from '../src/core/TaskInitializer';
import { ToolUsage } from '../src/core/LLMInterface';
import { jest } from '@jest/globals';

jest.mock('../src/core/FileManager');
jest.mock('../src/core/Logger');

const MockedFileManager = jest.mocked(FileManager);

describe('ToolRunner', () => {
  let mockFileManagerInstance: jest.Mocked<FileManager>;

  beforeAll(() => {
    mockFileManagerInstance = {
      updateFile: jest.fn().mockReturnValue(true),
      moveFile: jest.fn().mockReturnValue(true),
      deleteFile: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<FileManager>;

    MockedFileManager.mockImplementation(() => mockFileManagerInstance);
    ToolRunner.initialize('/test/project/root');

    // Mock the runCommand method
    jest.spyOn(ToolRunner, 'runCommand').mockImplementation(async (command: string) => {
      return `Mocked output for command: ${command}`;
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    MockedFileManager.mockClear();
  });

  test('should run tools and return results', async () => {
    const workingFiles: File[] = [
      { fileName: 'test.ts', contentSnippet: 'console.log("test");' }
    ];

    const toolUsages: ToolUsage[] = [
      {
        name: 'updateFile',
        params: { fileName: 'test.ts', content: 'console.log("updated");' },
        reasoning: 'Update file content'
      },
      {
        name: 'yarnInstall',
        params: {},
        reasoning: 'Install dependencies'
      }
    ];

    const { results, newFiles } = await ToolRunner.runTools(workingFiles, toolUsages);

    expect(results.updateFile).toBe('success');
    expect(results.yarnInstall).toBe('Mocked output for command: yarn install');
    expect(results.tsc).toBe('Mocked output for command: tsc');
    expect(results.jest).toBe('Mocked output for command: jest');
    expect(results.eslint).toBe('Mocked output for command: eslint .');
    expect(results.npmAudit).toBe('Mocked output for command: npm audit');
    expect(newFiles).toHaveLength(0);
    
    expect(mockFileManagerInstance.updateFile).toHaveBeenCalledWith({
      fileName: 'test.ts',
      contentSnippet: 'console.log("updated");'
    });
  });

  // Add more tests for other tool usages
});