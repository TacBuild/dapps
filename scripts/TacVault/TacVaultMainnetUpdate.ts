import hre from "hardhat";
import { tacVaultMainnetConfig } from "./config/TacVaultMainnetConfig";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};


export async function upgradeTacVaultMainnetForMultisig() {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("TacBoringVaultProxy", signer);
    const implementatioAddress = await hre.upgrades.prepareUpgrade(tacVaultMainnetConfig.proxyAddress, factory, proxyOptsUUPS);
    console.log("Implementation address:", implementatioAddress)    
}

upgradeTacVaultMainnetForMultisig();