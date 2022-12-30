import "hardhat/types/config";
import "hardhat/types/runtime";

declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    exposed?: {
      include?: string[];
      exclude?: string[];
      outDir?: string;
      prefix?: string;
      constructorStructs?: boolean;
    };
  }

  export interface HardhatConfig {
    exposed: {
      include: string[];
      exclude: string[];
      outDir: string;
      prefix?: string;
      constructorStructs?: boolean;
    };
  }
}
