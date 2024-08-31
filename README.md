# Shraga: Iterative Code Generation with LLMs

Shraga is an advanced tool for iterative code generation using Large Language Models (LLMs). It's designed to assist developers in generating, refining, and validating code through an interactive process.

## Capabilities

Shraga offers the following key capabilities:

1. **Iterative Code Generation**: Generates and refines code based on a given task description.
2. **Intelligent File Selection**: Automatically selects relevant files for the given task.
3. **Tool Integration**: Integrates with various development tools such as TypeScript compiler, Jest for testing, and ESLint for code quality.
4. **Adaptive Task Handling**: Can update and refine the task description as it progresses.
5. **Version Control**: Maintains a history of file changes throughout the process.
6. **Error Handling**: Gracefully handles and reports errors during the code generation process.
7. **Configurable**: Allows customization of various parameters such as maximum iterations, file limits, and logging.

## How to Use Shraga

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-repo/shraga.git
   cd shraga
   ```

2. Install dependencies:
   ```
   yarn install
   ```

### Basic Usage

Run Shraga from the command line:

```
yarn start
```

This will prompt you for:
1. The project directory (or use the default)
2. The task description

Shraga will then process your request and generate/modify code as needed.

### Programmatic Usage

You can also use Shraga programmatically in your TypeScript/JavaScript projects:

```typescript
import { Shraga } from './path/to/Shraga';

const shraga = new Shraga('/path/to/your/project', 'Your task description');
await shraga.run();
```

### Configuration

You can configure Shraga by passing a configuration object:

```typescript
const config = {
  maxIterations: 5,
  maxFiles: 10,
  maxTotalSize: 50000,
  logger: customLogger // optional
};

const shraga = new Shraga('/path/to/your/project', 'Your task description', config);
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.