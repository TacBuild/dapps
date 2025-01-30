import { ethers } from "hardhat";
import { deployToken, loadGroupContracts, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';


async function main() {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    const groups = await loadGroupContracts(addressesFilePath, signer, ["Group-0"]);

    const tokenA = await deployToken(
        [sequencerSigner],
        [tacContracts, groups],
        "stTON",
        "stTON",
        9n,
        process.env.TVM_TKA_ADDRESS!,
        true
    );

    saveContractAddress(addressesFilePath, 'stTON', await tokenA.getAddress());

    console.log(await tokenA.getAddress());
}

main();
