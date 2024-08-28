import fs from 'fs';
import path from 'path';

export interface LogConfig {
  llm: {
    requests: boolean;
    responses: boolean;
  };
  tools: {
    execution: boolean;
    stdout: boolean;
    stderr: boolean;
  };
  main: {
    flow: boolean;
    iterationProgress: boolean;
  };
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

const defaultLogConfig: LogConfig = {
  llm: {
    requests: true,
    responses: true,
  },
  tools: {
    execution: true,
    stdout: false,
    stderr: true,
  },
  main: {
    flow: true,
    iterationProgress: true,
  },
  logLevel: 'info',
};

export class ConfigManager {
  private static instance: ConfigManager;
  private config: LogConfig;

  private constructor() {
    this.config = defaultLogConfig;
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  loadConfig(): void {
    const configPath = path.join(process.cwd(), 'log-config.json');
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      this.config = { ...defaultLogConfig, ...userConfig };
      console.log(`Loaded configuration from ${configPath}`);
    } catch (error) {
      console.error(`Error loading config file: ${error}. Using default configuration.`);
    }
  }

  getConfig(): LogConfig {
    return this.config;
  }
}