import "hardhat/types/config";
import "hardhat/types/runtime";

import { ExposedUserConfig, ExposedConfig } from './config';

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    exposed?: ExposedUserConfig;
  }

  export interface HardhatConfig {
    exposed: ExposedConfig;
  }
}
