import hre, { ethers } from 'hardhat';
import { InMessageStruct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer';
import { sendSimpleMessage } from 'tac-l2-ccl';
import {getCoinsFromPool} from './utils'
import {loadTestEnv} from '../utils'


async function main(proxyAddress: string, poolAddress: string, amountA: bigint, amountB: bigint) {
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const { tacContracts, groups, } = await loadTestEnv(sequencerSigner);
    let coins = await getCoinsFromPool(poolAddress)

    const message: InMessageStruct = {
        queryId: 15,
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

    const receipt = await sendSimpleMessage([sequencerSigner], message, [tacContracts, groups], "0x", true);
}


main(
    "",
    "",
    1000000n * 10n ** 9n,
    1000000n * 10n ** 9n
);
