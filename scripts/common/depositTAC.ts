import { ethers } from "hardhat";
import path from 'path';
import { loadTacContracts } from "@tonappchain/evm-ccl";
import { OutMessageV1Struct } from "../../typechain-types/@tonappchain/evm-ccl/contracts/L2/Structs.sol/IStructsInterface";
import { encodeOutMessageV1 } from '@tonappchain/evm-ccl';

async function main() {
    const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    const message: OutMessageV1Struct = {
        shardsKey: 5,
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
