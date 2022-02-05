import { createContainer } from 'unstated-next';
import { useMutation, UseMutationResult, mutateAsync } from 'react-query';
import Icon from '@ant-design/icons';
import { utils } from '@force-bridge/commons';
import { AssetSymbol } from 'components/AssetSymbol';
import { ReactComponent as BridgeDirectionIcon } from '../Ethereum/BridgeOperation/resources/icon-bridge-direction.svg';
import { BridgeReminder } from '../Ethereum/BridgeOperation/BridgeReminder';
import React, { useMemo, useEffect, useState } from 'react';
import { BridgeOperationForm } from '../Ethereum/BridgeOperation';
import { ForceBridgeContainer, BridgeDirection } from 'containers/ForceBridgeContainer';
import { BridgeHistory } from 'views/Bridge/components/BridgeHistory';
import { useSelectBridgeAsset } from 'views/Bridge/hooks/useSelectBridgeAsset';
import { ConnectorConfig, EthereumWalletConnector, CardanoWalletConnector } from 'xchain';
import { StyledCardWrapper } from 'components/Styled';
import styled from 'styled-components';
import { UserInput } from 'components/UserInput';
import { AssetSelector } from 'components/AssetSelector';
import { HumanizeAmount } from 'components/AssetAmount';
import { ButtonProps, Button, Tooltip, Modal, Divider, Row, Spin, Typography } from 'antd';
import { useFormik } from 'formik';
import { LinearGradientButton } from 'components/Styled';
import { UserIdent } from 'components/UserIdent';
import { useGlobalSetting } from 'hooks/useGlobalSetting';
import { ConnectStatus } from 'interfaces/WalletConnector';

const StyledWalletConnectButton = styled(LinearGradientButton)`
  color: ${(props) => props.theme.palette.common.black};
  font-weight: 700;
`;

const BridgeViewWrapper = styled(StyledCardWrapper)`
  .label {
    font-weight: bold;
    font-size: 12px;
    line-height: 14px;
    color: rgba(0, 0, 0, 0.8);
  }

  .input-wrapper {
    padding: 28px 0;
  }
`;

const HelpWrapper = styled(Typography.Text)`
  padding-left: 8px;
`;

const Help: React.FC<{ validateStatus: 'error' | ''; help?: string }> = ({ validateStatus, help }) => {
  if (validateStatus !== 'error') return null;
  return <HelpWrapper type="danger">{help}</HelpWrapper>;
};


function retrySync(retry: () => boolean, options: { times: number; interval: number }): void {
  if (!options.times || retry()) return;
  setTimeout(() => {
    retrySync(retry, { times: options.times - 1, interval: options.interval });
  }, options.interval);
}

export const CardanoProviderContainer = createContainer(() => {
  const [namiApi, setNamiApi] = useState();
  const [chainId, setChainId] = useState<number | null>(null);
  const [namiWalletConnectStatus, setNamiWalletConnectStatus] = useState<ConnectStatus>(() => {
    return 'Disconnected'
  });

  const [namiAddr, setNamiAddr] = useState(() => '')

  if (!window.cardano) {
    Modal.warning({
      content: (
        <div>
          <a href="https://namiwallet.io/" target="_blank" rel="noreferrer">
        Nami
        </a>
          &nbsp;is required when doing the bridge of Cardano
        </div>
      ),
    });

    throw new Error('Nami Wallet is required');
  }

  function updateNamiApi() {
    window.cardano.nami.enable().then((namiToSet) => {

      setNamiApi(namiToSet);
      //console.log(namiApi);
      if (!namiApi) throw new Error('Nami Wallet is required');

      namiApi.experimental.on('accountChange', (addr) => setNamiAddr);

      retrySync(
        () => {
          if (namiAddr == '') return false;

          setNamiWalletConnectStatus('Connected');
          return true
        },
        { times: 5, interval: 100 },
      );
    }).catch((e) => {console.log(e)});
  }

  //useMemo(() => {
    //updateNamiApi();
  //}, [])

  return {
    namiApi,
    chainId,
    setChainId,
    updateNamiApi,
    namiWalletConnectStatus,
    setNamiWalletConnectStatus,
    namiAddr,
    setNamiAddr,
  };
});

