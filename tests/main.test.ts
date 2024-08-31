import { main } from '../src/index';
import { CLIInterface } from '../src/cli/CLIInterface';
import { Shraga } from '../src/Shraga';
import { Logger } from '../src/core/Logger';

jest.mock('../src/cli/CLIInterface');
jest.mock('../src/Shraga');
jest.mock('../src/core/Logger');

describe('main function', () => {
  let mockCLI: jest.Mocked<CLIInterface>;
  let mockShraga: jest.Mocked<Shraga>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockCLI = {
      askQuestion: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<CLIInterface>;

    mockShraga = {
      run: jest.fn(),
    } as unknown as jest.Mocked<Shraga>;

    mockLogger = {
      logMainFlow: jest.fn(),
      logToolStderr: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    (CLIInterface as jest.Mock).mockImplementation(() => mockCLI);
    (Shraga as unknown as jest.Mock).mockImplementation(() => mockShraga);
    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);
  });

  test('should run Shraga with user input', async () => {
    mockCLI.askQuestion.mockResolvedValueOnce('/test/project')
      .mockResolvedValueOnce('Test task');

    await main(mockLogger);

    expect(mockCLI.askQuestion).toHaveBeenCalledTimes(2);
    expect(Shraga).toHaveBeenCalledWith('/test/project', 'Test task', expect.objectContaining({ logger: mockLogger }));
    expect(mockShraga.run).toHaveBeenCalled();
    expect(mockCLI.close).toHaveBeenCalled();
  });

  test('should use default values if user input is empty', async () => {
    mockCLI.askQuestion.mockResolvedValueOnce('')
      .mockResolvedValueOnce('');

    await main(mockLogger);

    expect(Shraga).toHaveBeenCalledWith(
      '/Users/shayco/GitHub/temp-playground',
      'add performance log for every function',
      expect.objectContaining({ logger: mockLogger })
    );
  });

  test('should handle errors', async () => {
    const errorMessage = 'Test error';
    mockCLI.askQuestion.mockResolvedValueOnce('/test/project')
      .mockResolvedValueOnce('Test task');
    mockShraga.run.mockRejectedValue(new Error(errorMessage));

    await main(mockLogger);

    expect(mockLogger.logToolStderr).toHaveBeenCalledWith(expect.stringContaining(errorMessage));
  });
});