import { ethers, upgrades  } from 'hardhat';

import { proxyOptsUUPS} from "../../utils"





async function main() {
    const [signer] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CurveLiteTwocryptoswapProxy", signer);
    const customCurveLiteTwocryptoswapProxy = await upgrades.upgradeProxy("0x402879F4a18C79747177a91DDeAb1aB18f97503F", factory, proxyOptsUUPS);
    await customCurveLiteTwocryptoswapProxy.waitForDeployment();
    await customCurveLiteTwocryptoswapProxy.setWTACAddress("0xB63B9f0eb4A6E6f191529D71d4D88cc8900Df2C9");
    console.log("CustomMerklProxyEuler upgraded to:", customCurveLiteTwocryptoswapProxy.target);

}


main();
