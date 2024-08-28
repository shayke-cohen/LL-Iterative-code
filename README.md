# LLM Iterative Code Generation

This project implements an iterative code generation system using a Language Model (LLM). It generates, refines, and validates code iteratively by integrating various development tools, including compilers, linters, testing frameworks, and package management tools.

## Table of Contents

- [Installation](#installation)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Components](#components)
- [Configuration](#configuration)
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
│   │   ├── initLogger.ts
│   │   ├── ConfigManager.ts
│   │   ├── FileManager.ts
│   │   ├── HistoryManager.ts
│   │   ├── IterationController.ts
│   │   ├── LLMInterface.ts
│   │   ├── Logger.ts
│   │   ├── RealLLM.ts
│   │   ├── TaskInitializer.ts
│   │   ├── ToolRunner.ts
│   │   ├── file-selector.ts
│   │   └── tools.ts
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

### initLogger
Initializes the logging system for the entire application.

### ConfigManager
Manages configuration settings for the application.

### TaskInitializer
Initializes a task with relevant files, working files, and project settings.

### IterationController
Manages the iteration process, keeping track of the current iteration and determining when to stop.

### LLMInterface
Abstract class defining the interface for interacting with the Language Model.

### RealLLM
Concrete implementation of the LLMInterface for interacting with the actual Language Model.

### ToolRunner
Executes various development tools and processes their results.

### FileManager
Handles file operations such as moving, updating, and deleting files.

### HistoryManager
Manages the history of actions taken during the code generation process.

### Logger
Provides logging functionality for the entire system.

### file-selector
Handles the selection of relevant files for a given task.

### tools
Contains utility functions for file operations and analysis.

## Configuration

The project uses a configuration file for logging settings. You can modify the `log-config.json` file in the project root to adjust logging behavior.

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