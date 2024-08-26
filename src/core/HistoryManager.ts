import fs from 'fs';
import path from 'path';

class HistoryManager {
  private history: string[] = [];
  private filePath: string;

  constructor(projectRoot: string) {
    this.filePath = path.join(projectRoot, 'task_history.txt');
  }

  addEntry(entry: string): void {
    this.history.push(entry);
    this.writeToFile(entry);
  }

  getHistory(): string[] {
    return this.history;
  }

  private writeToFile(entry: string): void {
    fs.appendFileSync(this.filePath, `${entry}\n`);
  }
}

export { HistoryManager };