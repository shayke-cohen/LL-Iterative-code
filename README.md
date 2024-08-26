# LLM Iterative Code Generation

This project implements an iterative code generation system using a Language Model (LLM). It generates, refines, and validates code iteratively by integrating various development tools, including compilers, linters, testing frameworks, static analysis tools, runtime log collectors, and package management tools.

## Table of Contents

- [Installation](#installation)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Components](#components)
- [Examples](#examples)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/llm-iterative-code.git
   cd llm-iterative-code
   ```

2. Install dependencies:
   ```
   yarn install
   ```

3. Build the project:
   ```
   yarn build
   ```

## Project Structure

```
llm-iterative-code/
├── src/
│   ├── core/
│   │   ├── FileManager.ts
│   │   ├── HistoryManager.ts
│   │   ├── IterationController.ts
│   │   ├── LLMInterface.ts
│   │   ├── Logger.ts
│   │   ├── TaskInitializer.ts
│   │   └── ToolRunner.ts
│   ├── cli/
│   │   └── CLIInterface.ts
│   └── index.ts
├── tests/
│   ├── FileManager.test.ts
│   ├── HistoryManager.test.ts
│   ├── IterationController.test.ts
│   ├── LLMInterface.test.ts
│   ├── TaskInitializer.test.ts
│   └── ToolRunner.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Usage

To start the iterative code generation process:

```
yarn start
```

This will run the main function in `src/index.ts`, which initializes the system and starts the iterative code generation process.

## Components

### TaskInitializer

Initializes a task with relevant files, working files, and project settings.

### IterationController

Manages the iteration process, keeping track of the current iteration and determining when to stop.

### LLMInterface

Abstract class defining the interface for interacting with the Language Model.

### ToolRunner

Executes various development tools and processes their results.

### FileManager

Handles file operations such as moving, updating, and deleting files.

### HistoryManager

Manages the history of actions taken during the code generation process.

### Logger

Provides logging functionality for the entire system.

## Examples

Here are some examples of how to use the main components of the system:

### Initializing a Task

```typescript
import { TaskInitializer, Task } from './core/TaskInitializer';

const task: Task = TaskInitializer.initialize(
  'Implement a simple TypeScript function',
  [{ fileName: 'example.ts', contentSnippet: '// TODO: Implement function' }],
  [{ fileName: 'example.ts', contentSnippet: '// TODO: Implement function' }],
  '/path/to/project/root',
  true
);
```

### Using the IterationController

```typescript
import { IterationController } from './core/IterationController';

const controller = new IterationController(10);

while (controller.shouldContinue(false)) {
  controller.incrementIteration();
  console.log(`Current iteration: ${controller.getCurrentIteration()}`);
  // Perform iteration tasks here
}
```

### Implementing LLMInterface

```typescript
import { LLMInterface, LLMResponse, ToolResults } from './core/LLMInterface';
import { Task } from './core/TaskInitializer';

class MyLLM extends LLMInterface {
  async generateCode(task: Task, toolResults: ToolResults, history: string[]): Promise<LLMResponse> {
    // Implement code generation logic here
  }

  async analyzeResults(task: Task, toolResults: ToolResults, history: string[]): Promise<LLMResponse> {
    // Implement result analysis logic here
  }
}
```

### Using ToolRunner

```typescript
import { ToolRunner } from './core/ToolRunner';
import { File } from './core/TaskInitializer';
import { ToolUsage } from './core/LLMInterface';

ToolRunner.initialize('/path/to/project/root');

const workingFiles: File[] = [
  { fileName: 'example.ts', contentSnippet: 'console.log("Hello, World!");' }
];

const toolUsages: ToolUsage[] = [
  {
    name: 'updateFile',
    params: { fileName: 'example.ts', content: 'console.log("Updated!");' },
    reasoning: 'Update file content'
  }
];

const { results, newFiles } = await ToolRunner.runTools(workingFiles, toolUsages);
```

## Testing

To run the test suite:

```
yarn test
```

This will execute all tests in the `tests/` directory using Jest.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.