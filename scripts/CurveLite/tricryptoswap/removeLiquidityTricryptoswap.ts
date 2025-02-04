import hre, { ethers } from 'hardhat';
import { InMessageStruct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer';
import { sendSimpleMessage } from 'tac-l2-ccl';
import {getCoinsFromPool} from './utils'
import {loadTestEnv} from '../utils'


async function main(proxyAddress: string, poolAddress: string, amount: bigint) {
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);
    const { tacContracts, groups, } = await loadTestEnv(sequencerSigner);

    const message: InMessageStruct = {
        queryId: 15,
        operationId: ethers.encodeBytes32String("test removeLiquidity Curve"),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: proxyAddress,
        methodName: 'removeLiquidity(address,uint256,uint256[3])',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'uint256', 'uint256[3]'],
            [
                poolAddress,
                amount,
                [0, 0, 0]
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [],
        unlock: [
            { l2Address: poolAddress, amount: amount },
        ],
        meta: [],  // TODO
    };

    const receipt = await sendSimpleMessage([sequencerSigner], message, [tacContracts, groups], "0x", true);
}


main(
    "",
    "",
    1000000n * 10n ** 9n
);
