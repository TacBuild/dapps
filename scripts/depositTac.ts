import hre, { ethers } from 'hardhat';
import { loadContractFromFile } from './utils';
import path from 'path';
import { ICrossChainLayer } from '../typechain-types';
import { OutMessageStruct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer';

async function main() {

    const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../addresses.json');
    const ccl = loadContractFromFile<ICrossChainLayer>(addressesFilePath, 'crossChainLayer', hre.artifacts.readArtifactSync('ICrossChainLayer').abi, signer);
    const message: OutMessageStruct = {
        queryId: 5,
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        methodName: '',
        arguments: '0x',
        caller: await ccl.getAddress(),
        burn: [],
        lock: [],
    };

    const tx = await ccl.connect(signer).sendMessage(
        message,
        { value: ethers.parseEther("5") }
    );
    await tx.wait();
}

main();
