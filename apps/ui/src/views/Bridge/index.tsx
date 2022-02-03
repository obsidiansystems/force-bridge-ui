import { Skeleton } from 'antd';
import React, { lazy, Suspense } from 'react';
import { Route, Switch } from 'react-router-dom';
import { StyledCardWrapper } from 'components/Styled';
import { BridgeOperationFormContainer } from 'containers/BridgeOperationFormContainer';
import { EthereumProviderContainer } from 'containers/EthereumProviderContainer';
import { CardanoProviderContainer } from 'views/Bridge/Cardano';
import { BindNetworkDirectionWithRoute } from 'views/Bridge/BindNetworkDirectionWithRoute';

const EthereumBridge = lazy(async () => import('./Ethereum'));
const CardanoBridge = lazy(async () => import('./Cardano'))

export const BridgeView: React.FC = () => {
  // useBindRouteAndBridgeState();

  return (
    <BridgeOperationFormContainer.Provider>
      <EthereumProviderContainer.Provider>
        <CardanoProviderContainer.Provider>
          <BindNetworkDirectionWithRoute />

          <Suspense
            fallback={
              <StyledCardWrapper>
                <Skeleton active />
              </StyledCardWrapper>
            }
          >
            <Switch>
              <Route
                path={['/bridge/Ethereum/Nervos', '/bridge/Nervos/Ethereum', '/bridge/Bsc/Nervos', '/bridge/Nervos/Bsc']}
                component={EthereumBridge}
              />
              <Route path={['/bridge/Cardano/Nervos', '/bridge/Nervos/Cardano']} component={CardanoBridge} />
            </Switch>
          </Suspense>
        </CardanoProviderContainer.Provider>
      </EthereumProviderContainer.Provider>
    </BridgeOperationFormContainer.Provider>
  );
};
