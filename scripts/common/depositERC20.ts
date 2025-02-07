import { ethers } from "hardhat";
import path from 'path';
import { getCCLArtifacts, loadTacContracts, loadGroupContracts } from "tac-l2-ccl";
import { CrossChainLayerToken } from "tac-l2-ccl/dist/typechain-types";
import { loadContractFromFile } from "../utils";
import { sendSimpleMessageV1 } from 'tac-l2-ccl';
import { InMessageV1Struct } from "tac-l2-ccl/dist/typechain-types/contracts/L2/Structs.sol/IStructsInterface";


async function main() {
    const signer = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const cclArtifacts = await getCCLArtifacts();
    const tacToken = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'TAC', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);
    const sttonToken = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'stTON', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);

    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    const groups = await loadGroupContracts(addressesFilePath, signer, ["Group-0"]);

    console.log('signer:', await signer.getAddress());

    console.log('Before:');
    console.log('token', await tacToken.getAddress(), 'balance:', await tacToken.balanceOf(await signer.getAddress()));
    console.log('token', await sttonToken.getAddress(), 'balance:', await sttonToken.balanceOf(await signer.getAddress()));
    console.log('native balance:', await (signer.provider!).getBalance(await signer.getAddress()));

    const message: InMessageV1Struct = {
        shardedId: 5,
        operationId: ethers.encodeBytes32String('deposit'),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: await signer.getAddress(),
        methodName: '',
        arguments: new ethers.AbiCoder().encode([],[]),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {l2Address: await tacToken.getAddress(),   amount: 10000000n * 10n**9n},
            {l2Address: await sttonToken.getAddress(), amount: 10000000n * 10n**9n},
        ],
        unlock: [
        ],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    await sendSimpleMessageV1([signer], message, [tacContracts, groups]);

    console.log('After:');
    console.log('token', await tacToken.getAddress(), 'balance:', await tacToken.balanceOf(await signer.getAddress()));
    console.log('token', await sttonToken.getAddress(), 'balance:', await sttonToken.balanceOf(await signer.getAddress()));
    console.log('native balance:', await (signer.provider!).getBalance(await signer.getAddress()));
}


main();
