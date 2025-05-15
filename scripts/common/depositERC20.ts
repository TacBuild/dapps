import { ethers } from "hardhat";
import path from 'path';
import { getCCLArtifacts, loadTacContracts } from "@tonappchain/evm-ccl";
import { CrossChainLayerToken } from "@tonappchain/evm-ccl/dist/typechain-types";
import { loadContractFromFile } from "../utils";
import { sendSimpleMessageV1 } from '@tonappchain/evm-ccl';
import { InMessageV1Struct } from "@tonappchain/evm-ccl/dist/typechain-types/contracts/core/Structs.sol/IStructsInterface";


async function main() {
    const signer = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const cclArtifacts = await getCCLArtifacts();
    const tacToken = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'TAC', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);
    const sttonToken = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'stTON', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);

    const tacContracts = await loadTacContracts(addressesFilePath, signer);

    console.log('signer:', await signer.getAddress());

    console.log('Before:');
    console.log('token', await tacToken.getAddress(), 'balance:', await tacToken.balanceOf(await signer.getAddress()));
    console.log('token', await sttonToken.getAddress(), 'balance:', await sttonToken.balanceOf(await signer.getAddress()));
    console.log('native balance:', await (signer.provider!).getBalance(await signer.getAddress()));

    const message: InMessageV1Struct = {
        shardsKey: 5,
        operationId: ethers.encodeBytes32String('deposit'),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: await signer.getAddress(),
        methodName: '',
        arguments: new ethers.AbiCoder().encode([],[]),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {evmAddress: await tacToken.getAddress(),   amount: 10000000n * 10n**9n},
            {evmAddress: await sttonToken.getAddress(), amount: 10000000n * 10n**9n},
        ],
        unlock: [
        ],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    await sendSimpleMessageV1([signer], message, tacContracts);

    console.log('After:');
    console.log('token', await tacToken.getAddress(), 'balance:', await tacToken.balanceOf(await signer.getAddress()));
    console.log('token', await sttonToken.getAddress(), 'balance:', await sttonToken.balanceOf(await signer.getAddress()));
    console.log('native balance:', await (signer.provider!).getBalance(await signer.getAddress()));
}


main();
