import { Shraga, ShragaConfig } from '../src/Shraga';
import { Logger } from '../src/core/Logger';
import { ToolRunner } from '../src/core/ToolRunner';
import { RealLLM } from '../src/core/RealLLM';
import { selectRelevantFiles, getProjectStructure } from '../src/core/file-selector';
import * as path from 'path';

jest.mock('../src/core/Logger');
jest.mock('../src/core/ToolRunner');
jest.mock('../src/core/RealLLM');
jest.mock('../src/core/file-selector');

describe('Shraga', () => {
  let shraga: Shraga;
  let mockLogger: jest.Mocked<Logger>;
  let mockConfig: ShragaConfig;

  beforeEach(() => {
    mockLogger = {
      logMainFlow: jest.fn(),
      logToolStderr: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    mockConfig = {
      maxIterations: 5,
      maxFiles: 10,
      maxTotalSize: 50000,
      logger: mockLogger,
    };

    shraga = new Shraga('/test/project', 'Test task', mockConfig);

    (ToolRunner.initialize as jest.Mock).mockClear();
    (selectRelevantFiles as jest.Mock).mockClear();
    (getProjectStructure as jest.Mock).mockClear();
    (RealLLM.prototype.generateCode as jest.Mock).mockClear();
    (RealLLM.prototype.analyzeResults as jest.Mock).mockClear();
  });

  test('should initialize components correctly', async () => {
    (selectRelevantFiles as jest.Mock).mockResolvedValue([]);
    (RealLLM.prototype.generateCode as jest.Mock).mockResolvedValue({ toolUsages: [] });
    (RealLLM.prototype.analyzeResults as jest.Mock).mockResolvedValue({ isTaskComplete: true });

    await shraga.run();

    expect(ToolRunner.initialize).toHaveBeenCalledWith(path.resolve('/test/project'));
    expect(mockLogger.logMainFlow).toHaveBeenCalledWith(expect.stringContaining('Using project directory:'));
  });

  test('should select relevant files', async () => {
    (getProjectStructure as jest.Mock).mockResolvedValue('mock project structure');
    (selectRelevantFiles as jest.Mock).mockResolvedValue([
      { name: 'file1.ts', content: 'content1', size: 100 },
      { name: 'file2.ts', content: 'content2', size: 200 },
    ]);
    (RealLLM.prototype.generateCode as jest.Mock).mockResolvedValue({ toolUsages: [] });
    (RealLLM.prototype.analyzeResults as jest.Mock).mockResolvedValue({ isTaskComplete: true });

    await shraga.run();

    expect(selectRelevantFiles).toHaveBeenCalledWith(
      'Test task',
      'mock project structure',
      5,
      10,
      50000,
      path.resolve('/test/project')
    );
  });

  test('should handle errors gracefully', async () => {
    const errorMessage = 'Test error';
    (ToolRunner.initialize as jest.Mock).mockImplementation(() => {
      throw new Error(errorMessage);
    });

    await expect(shraga.run()).rejects.toThrow(errorMessage);
    expect(mockLogger.logToolStderr).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
  });

  // Add more tests for other methods and scenarios
});