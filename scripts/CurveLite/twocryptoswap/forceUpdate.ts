import { ethers, upgrades } from "hardhat";


async function main() {


    const provider = ethers.provider;
    
    const curvProxyAddress = "0x402879F4a18C79747177a91DDeAb1aB18f97503F"
    const implFactory = await ethers.getContractFactory("CurveLiteTwocryptoswapProxy");

    await upgrades.forceImport(curvProxyAddress, implFactory);

}

main();
