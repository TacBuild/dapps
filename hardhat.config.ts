import * as dotenv from "dotenv";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import { HardhatUserConfig } from "hardhat/config";
dotenv.config();

export const TAC_TESTNET_SPB_URL = process.env.TAC_TESTNET_SPB_URL || "https://spb.rpc.tac.build";
export const TAC_MAINNET_URL = process.env.TAC_MAINNET_URL || "https://rpc.tac.build";

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error("DEPLOYER_PRIVATE_KEY is not defined");
}

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        }
      },
      {
        version: "0.8.18",
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        count: 50
      },
      allowBlocksWithSameTimestamp: true,
    },
    localhost: {
	    url:  "http://127.0.0.1:8545",
      timeout: 3600000
    },
    tac_testnet_spb: {
      chainId: 2391,
      url: TAC_TESTNET_SPB_URL,
      accounts: [DEPLOYER_PRIVATE_KEY]
    },
    tac_mainnet: {
      chainId: 239,
      url: TAC_MAINNET_URL,
      accounts: [DEPLOYER_PRIVATE_KEY]
    }
  },
  etherscan: {
    apiKey: {
      tac_testnet: 'empty',
      tac_testnet_spb: 'empty',
      tac_mainnet: 'empty'
    },
    customChains: [
      {
        network: "tac_testnet_spb",
        chainId: 2391,
        urls: {
          apiURL: "https://spb.explorer.tac.build/api",
          browserURL: "https://spb.explorer.tac.build"
        }
      },
      {
        network: "tac_mainnet",
        chainId: 239,
        urls: {
          apiURL: "https://explorer.tac.build/api",
          browserURL: "https://explorer.tac.build"
        }
      },
    ]
  },

  gasReporter: {
    enabled: false,
    currency: 'ETH',
    gasPrice: 1
  },
  mocha: {
    timeout: 10000000
  }
};

export default config;
