import * as dotenv from "dotenv";

import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import { HardhatUserConfig } from "hardhat/config";
dotenv.config();

const TAC_TESTNET_URL = process.env.TAC_TESTNET_URL || "http://127.0.0.1:8545";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        
        settings: {
          viaIR:true,
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
      forking: {
        url: TAC_TESTNET_URL,
        blockNumber: 3867934,
      },
    },
    localhost: {
	    url:  "http://127.0.0.1:8545",
      timeout: 3600000
    },
    tac_testnet: {
      url: TAC_TESTNET_URL
    },
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
