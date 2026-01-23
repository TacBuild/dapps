import hre from 'hardhat';
import { MidasProxy, MidasProxyUSDT } from '../../typechain-types/';
import { Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};


export async function deployMidasProxy(deployer: Signer, tacSAFactoryAddress: string, depositVaultAddress: string, redemptionVaultAddress: string,  crossChainLayerAddress: string): Promise<MidasProxy> {
    // Proxy
    const midasProxy = await deployUpgradable<MidasProxy>(
        deployer,
        hre.artifacts.readArtifactSync('MidasProxy'),
        [await deployer.getAddress(), tacSAFactoryAddress, depositVaultAddress, redemptionVaultAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    await midasProxy.waitForDeployment();
    return midasProxy;
}

export async function deployMidasProxyUSDT(deployer: Signer, tacSAFactoryAddress: string, depositVaultAddress: string, redemptionVaultAddress: string,  crossChainLayerAddress: string): Promise<MidasProxyUSDT> {
    // Proxy
    const midasProxy = await deployUpgradable<MidasProxyUSDT>(
        deployer,
        hre.artifacts.readArtifactSync('MidasProxyUSDT'),
        [await deployer.getAddress(), tacSAFactoryAddress, depositVaultAddress, redemptionVaultAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    await midasProxy.waitForDeployment();
    return midasProxy;
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const midasProxy = await deployMidasProxyUSDT(deployer, "0x070820Ed658860f77138d71f74EfbE173775895b", "0xbD2CE9D5F2c682FCA3ce587Bf1C041ad8DDd2a69", "0x911f9aF9138284A49b29F9894571Fb86e29D1d79", "0x9fee01e948353E0897968A3ea955815aaA49f58d");
    console.log("MidasProxyUSDT deployed to:", midasProxy.target);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})