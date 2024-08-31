class IterationController {
    private currentIteration: number;
    private maxIterations: number;
  
    constructor(maxIterations: number) {
      this.currentIteration = 0;
      this.maxIterations = maxIterations;
    }
  
    incrementIteration(): void {
      this.currentIteration++;
      // console.log(`Iteration ${this.currentIteration} reasoning: ...`);
    }
  
    shouldContinue(taskComplete: boolean): boolean {
      return !taskComplete && this.currentIteration < this.maxIterations;
    }
  
    getCurrentIteration(): number {
      return this.currentIteration;
    }
  }
  
  export { IterationController };