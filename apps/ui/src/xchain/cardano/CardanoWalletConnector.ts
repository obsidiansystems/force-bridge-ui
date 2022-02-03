export class CardanoWalletConnector {
  constructor() {
    if (!window.cardano.nami) {
      throw new Error('Nami Wallet is required');
    }
  }
}
