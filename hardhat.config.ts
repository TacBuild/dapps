import * as dotenv from "dotenv";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import { HardhatUserConfig } from "hardhat/config";
dotenv.config();

const TAC_TESTNET_URL = process.env.TAC_TESTNET_URL || "http://127.0.0.1:8545";
const TAC_TESTNET_SPB_URL = process.env.TAC_TESTNET_SPB_URL || "http://127.0.0.1:8545";

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
      chainId: 2391,
      accounts: {
        count: 50
      },
      allowBlocksWithSameTimestamp: true,
      forking: {
        url: TAC_TESTNET_URL,
        blockNumber: 5622599,
      },
    },
    localhost: {
	    url:  "http://127.0.0.1:8545",
      timeout: 3600000
    },
    tac_testnet: {
      chainId: 2390,
      url: TAC_TESTNET_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY || ""]
    },
    tac_testnet_spb: {
      chainId: 2391,
      url: TAC_TESTNET_SPB_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY || ""]
    },
  },
  etherscan: {
    apiKey: {
      tac_testnet: 'empty',
      tac_testnet_spb: 'empty'
    },
    customChains: [
      {
        network: "tac_testnet",
        chainId: 2390,
        urls: {
          apiURL: process.env.TURIN_API_URL || "",
          browserURL: "https://turin.explorer.tac.build"
        }
      },
      {
        network: "tac_testnet_spb",
        chainId: 2391,
        urls: {
          apiURL: process.env.SPB_API_URL || "",
          browserURL: "https://spb.explorer.tac.build"
        }
      }
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
