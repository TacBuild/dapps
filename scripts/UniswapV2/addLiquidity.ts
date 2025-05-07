import hre, { ethers } from 'hardhat';
import { printEvents, printBalances } from '../utils';
import { ERC20 } from '@tonappchain/evm-ccl/dist/typechain-types';
import { sendSimpleMessageV1, simulateReceiveMessageV1, decodeCrossChainLayerErrorData } from '@tonappchain/evm-ccl';
import { InMessageV1Struct } from '@tonappchain/evm-ccl/dist/typechain-types/contracts/core/Structs.sol/IStructsInterface';
import { loadUniswapTestEnv } from './utils';


async function main(showEvents=false) {
    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const { tacToken, sttonToken, tacContracts, uniswapV2Proxy, uniswapV2Router02, uniswapV2Factory, lpToken } = await loadUniswapTestEnv(sequencerSigner);

    const entitiesToPrintBalances = [
        {name: "CrossChainLayer", address: await tacContracts.crossChainLayer.getAddress()},
        {name: 'UniswapV2Proxy', address: await uniswapV2Proxy.getAddress()},
        {name: 'UniswapV2Router02', address: await uniswapV2Router02.getAddress()},
        {name: 'TAC-stTON pair', address: await lpToken.getAddress()},
    ];
    const tokensToPrintBalances: {contract: ERC20, name?: string}[] = [{contract: tacToken}, {contract: sttonToken}, {contract: lpToken, name: 'TAC-stTON LP'}];

    await printBalances('\nBalances before operation', tokensToPrintBalances, entitiesToPrintBalances);

    const amountADesired = 10000n * 10n**9n;
    const amountBDesired = 20000n * 10n**9n;
    const amountAMin = 5000n * 10n**9n;
    const amountBMin = 10000n * 10n**9n;
    const to = await uniswapV2Proxy.getAddress();
    const deadline = 19010987500n;

    const message: InMessageV1Struct = {
        shardsKey: 5,
        gasLimit: 0n,
        operationId: ethers.encodeBytes32String("test addLiquidity"),
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: to,
        methodName: 'addLiquidity(bytes,bytes)',
        arguments: new ethers.AbiCoder().encode(
            ["tuple(address,address,uint256,uint256,uint256,uint256,address,uint256)"],
            [
                [
                    await sttonToken.getAddress(),
                    await tacToken.getAddress(),
                    amountADesired,
                    amountBDesired,
                    amountAMin,
                    amountBMin,
                    to,
                    deadline,
                ]
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {evmAddress: await sttonToken.getAddress(), amount: amountADesired},
            {evmAddress: await tacToken.getAddress(), amount: amountBDesired},
        ],
        unlock: [],
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

    await printBalances('\nBalances after operation', tokensToPrintBalances, entitiesToPrintBalances);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}


main(true);
