import hre, { ethers } from "hardhat";
import { Signer } from "ethers";
import { TreasurySwapProxy } from "../../typechain-types";
import { deployUpgradable } from "@tonappchain/evm-ccl";


export async function deployTreasurySwapProxy(deployer: Signer, treasuryAddress: string, wTON: string, tacContractsCrossChainLayer: string, verbose: boolean = false): Promise<TreasurySwapProxy> {

    const treasurySwapProxyArtifact = hre.artifacts.readArtifactSync("TreasurySwapProxy");
    const treasurySwapProxyContract = await deployUpgradable<TreasurySwapProxy>(
        deployer,
        treasurySwapProxyArtifact,
        [await deployer.getAddress(), treasuryAddress, wTON, tacContractsCrossChainLayer],
        {
            kind: "uups",
        },
        undefined,
        verbose);

    return treasurySwapProxyContract;
}