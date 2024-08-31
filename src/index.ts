import { Shraga } from './Shraga';
import { CLIInterface } from './cli/CLIInterface';
import { Logger } from './core/Logger';
import { ConfigManager } from './core/ConfigManager';

export async function main(customLogger?: Logger) {
  const cli = new CLIInterface();
  const logger = customLogger || Logger.getInstance();

  try {
    const defaultProjectRoot = '/Users/shayco/GitHub/temp-playground';
    const projectRootInput = await cli.askQuestion(`Enter the project directory (default: ${defaultProjectRoot}): `);
    const projectRoot = projectRootInput.trim() || defaultProjectRoot;

    const defaultTask = 'add performance log for every function';
    const taskDescription = await cli.askQuestion(`Enter the task description (default: "${defaultTask}"): `);
    const finalTaskDescription = taskDescription.trim() || defaultTask;

    const shraga = new Shraga(projectRoot, finalTaskDescription, { logger });
    await shraga.run();
  } catch (error) {
    logger.logToolStderr(`An error occurred: ${(error as Error).message}`);
  } finally {
    cli.close();
  }
}

if (require.main === module) {
  const configManager = ConfigManager.getInstance();
  configManager.loadConfig();
  const logConfig = configManager.getConfig();
  Logger.initialize(logConfig, process.cwd());
  
  main().catch(error => {
    console.error('Unhandled error in main process:', error);
    process.exit(1);
  });
}