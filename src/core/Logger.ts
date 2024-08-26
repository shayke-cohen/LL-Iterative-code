import fs from 'fs';
import path from 'path';

class Logger {
  private static logFile: string;

  static initialize(projectRoot: string): void {
    this.logFile = path.join(projectRoot, 'app.log');
  }

  static log(message: string): void {
    const logMessage = `[${new Date().toISOString()}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(this.logFile, `${logMessage}\n`);
  }

  static error(message: string): void {
    const errorMessage = `[${new Date().toISOString()}] ERROR: ${message}`;
    console.error(errorMessage);
    fs.appendFileSync(this.logFile, `${errorMessage}\n`);
  }
}

export { Logger };