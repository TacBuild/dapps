import { deployToken, loadGroupContracts, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import { ethers } from "hardhat";
import path from 'path';


async function main() {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    const groups = await loadGroupContracts(addressesFilePath, signer, ["Group-0"]);

    const tokenB = await deployToken(
        [sequencerSigner],
        [tacContracts, groups],
        "TAC",
        "TAC",
        9n,
        process.env.TVM_TKB_ADDRESS!,
        true
    );

    saveContractAddress(addressesFilePath, 'TAC', await tokenB.getAddress());

    console.log(await tokenB.getAddress());
}

main();
