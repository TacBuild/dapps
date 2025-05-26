import { Signer } from "ethers";
import { TacBoringVaultProxy } from "../../typechain-types";
import { deployUpgradable } from '@tonappchain/evm-ccl'
import { DeployProxyOptions } from "@openzeppelin/hardhat-upgrades/dist/utils";
import hre from 'hardhat';
import { tacVaultTestnetConfig } from "./config/TacVaultTestnetConfig";
import { deployTacSmartAccount } from "../TacSmartAccountFactory/SABlueprintDeploy";
import { deployTacSAFactory } from "../TacSmartAccountFactory/FactoryDeploy";

const proxyOptsUUPS: DeployProxyOptions = {
    kind: "uups"
};

export async function deployTacVault(
    deployer: Signer,
    crossChainLayerAddress: string,
    tacSAFactoryAddress: string
): Promise<TacBoringVaultProxy> {
    
    const tacVaultProxy = await deployUpgradable<TacBoringVaultProxy>(
        deployer,
        hre.artifacts.readArtifactSync('TacBoringVaultProxy'),
        [crossChainLayerAddress, tacVaultTestnetConfig.teller, tacVaultTestnetConfig.boringOnChainQueue, tacVaultTestnetConfig.boringVault, tacSAFactoryAddress],
        proxyOptsUUPS,
        undefined,
        true
    );
    
    
    await tacVaultProxy.waitForDeployment();
    return tacVaultProxy;
}

async function main() {
    const provider = hre.ethers.provider;
    const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY || "", provider);
    // console.log(await wallet.getAddress());
    // const tacSA = await deployTacSmartAccount(wallet);
    // console.log(await tacSA.getAddress());
    // const tacSAFactory = await deployTacSAFactory(wallet, "0xeAB80f5369689a2D142f25E654d9822A7725028B");
    const tacVaultProxy = await deployTacVault(wallet, "0x4f3b05a601B7103CF8Fc0aBB56d042e04f222ceE", "0x510ee99eD721107851D692f761198E3dE4e9310D");
    console.log("TacVaultProxy deployed to:", await tacVaultProxy.getAddress());
}

main();