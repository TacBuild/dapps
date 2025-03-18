import hre, { ethers } from "hardhat";
import { deploy, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import * as path from "path";
import { treasuryTokens } from "./config/tokens";

import { TestnetERC20 } from "../../typechain-types";
import { deployTreasurySwap } from "./deployTreasurySwap";
import { deployTreasurySwapProxy } from "./deployTreasurySwapProxy";

const wTON = "0xc40A96e983f9Cef1890c2af343Dee064875D3490";

async function main() {

    const verbose = true;

    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, "../addresses.json");

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

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
            wTON,
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
            wTON,
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
