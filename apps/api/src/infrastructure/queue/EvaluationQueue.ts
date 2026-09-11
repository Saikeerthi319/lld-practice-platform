export class EvaluationQueue {
  private readonly pending: string[] = [];
  private running = false;
  private readonly inFlight = new Set<string>();

  constructor(private readonly run: (attemptId: string) => Promise<void>) {}

  enqueue(attemptId: string): void {
    if (this.inFlight.has(attemptId) || this.pending.includes(attemptId)) {
      return;
    }
    this.pending.push(attemptId);
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.pending.length > 0) {
        const attemptId = this.pending.shift()!;
        this.inFlight.add(attemptId);
        try {
          await this.run(attemptId);
        } catch (error) {
          console.error("Evaluation queue error", attemptId, error);
        } finally {
          this.inFlight.delete(attemptId);
        }
      }
    } finally {
      this.running = false;
      if (this.pending.length > 0) {
        void this.pump();
      }
    }
  }
}
