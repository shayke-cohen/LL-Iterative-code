import { IterationController } from '../src/core/IterationController';

describe('IterationController', () => {
  let controller: IterationController;

  beforeEach(() => {
    controller = new IterationController(5);
  });

  test('should initialize with 0 iterations', () => {
    expect(controller.getCurrentIteration()).toBe(0);
  });

  test('should increment iteration', () => {
    controller.incrementIteration();
    expect(controller.getCurrentIteration()).toBe(1);
  });

  test('should continue when not at max iterations and task not complete', () => {
    expect(controller.shouldContinue(false)).toBe(true);
  });

  test('should stop when task is complete', () => {
    expect(controller.shouldContinue(true)).toBe(false);
  });

  test('should stop when max iterations reached', () => {
    for (let i = 0; i < 5; i++) {
      controller.incrementIteration();
    }
    expect(controller.shouldContinue(false)).toBe(false);
  });
});