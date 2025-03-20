import hre, { ethers, upgrades } from "hardhat";

async function main(needsForceImport: boolean = false) {

    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const proxyAddress = "0x5FFCa38A45b6cb89DE1423fEB8dC4180D9e40125";

    const artifact = hre.artifacts.readArtifactSync("TreasurySwapProxy");
    const ImplFactory = await ethers.getContractFactoryFromArtifact(artifact, deployer);

    //const proxyContract = await ethers.getContractAt("TreasurySwapProxy", proxyAddress, deployer);

    if (needsForceImport === true) {
        console.log(`Force importing contract at ${proxyAddress}`);
        await upgrades.forceImport(proxyAddress, ImplFactory);
    } else {
        console.log(`Upgrading contract at ${proxyAddress}`);
        const newImpl = await upgrades.upgradeProxy(proxyAddress, ImplFactory, );
        console.log(`Upgrade done`);
    }
}

// set true for force import (if there is no upgrade manifest)
// set false for upgrade
main(true);