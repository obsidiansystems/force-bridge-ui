import { AbstractWalletConnector, ConnectStatus } from 'interfaces/WalletConnector';
import { retrySync } from 'views/Bridge/Cardano';
import { unimplemented } from 'errors';

export class CardanoWalletConnector extends AbstractWalletConnector<CardanoNetwork> {
  private provider;

  constructor() {
    super();
  }

  async init(): Promise<void> {
    const provider = await window.cardano.enable();
    if (!provider) throw new Error('Nami Wallet is required');

    provider.experimental.on('accountChange', (accounts) => this.onSignerChanged(accounts));
    this.provider = provider;
    retrySync(
      () => {
          //const selectedAddress =
          if (namiAddr == '') return false;

          setNamiWalletConnectStatus(ConnectStatus.Connected);
          return true
        },
        { times: 5, interval: 100 },
      );
  }

  protected async _connect(): Promise<void> {
    if (!this.provider) return Promise.reject('Provider is not loaded, maybe Nami is not installed');
    return this.provider
      .getUsedAddresses()
      .then((accounts) => this.onSignerChanged(accounts));
  }

  protected async _disconnect(): Promise<void> {
    unimplemented();
  }
}
