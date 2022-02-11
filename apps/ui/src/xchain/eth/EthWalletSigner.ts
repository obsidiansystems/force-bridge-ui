import { JsonRpcSigner } from '@ethersproject/providers/src.ts/json-rpc-provider';
import { ExternalProvider } from '@ethersproject/providers/src.ts/web3-provider';
import { EthereumNetwork, NervosNetwork, utils } from '@force-bridge/commons';
import PWCore, {
  Amount,
  AmountUnit,
  Builder,
  Cell,
  CellDep,
  // CHAIN_SPECS,
  DefaultSigner,
  DepType,
  HashType,
  OutPoint,
  RawTransaction,
  Script,
  Transaction,
} from 'fb-pw-core';
import { RPC, transformers } from 'ckb-js-toolkit';
import { BigNumber, ethers } from 'ethers';
import { ConnectorConfig } from './EthereumWalletConnector';
import { boom, unimplemented } from 'errors';
import { AbstractWalletSigner } from 'interfaces/WalletConnector/AbstractWalletSigner';

// TODO update to latest PW-core when PW is stable
PWCore.prototype.sendTransaction = async function sendTransaction(toSend, signer) {
  const tx = toSend instanceof Builder ? await toSend.build() : toSend;
  tx.validate();
  if (!signer) {
    signer = new DefaultSigner(PWCore.provider);
  }
  return this.rpc.send_transaction(transformers.TransformTransaction(await signer.sign(tx)), 'passthrough');
};

const Erc20ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (boolean)',
];

export class EthWalletSigner extends AbstractWalletSigner<EthereumNetwork> {
  signer: JsonRpcSigner;
  pwCore: PWCore;
  pwLockCellDep: CellDep;

  constructor(nervosIdent: string, xchainIdent: string, private _config: ConnectorConfig) {
    super(nervosIdent, xchainIdent);
    if (utils.hasProp(window, 'ethereum')) {
      const ethereum = window.ethereum as ExternalProvider;
      const provider = new ethers.providers.Web3Provider(ethereum);
      this.signer = provider.getSigner();
      this.pwCore = new PWCore(_config.ckbRpcUrl);
      this.pwLockCellDep = this.getPWLockCellDep(_config);
    } else {
      boom(unimplemented);
    }
  }

  getPWLockCellDep(_config: ConnectorConfig): CellDep {
    // if (0 === config.ckbChainID) {
    //   return CHAIN_SPECS.Lina.pwLock.cellDep;
    // } else if (1 === config.ckbChainID) {
    //   return CHAIN_SPECS.Aggron.pwLock.cellDep;
    // }
    // boom(unimplemented);
    return PWCore.config.pwLock.cellDep;
  }

  _isNervosTransaction(
    raw: EthereumNetwork['RawTransaction'] | NervosNetwork['RawTransaction'],
  ): raw is NervosNetwork['RawTransaction'] {
    return !!(
      utils.hasProp(raw, 'version') &&
      utils.hasProp(raw, 'cellDeps') &&
      utils.hasProp(raw, 'headerDeps') &&
      utils.hasProp(raw, 'inputs') &&
      utils.hasProp(raw, 'outputs') &&
      utils.hasProp(raw, 'outputsData') &&
      utils.hasProp(raw, 'witnesses')
    );
  }

  _isXChainTransaction(
    raw: EthereumNetwork['RawTransaction'] | NervosNetwork['RawTransaction'],
  ): raw is EthereumNetwork['RawTransaction'] {
    return !this._isNervosTransaction(raw);
  }

  async _sendToNervos(raw: NervosNetwork['RawTransaction']): Promise<{ txId: string }> {
    const pwTransaction = await this.toPWTransaction(raw);
    pwTransaction.validate();
    const txHash = await this.pwCore.sendTransaction(pwTransaction);
    return { txId: txHash };
  }

  async _sendToXChain(raw: EthereumNetwork['RawTransaction']): Promise<{ txId: string }> {
    const transactionResponse = await this.signer.sendTransaction(raw);
    return { txId: transactionResponse.hash };
  }

  async approve(asset: EthereumNetwork['DerivedAssetIdent']): Promise<{ txId: string }> {
    const erc20 = new ethers.Contract(asset, Erc20ABI, this.signer);
    const transactionResponse = await erc20.approve(this._config.contractAddress, ethers.constants.MaxUint256);
    return { txId: transactionResponse.hash };
  }

  async getAllowance(asset: EthereumNetwork['DerivedAssetIdent']): Promise<BigNumber> {
    const erc20 = new ethers.Contract(asset, Erc20ABI, this.signer);
    return erc20.allowance(await this.signer.getAddress(), this._config.contractAddress);
  }

  async toPWTransaction(rawTx: NervosNetwork['RawTransaction']): Promise<Transaction> {
    function toPWHashType(hashType: CKBComponents.ScriptHashType): HashType {
      if (hashType === 'data') {
        return HashType.data;
      }
      return HashType.type;
    }

    function toPWDepType(depType: CKBComponents.DepType): DepType {
      if (depType === 'code') {
        return DepType.code;
      }
      return DepType.depGroup;
    }

    const ckbRPC = new RPC(this._config.ckbRpcUrl);
    const inputs = await Promise.all(
      rawTx.inputs.map((i: CKBComponents.CellInput) =>
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        Cell.loadFromBlockchain(ckbRPC, new OutPoint(i.previousOutput!.txHash, i.previousOutput!.index)),
      ),
    );
    const outputs = rawTx.outputs.map(
      (o, index) =>
        new Cell(
          new Amount(o.capacity, AmountUnit.shannon),
          new Script(o.lock.codeHash, o.lock.args, toPWHashType(o.lock.hashType)),
          o.type ? new Script(o.type.codeHash, o.type.args, toPWHashType(o.type.hashType)) : undefined,
          undefined,
          rawTx.outputsData[index],
        ),
    );
    const cellDeps = rawTx.cellDeps.map(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (c) => new CellDep(toPWDepType(c.depType), new OutPoint(c.outPoint!.txHash, c.outPoint!.index)),
    );
    cellDeps.push(this.pwLockCellDep);
    return new Transaction(new RawTransaction(inputs, outputs, cellDeps, rawTx.headerDeps, rawTx.version), [
      Builder.WITNESS_ARGS.Secp256k1,
    ]);
  }
}
