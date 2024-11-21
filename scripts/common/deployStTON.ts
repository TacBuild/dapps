import { ethers } from "hardhat";
import { deployToken, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import path from 'path';


async function main() {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);

    const tokenA = await deployToken(
        [sequencerSigner],
        tacContracts,
        "stTON",
        "stTON",
        9n,
        "Staked TON",
        "http://sample/stton.png",
        process.env.TVM_TKA_ADDRESS!,
        true
    );

    saveContractAddress(addressesFilePath, 'stTON', await tokenA.getAddress());

    console.log(await tokenA.getAddress());
}

main();
