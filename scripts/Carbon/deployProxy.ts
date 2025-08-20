import { Signer } from "ethers";
import { CarbonProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import { carbonMainnetConfig } from "./config/mainnetConfig"
import hre from 'hardhat';

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups",
    unsafeAllow: ["constructor"]
};

export async function deployCarbonProxy(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string,
    carbonControllerAddress: string,
    owner?: string
): Promise<CarbonProxy> {
    const ownerAddress = owner ?? await deployer.getAddress();
    
    const carbonProxy = await deployUpgradable<CarbonProxy>(
        deployer,
        hre.artifacts.readArtifactSync('CarbonProxy'),
        [carbonControllerAddress, tacSAFactoryAddress, crossChainLayerAddress, ownerAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await carbonProxy.waitForDeployment();
    return carbonProxy;
}

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const carbonProxy = await deployCarbonProxy(deployer, "0x4f3b05a601B7103CF8Fc0aBB56d042e04f222ceE", "0x5919D1D0D1b36F08018d7C9650BF914AEbC6BAd6", "0xe4816658ad10bF215053C533cceAe3f59e1f1087");
    console.log("CarbonProxy deployed to:", carbonProxy.target);
}

main();