function useChainId(): number | null {
  const { namiApi: provider, chainId, setChainId } = CardanoProviderContainer.useContainer();

  useEffect(() => {
    function chainIdListener(changedChainId: unknown) {
      const chainId = Number(changedChainId);
      if (isNaN(chainId)) return;
      setChainId(chainId);
    }
    if (provider) {
      provider.getNetworkId().then((newChainId) => setChainId(newChainId));

      provider.experimental.on('networkChange', chainIdListener);
    }
  }, [provider]);
  return chainId;
}

const CardanoBridge: React.FC = () => {
  const { selectedAsset } = useSelectBridgeAsset();
  const { direction, network } = ForceBridgeContainer.useContainer();
  const { updateNamiApi, namiWalletConnectStatus, setNamiWalletConnectStatus, namiAddr, setNamiAddr, chainId, namiApi } = CardanoProviderContainer.useContainer();

  useEffect(() => {
    updateNamiApi();
  }, [namiApi, chainId]);

  const DisconnectedView = () => (
    <StyledWalletConnectButton block onClick={connectToNami}>
      Connect a Nami Wallet
    </StyledWalletConnectButton>
  )

  async function grabUsedAddr() {
    const addrs = await window.cardano.getUsedAddresses();
    setNamiAddr(addrs);
  }

  const ConnectedView = () => {
    const innerBtn = useMemo(() => {
      if (namiAddr === '') {
        grabUsedAddr();
        return (<>Loading...</>);
      } else {
        return (<UserIdent ident={namiAddr} />);
      }
    }, [namiAddr]);
    return (
      <StyledWalletConnectButton block>
        {innerBtn}
     </StyledWalletConnectButton>
    )
  }

  function connectToNami() {
    if (!window.cardano || !window.cardano.nami) {
       Modal.warning({
         content: (
           <div>
            <a href="https://namiwallet.io/" target="_blank" rel="noreferrer">
              Nami
            </a>
            &nbsp;is required when doing the bridge of Cardano
           </div>
         ),
       });
   } else {
      const cardano = window.cardano;
      const nami = window.cardano.nami;
      // TODO: user has to click Connect button twice when initially giving access to Nami wallet
      nami.isEnabled().then((isNamiEnabled) => {
        if (!isNamiEnabled) {
          nami.enable();
        } else {
          setNamiWalletConnectStatus('Connected');
        }
      });
    }
  }

  const btn = useMemo(() => {
    if (namiWalletConnectStatus === ConnectStatus.Connected) {
      return (<ConnectedView />);
    } else {
      return (<DisconnectedView />);
    }
  }, [namiWalletConnectStatus, namiAddr]);


  interface SwitchInputValues {
    chainId: string;
  }

  function useSwitchNamiNetwork(): UseMutationResult<void, unknown, SwitchInputValues> {
    const { namiApi, setChainId, chainId } = CardanoProviderContainer.useContainer();

    return useMutation(
      ['switchNamiNetwork'],
      async (input: SwitchInputValues) => {
        setChainId(input.chainId);
      },
      {
        onError(error) {
          const errorMsg: string = utils.hasProp(error, 'message') ? String(error.message) : 'Unknown error';
          Modal.error({ title: 'Switch MetaMask Network failed', content: errorMsg, width: 360 });
        },
      },
    );
  }

  interface SwitchNamiNetworkButtonProps extends ButtonProps {
    chainId: string;
    chainName: string;
  }

  const SwitchNamiNetworkButton: React.FC<SwitchNamiNetworkButtonProps> = (props) => {
    const { chainId, chainName } = props;
    const { mutateAsync: switchNamiNetwork, isLoading } = useSwitchNamiNetwork();
    const title = `Switch nami wallet connected
      network to current bridge network(${chainName})`;

    return (
      <Tooltip title={title}>
        <Button loading={isLoading} block type="primary" size="large" onClick={() => switchNamiNetwork({ chainId })}>
          Switch Nami Network
        </Button>
      </Tooltip>
    );
  };

  interface SubmitButtonProps extends ButtonProps {
    isloading: boolean;
    allowanceStatus: AllowanceState | undefined;
  }

  const SubmitButton: React.FC<SubmitButtonProps> = (props) => {
    const { isloading, allowanceStatus, ...buttonProps } = props;
    if (!allowanceStatus) {
      return (
        <Button loading={isloading} {...buttonProps}>
          Bridge
        </Button>
      );
    }

    let isLoading = false;
    let content;
    if (allowanceStatus.status === 'Querying' || allowanceStatus.status === 'Approving' || isloading) {
      isLoading = true;
    }
    switch (allowanceStatus.status) {
      case 'NeedApprove':
        content = 'Approve';
        break;
      case 'Approving':
        content = 'Approving';
        break;
      case 'Approved':
        content = 'Bridge';
        break;
      default:
        content = ' ';
    }

    return (
      <Button loading={isLoading} {...buttonProps}>
        {content}
      </Button>
    );
  };


  const namiChainId = useChainId();
  const bridgeChainInfo =
    {
      chainId: Number(process.env.REACT_APP_CARDANO_ENABLE_CHAIN_ID),
      chainName: process.env.REACT_APP_CARDANO_ENABLE_CHAIN_NAME,
    };

  const actionButton =
    namiChainId !== null && namiChainId !== bridgeChainInfo.chainId ?
      <div>Please switch your nami network (Mainnet or Testnet) </div>
     : <div> Connected to Testnet </div> /*(
      <SubmitButton
        disabled={validateStatus !== 'success' && !zenableApproveButton}
        block
        type="primary"
        size="large"
        onClick={formik.submitForm}
        allowanceStatus={allowance}
        isloading={isLoading}
      />
    );*/

  return (
    <BridgeViewWrapper>
      {btn}

      <div className="input-wrapper">
        <UserInput
          id="bridgeInInputAmount"
          name="bridgeInInputAmount"
          label={
            <span>
              <label className="label" style={{ fontSize: '14px' }}>
                {direction === BridgeDirection.In ? `${network}:` : 'Nervos:'}
              </label>
              &nbsp;
            </span>
          }
          extra={
            selectedAsset && (
              <Button
                type="link"
                size="small"
                onClick={() => setBridgeFromAmount(BeautyAmount.from(selectedAsset).humanize({ separator: false }))}
              >
                Max:&nbsp;
                <HumanizeAmount asset={selectedAsset} humanize={{ decimalPlaces: 4 }} />
              </Button>
            )
          }
          placeholder="0.0"
          disabled={selectedAsset == null || signer == null}
        />
      </div>

      <Row justify="center" align="middle">
        <Icon style={{ fontSize: '24px' }} component={BridgeDirectionIcon} onClick={() => switchBridgeDirection()} />
      </Row>

      <div className="input-wrapper">
        <UserInput
          label={
            <span>
              <label className="label" style={{ fontSize: '14px' }}>
                {direction === BridgeDirection.In ? 'Nervos:' : `${network}:`}
              </label>
              &nbsp;
              {selectedAsset && (
                <Button size="small" disabled={true}>
                  <AssetSymbol info={selectedAsset?.shadow?.info} />
                </Button>
              )}
            </span>
          }
          placeholder="0.0"
          disabled
          extra={
            <Button type="link" size="small">
            </Button>
          }
        />
      </div>

      <Divider dashed style={{ margin: 0, padding: 0 }} />

      <div className="input-wrapper">
        <UserInput
          id="recipient"
          name="recipient"
          label={
            <span className="label" style={{ fontSize: '14px' }}>
              Recipient:
            </span>
          }
          tooltip={
            direction === BridgeDirection.In
              ? 'Please make sure the filled address belong to a sUDT-compatible application, otherwise your funds may be locked until the application adds sUDT support.'
              : undefined
          }
          placeholder={
            direction === BridgeDirection.In ? 'input ckb address' : `input ${network.toLowerCase()} address`
          }
        />
      </div>

      {actionButton}

      <BridgeReminder />
    </BridgeViewWrapper>
  );
};

export default CardanoBridge;
