import { Signer } from "ethers";
import { TacSAFactory, UUPSUpgradeable } from "../../typechain-types";
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { tacSAFactoryDeployments } from "./config/testnetConfig";
import { tacSAFactoryDeployments as tacSAFactoryDeploymentsMainnet } from "./config/mainnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function upgradeTacSAFactory(
): Promise<TacSAFactory> {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("TacSAFactory", signer);
    const tacSAFactory = await hre.upgrades.upgradeProxy(tacSAFactoryDeployments.proxyAddress, factory);
    await tacSAFactory.waitForDeployment();
    return tacSAFactory;

}

export async function upgradeTacSAFactoryMainnetForMultisig() {
    const [signer] = await hre.ethers.getSigners();
    const factory = await hre.ethers.getContractFactory("TacSAFactory", signer);
    const implementatioAddress = await hre.upgrades.prepareUpgrade(tacSAFactoryDeploymentsMainnet.proxyAddress, factory);
    console.log("Implementation address:", implementatioAddress)    
}

upgradeTacSAFactoryMainnetForMultisig();