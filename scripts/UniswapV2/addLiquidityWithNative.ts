import hre, { ethers } from 'hardhat';
import { printEvents } from '../utils';
import { sendSimpleMessageV1, simulateReceiveMessageV1, decodeCrossChainLayerErrorData } from '@tonappchain/evm-ccl';
import { InMessageV1Struct } from '@tonappchain/evm-ccl/dist/typechain-types/contracts/CCL/Structs.sol/IStructsInterface';
import { loadUniswapTestEnv } from './utils';

async function main(showEvents=false) {

    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const { tacToken, sttonToken, tacContracts, uniswapV2Proxy, uniswapV2Router02, uniswapV2Factory, lpToken, lpTokenTacAndStTon } = await loadUniswapTestEnv(sequencerSigner);

    const amountTokenDesired = 1000n * 10n**9n;
    const amountETHDesired = 2000n * 10n**9n;
    const amountTokenMin = 500n * 10n**9n;
    const amountETHMin = 1000n * 10n**9n;
    const to = await uniswapV2Proxy.getAddress();
    const deadline = 19010987500n;

    const message: InMessageV1Struct = {
        shardsKey: 5,
        gasLimit: 0n,
        operationId: ethers.encodeBytes32String("test addLiquidityETH"),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: to,
        methodName: 'addLiquidityETH(bytes,bytes)',
        arguments: new ethers.AbiCoder().encode(
            ['tuple(address, uint256, uint256, uint256, address, uint256)'],
            [
                [
                    await sttonToken.getAddress(),
                    amountTokenDesired,
                    amountTokenMin,
                    amountETHMin,
                    to,
                    deadline,
                ]
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {evmAddress: await sttonToken.getAddress(), amount: amountTokenDesired},
        ],
        unlock: [
            {evmAddress: await tacContracts.crossChainLayer.NATIVE_TOKEN_ADDRESS(), amount: amountETHDesired},
        ],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const simulationResult = await simulateReceiveMessageV1(tacContracts, message, "0x", 10);

    if (!simulationResult.simulationStatus) {
        const decodedError = decodeCrossChainLayerErrorData(simulationResult.errorReason);
        throw new Error(`Error while sending message: ${decodedError}`);
    }

    // set esimtated gas limit
    message.gasLimit = simulationResult.gasLimit * 120n / 100n;

    const receipt = await sendSimpleMessageV1([sequencerSigner], message, tacContracts, "0x", true);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}

main(true);
