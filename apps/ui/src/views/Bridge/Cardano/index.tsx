import { createContainer } from 'unstated-next';
import { useMutation, UseMutationResult, mutateAsync } from 'react-query';
import Icon from '@ant-design/icons';
import { AssetSymbol } from 'components/AssetSymbol';
import { ReactComponent as BridgeDirectionIcon } from '../Ethereum/BridgeOperation/resources/icon-bridge-direction.svg';
import { BridgeReminder } from '../Ethereum/BridgeOperation/BridgeReminder';
import React, { useMemo, useEffect, useState } from 'react';
import { BridgeOperationForm } from '../Ethereum/BridgeOperation';
import { useChainId } from '../Ethereum/hooks/useChainId';
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

export const CardanoProviderContainer = createContainer(() => {
  const cardano = window.cardano

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

  return cardano;
});


const CardanoBridge: React.FC = () => {
  const chainId = useChainId();
  const { selectedAsset } = useSelectBridgeAsset();
  const { direction, network, switchBridgeDirection } = ForceBridgeContainer.useContainer();
  const [confirmNumberConfig, setConfirmNumberConfig] = useState<{
    xchainConfirmNumber: number;
    nervosConfirmNumber: number;
  }>();

  const [namiWalletConnectStatus, setNamiWalletConnectStatus] = useState<ConnectStatus>(() => {
    return 'Disconnected'
  });

  const [namiAddr, setNamiAddr] = useState(() => '')

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
          console.log('requesting to enable nami');
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
    const provider = CardanoProviderContainer.useContainer();

    return useMutation(
      ['switchNamiNetwork'],
      async () => {
          await provider.nami.enable();
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

  function useChainId(): number | null {
    const [chainId, setChainId] = useState<number | null>(null);
    const provider = CardanoProviderContainer.useContainer();

    useEffect(() => {
      provider.getNetworkId().then((newChainId) => setChainId(newChainId));
    }, [provider]);

    return chainId;
  }

/*const namiChainId = useChainId();
  const bridgeChainId =
    network === 'Cardano'
    ? {
      chainId:
    }
    : {
    };

  const actionButton =
    namiChainId !== null && namiChainId !== bridgeChainInfo.chainId ? (
      <SwitchNamiNetworkButton
        chainId={`0x${bridgeChainInfo.chainId.toString(16)}`}
        chainName={bridgeChainInfo.chainName}
      />
    ) : null /* (
      <SubmitButton
        disabled={validateStatus !== 'success' && !enableApproveButton}
        block
        type="primary"
        size="large"
        onClick={formik.submitForm}
        allowanceStatus={allowance}
        isloading={isLoading}
      />
    );
*/

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



      <BridgeReminder />
    </BridgeViewWrapper>
  );
};

export default CardanoBridge;
