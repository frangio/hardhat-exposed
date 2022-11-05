import "hardhat/types/config";
import "hardhat/types/runtime";

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    exposed?: {
      prefix?: string;
      exclude?: string[];
      include?: string[];
      outDir?: string;
    };
  }

  export interface HardhatConfig {
    exposed: {
      prefix?: string;
      exclude: string[];
      include: string[];
      outDir: string;
    };
  }
}
