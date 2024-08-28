import { ConfigManager } from './ConfigManager';
import { Logger } from './Logger';

// Initialize ConfigManager and Logger
const configManager = ConfigManager.getInstance();
configManager.loadConfig();
const logConfig = configManager.getConfig();
Logger.initialize(logConfig, process.cwd());

export const logger = Logger.getInstance();