import { ICustomRatRepository, CustomRat } from '../../core/repositories/ICustomRatRepository';

export class CustomRatSelector {
  private roundRobinIndex = 0;
  private selectionInProgress = false;

  constructor(private customRatRepository: ICustomRatRepository) {}

  async getNextRat(): Promise<CustomRat> {
    // Simple spin-lock to prevent race condition in concurrent requests
    while (this.selectionInProgress) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    this.selectionInProgress = true;

    try {
      const activeRats = await this.customRatRepository.getActiveRats();

      if (activeRats.length === 0) {
        throw new Error('No active RATs available. All RATs are DEAD. Cannot continue.');
      }

      // Atomic round-robin selection (protected by spin-lock)
      const currentIndex = this.roundRobinIndex;
      this.roundRobinIndex = (this.roundRobinIndex + 1) % activeRats.length;

      return activeRats[currentIndex];
    } finally {
      this.selectionInProgress = false;
    }
  }

  async checkAnyActiveRats(): Promise<boolean> {
    const activeRats = await this.customRatRepository.getActiveRats();
    return activeRats.length > 0;
  }

  resetIndex(): void {
    this.roundRobinIndex = 0;
  }
}
