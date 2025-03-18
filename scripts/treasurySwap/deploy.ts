import hre, { ethers } from "hardhat";
import { deploy, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import * as path from "path";
import { treasuryTokens } from "./config/tokens";

import { TestnetERC20 } from "../../typechain-types";
import { deployTreasurySwap } from "./deployTreasurySwap";
import { deployTreasurySwapProxy } from "./deployTreasurySwapProxy";
import { loadERC20FromFile } from "../utils";

async function main() {

    const verbose = true;

    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, "../addresses.json");

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const wTONContract = loadERC20FromFile(addressesFilePath, "evmTONTokenAddress", deployer);
    const wTONAddress = await wTONContract.getAddress();

    const testnetERC20Artifact = hre.artifacts.readArtifactSync("TestnetERC20");

    for (const token of treasuryTokens) {
        console.log("Start deployment for token: ", token.tokenName);

        const tokenContract = await deploy<TestnetERC20>(
            deployer,
            testnetERC20Artifact,
            [token.tokenName, token.tokenSymbol, token.decimals],
            undefined,
            verbose
        )

        const tokenAddress = await tokenContract.getAddress();

        saveContractAddress(addressesFilePath, `${token.tokenSymbol}_Token`, tokenAddress);

        const treasurSwapContract = await deployTreasurySwap(
            deployer,
            wTONAddress,
            tokenAddress,
            token.tokenValue,
            token.decimals,
            token.upperBound,
            token.lowerBound
        );
        saveContractAddress(addressesFilePath, `${token.tokenSymbol}_Treasury`, await treasurSwapContract.getAddress());

        const proxyContract = await deployTreasurySwapProxy(
            deployer,
            await treasurSwapContract.getAddress(),
            wTONAddress,
            await tacContracts.crossChainLayer.getAddress(),
            verbose
        );
        saveContractAddress(addressesFilePath, `${token.tokenSymbol}_TreasuryProxy`, await proxyContract.getAddress());

        await tokenContract.mint(await treasurSwapContract.getAddress(), 10n ** (9n + BigInt(token.decimals)));

        console.log("Done with ", token.tokenName);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
