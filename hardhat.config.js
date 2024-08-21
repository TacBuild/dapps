require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();


const NETWORK = process.env.HARDHAT_NETWORK || "polygon";
const ACCOUNT = process.env.HARDHAT_ACCOUNT;


module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.25",
      },
      {
        version: "0.8.18",
      },
    ],
  },
  defaultNetwork: NETWORK,
  networks: {
    hardhat: {
      chainId: 1337,
    },
    localhost: {
	    url:  "http://127.0.0.1:8545",
    },
    polygon: {
      url: "https://runnerpalm-rpc.eu-north-2.gateway.fm",
      accounts: [ACCOUNT]
    }
  },
  gasReporter: {
    enabled: false,
    currency: 'ETH',
    gasPrice: 1
  }
};
