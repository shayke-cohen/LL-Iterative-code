import fs from 'fs';
import path from 'path';

interface HistoryEntry {
  timestamp: string;
  iteration: number;
  actionsSummary: string;
}

export class HistoryManager {
  private history: HistoryEntry[] = [];
  private filePath: string;

  constructor(projectRoot: string) {
    this.filePath = path.join(projectRoot, 'task_history.json');
  }

  clearHistory(): void {
    this.history = [];
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  addEntry(iteration: number, actionsSummary: string): void {
    const entry: HistoryEntry = {
      timestamp: new Date().toISOString(),
      iteration,
      actionsSummary
    };
    this.history.push(entry);
    this.saveHistory();
  }

  getHistory(): string[] {
    return this.history.map(entry => 
      `[${entry.timestamp}] Iteration ${entry.iteration}: ${entry.actionsSummary}`
    );
  }

  private saveHistory(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.history, null, 2));
  }
}