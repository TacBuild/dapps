import { ethers } from 'hardhat';
import { printEvents, printBalances } from '../utils';
import { ERC20 } from 'tac-l2-ccl/dist/typechain-types';
import { sendSimpleMessage } from 'tac-l2-ccl';
import { InMessageStruct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer';
import { loadTacoTestEnv } from './utils';

async function main(showEvents=false) {
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const { 
        tokenA, 
        tokenB, 
        tacContracts, 
        groups, 
        tacoProxy, 
        tacoV2Proxy02, 
        tacoFeeRouteProxy, 
        tacoDFMFactory, 
        tacoApprove,
    } = await loadTacoTestEnv(sequencerSigner);
    const tacoV2Proxy02Address = process.env.DODO_V2PROXY02_ADDRESS as string
    const tacoFeeRouteProxyAddress = process.env.DODO_FEEROUTEPROXY_ADDRESS as string

    const entitiesToPrintBalances = [
        {name: "CrossChainLayer", address: await tacContracts.crossChainLayer.getAddress()},
        {name: 'TacoProxy', address: await tacoProxy.getAddress()},
        {name: 'TacoV2Proxy02', address: tacoV2Proxy02Address},
        {name: 'TacoFeeRouteProxy', address: tacoFeeRouteProxyAddress},
    ];
    const tokensToPrintBalances: {contract: ERC20, name?: string}[] = 
        [{contract: tokenA}, {contract: tokenB}];

    await printBalances('\nBalances before operation', tokensToPrintBalances, entitiesToPrintBalances);

    const amountADesired = 10000n * 10n**9n;
    const amountBDesired = 20000n * 10n**9n;
    const amountAMin = 5000n * 10n**9n;
    const amountBMin = 10000n * 10n**9n;
    const to = await tacoProxy.getAddress();
    const deadline = 19010987500n;

    const message: InMessageStruct = {
        queryId: 5,
        operationId: "test add liquidity",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: to,
        methodName: 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [
                await tokenA.getAddress(),
                await tokenB.getAddress(),
                amountADesired,
                amountBDesired,
                amountAMin,
                amountBMin,
                to,
                deadline,
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {l2Address: await tokenA.getAddress(), amount: amountADesired},
            {l2Address: await tokenB.getAddress(), amount: amountBDesired},
        ],
        unlock: [],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessage([sequencerSigner], message, [tacContracts, groups], true);

    await printBalances('\nBalances after operation', tokensToPrintBalances, entitiesToPrintBalances);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}


main(true);
