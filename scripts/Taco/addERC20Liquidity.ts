import { ethers } from 'hardhat';
import { printEvents, printBalances } from '../utils';
import { ERC20 } from '@tonappchain/evm-ccl/dist/typechain-types';
import { sendSimpleMessageV1 } from '@tonappchain/evm-ccl';
import { InMessageV1Struct } from '@tonappchain/evm-ccl/dist/typechain-types/contracts/core/Structs.sol/IStructsInterface';
import { loadTacoTestEnv } from './utils';

async function main(showEvents=false) {
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const {
        tokenA,
        tokenB,
        tacContracts,
        tacoProxy,
        tacoV2Proxy02,
        tacoFeeRouteProxy,
        tacoDFMFactory,
        tacoApprove,
    } = await loadTacoTestEnv(sequencerSigner, false);

    let pools = await tacoDFMFactory.getDODOPool(await tokenA.getAddress(), await tokenB.getAddress());
    if (pools.length == 0) {
        throw new Error('pool doesn\'t exist');
    }
    console.log(`use pool: ${pools[0]}`)

    const entitiesToPrintBalances = [
        {name: 'CrossChainLayer', address: await tacContracts.crossChainLayer.getAddress()},
        {name: 'TacoProxy', address: await tacoProxy.getAddress()},
    ];
    const tokensToPrintBalances: {contract: ERC20, name?: string}[] = 
        [{contract: tokenA}, {contract: tokenB}];

    await printBalances('\nBalances before operation', tokensToPrintBalances, entitiesToPrintBalances);

    const dvmAddress = pools[0];
    const baseInAmount = 1000n * 10n**9n;
    const quoteInAmount = 2000n * 10n**9n;
    const baseMinAmount = 0n;
    const quoteMinAmount = 0n;
    const flag = 0 // 0 - ERC20, 1 - baseInETH, 2 - quoteInETH
    const deadLine = 19010987500n;

    const message: InMessageV1Struct = {
        shardsKey: 5,
        operationId: 'TACO test add ERC20-ERC20 liquidity',
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: await tacoProxy.getAddress(),
        methodName: 'addDVMLiquidity(bytes,bytes)',
        arguments: new ethers.AbiCoder().encode(
            ['tuple(address,uint256,uint256,uint256,uint256,uint8,uint256)'],
            [
                [
                    dvmAddress,
                    baseInAmount,
                    quoteInAmount,
                    baseMinAmount,
                    quoteMinAmount,
                    flag,
                    deadLine,
                ]
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {evmAddress: await tokenA.getAddress(), amount: baseInAmount},
            {evmAddress: await tokenB.getAddress(), amount: quoteInAmount},
        ],
        unlock: [],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessageV1([sequencerSigner], message, tacContracts, "0x", true);

    await printBalances('\nBalances after operation', tokensToPrintBalances, entitiesToPrintBalances);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}


main(true);
