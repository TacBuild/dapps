import { ethers } from "hardhat";
import { deployToken, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import path from 'path';
import { sttonTokenInfo } from "./info/tokensInfo";

async function main() {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);

    const tokenA = await deployToken(
        [sequencerSigner],
        tacContracts,
        sttonTokenInfo.name,
        sttonTokenInfo.symbol,
        sttonTokenInfo.decimals,
        sttonTokenInfo.tvmAddress,
        true
    );

    saveContractAddress(addressesFilePath, 'stTON', await tokenA.getAddress());

    console.log(await tokenA.getAddress());
}

main();
