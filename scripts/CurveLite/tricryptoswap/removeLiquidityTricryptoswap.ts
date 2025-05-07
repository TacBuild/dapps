import hre, { ethers } from 'hardhat';
import { sendSimpleMessageV1, simulateReceiveMessageV1, decodeCrossChainLayerErrorData } from '@tonappchain/evm-ccl';
import { InMessageV1Struct } from '@tonappchain/evm-ccl/dist/typechain-types/contracts/CCL/Structs.sol/IStructsInterface';
import path from 'path';
import {getCoinsFromPool} from './utils'
import { loadTacContracts } from "@tonappchain/evm-ccl";

async function main(proxyAddress: string, poolAddress: string, amount: bigint) {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);

    const message: InMessageV1Struct = {
        shardsKey: 5,
        gasLimit: 0n,
        operationId: ethers.encodeBytes32String("test removeLiquidity Curve"),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: proxyAddress,
        methodName: 'removeLiquidity(bytes,bytes)',
        arguments: new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256[3])'],
            [
                [poolAddress,
                amount,
                [0, 0, 0]]
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [],
        unlock: [
            { evmAddress: poolAddress, amount: amount },
        ],
        meta: [],  // TODO
    };

    const receipt = await sendSimpleMessageV1([sequencerSigner], message, tacContracts, "0x", true);
}


main(
    "",
    "",
    1000000n * 10n ** 9n
);
