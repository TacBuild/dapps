import { ethers } from "hardhat";
import path from 'path';
import { loadTacContracts } from "tac-l2-ccl";
import { ICrossChainLayer } from "../../typechain-types";
import { OutMessageV1Struct } from "../../typechain-types/tac-l2-ccl/contracts/L2/Structs.sol/IStructsInterface";
import { encodeOutMessageV1 } from 'tac-l2-ccl';

async function main() {
    const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    const message: OutMessageV1Struct = {
        shardedId: 5,
        tvmTarget: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        tvmPayload: '',
        toBridge: [],
    };

    const encodedMessage = encodeOutMessageV1(message);
    const tx = await tacContracts.crossChainLayer.connect(signer).sendMessage(
        1n,
        encodedMessage,
        { value: ethers.parseEther("2") }
    );
    await tx.wait();
}

main();
