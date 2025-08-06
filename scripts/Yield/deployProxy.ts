import hre from 'hardhat';
import { YieldManagerProxy } from '../../typechain-types/';
import { Signer } from 'ethers';
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { yiedMainnetConfig } from "./config/mainnetConfig";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployYieldProxy(deployer: Signer, managerAddress: string, yUSD:string, tacSAFactoryAddress: string, crossChainLayerAddress: string): Promise<YieldManagerProxy> {
    // Proxy
    const yieldProxy = await deployUpgradable<YieldManagerProxy>(
        deployer,
        hre.artifacts.readArtifactSync('YieldManagerProxy'),
        [await deployer.getAddress(), managerAddress, yUSD, tacSAFactoryAddress, crossChainLayerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    await yieldProxy.waitForDeployment();
    return yieldProxy;
}

