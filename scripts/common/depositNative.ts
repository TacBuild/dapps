import { ethers } from "hardhat";
import path from 'path';
import { loadTacContracts } from "tac-l2-ccl";
import { OutMessageStruct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer';

async function main() {
    const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);

    const message: OutMessageStruct = {
        queryId: 5,
        tvmTarget: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        tvmPayload: '',
        toBridge: [],
    };

    const tx = await tacContracts.crossChainLayer.connect(signer).sendMessage(
        message,
        { value: ethers.parseEther("5") }
    );
    await tx.wait();
}

main();
