import hre, { ethers } from 'hardhat';
import { sendSimpleMessageV1, simulateReceiveMessageV1, decodeCrossChainLayerErrorData } from '@tonappchain/evm-ccl';
import { InMessageV1Struct } from '@tonappchain/evm-ccl/dist/typechain-types/contracts/L2/Structs.sol/IStructsInterface';
import path from 'path';
import {getCoinsFromPool} from './utils'
import { loadTacContracts } from "@tonappchain/evm-ccl";


async function main(proxyAddress: string, poolAddress: string, amountA: bigint, amountB: bigint) {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    let coins = await getCoinsFromPool(poolAddress)

    const message: InMessageV1Struct = {
        shardsKey: 5,
        gasLimit: 0n,
        operationId: ethers.encodeBytes32String("test addLiquidity Curve"),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: proxyAddress,
        methodName: 'addLiquidity(bytes,bytes)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'uint256[2]', 'uint256'],
            [
                [poolAddress,
                [amountA, amountB],
                0]
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            { l2Address: coins[0], amount: amountA },
            { l2Address: coins[1], amount: amountB },
        ],
        unlock: [],
        meta: [],  // fill if the tokens are new
    };
    const receipt = await sendSimpleMessageV1([sequencerSigner], message, tacContracts, "0x", true);
}


main(
    "",
    "",
    1000000n * 10n ** 9n,
    1000000n * 10n ** 9n
);
