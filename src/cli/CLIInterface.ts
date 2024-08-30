import readline from 'readline';
import { logger } from '../core/initLogger';

export class CLIInterface {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      //logger.logMainFlow(`CLI asking: ${question}`);
      this.rl.question(`${question} `, (answer) => {
        //logger.logMainFlow(`CLI received answer: ${answer}`);
        resolve(answer);
      });
    });
  }

  close(): void {
    this.rl.close();
  }
}