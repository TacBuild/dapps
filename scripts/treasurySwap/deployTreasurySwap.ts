import hre, { ethers } from "hardhat";
import { deploy } from "@tonappchain/evm-ccl";
import { Signer } from "ethers";

import { TreasurySwap } from "../../typechain-types";

export async function deployTreasurySwap(deployer: Signer, wTON: string, tokenAddress: string, tokenValue: bigint, decimals: bigint, upperBound: bigint, lowerBound: bigint, verbose: boolean = false): Promise<TreasurySwap> {
    console.log("Deploying TreasurySwap contract");
    console.log("wTON address: ", wTON);
    console.log("Token address: ", tokenAddress);
    console.log("Token value: ", tokenValue);
    console.log("Decimals: ", decimals);
    console.log("Upper bound: ", upperBound);
    console.log("Lower bound: ", lowerBound);
    const treasurySwapArtifact = hre.artifacts.readArtifactSync("TreasurySwap");
    const treasurSwapContract = await deploy<TreasurySwap>(deployer, treasurySwapArtifact, [tokenAddress, wTON, tokenValue, decimals, upperBound, lowerBound], undefined, verbose);

    return treasurSwapContract;
}