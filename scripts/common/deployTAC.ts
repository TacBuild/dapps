import { deployToken, loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import { ethers } from "hardhat";
import path from 'path';
import { tacTokenInfo } from "./info/tokensInfo";{ }


async function main() {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);

    const tokenB = await deployToken(
        [sequencerSigner],
        tacContracts,
        tacTokenInfo.name,
        tacTokenInfo.symbol,
        tacTokenInfo.decimals,
        tacTokenInfo.tvmAddress,
        true
    );

    saveContractAddress(addressesFilePath, 'TAC', await tokenB.getAddress());

    console.log(await tokenB.getAddress());
}

main();
