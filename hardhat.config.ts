import './src/plugin';

import '@nomiclabs/hardhat-ethers';

import type { HardhatUserConfig } from 'hardhat/config';

export default <HardhatUserConfig> {
  solidity: '0.8.8',
  exposed: {
    exclude: ['Excluded.sol'],
    initializers: true,
  },
};
