import hre, { ethers } from 'hardhat';
import { sendSimpleMessage } from 'tac-l2-ccl';
import { printEvents, printBalances } from '../utils';
import { InMessageStruct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer';
import { loadUniswapTestEnv } from './utils';

async function main(showEvents=false) {

    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const { tacToken, sttonToken, tacContracts, uniswapV2Proxy, uniswapV2Router02, uniswapV2Factory, lpToken } = await loadUniswapTestEnv(signer);

    const entitiesToPrintBalances = [
        {name: "CrossChainLayer", address: await tacContracts.crossChainLayer.getAddress()},
        {name: 'UniswapV2Proxy', address: await uniswapV2Proxy.getAddress()},
        {name: 'UniswapV2Router02', address: await uniswapV2Router02.getAddress()},
        {name: 'TAC-stTON pair', address: await lpToken.getAddress()},
    ];
    const tokensToPrintBalances = [tacToken, sttonToken, lpToken];

    await printBalances('\nBalances before operation', tokensToPrintBalances, entitiesToPrintBalances);


    const liquidity = 50n * 10n**9n;
    const amountAMin = 20n * 10n**9n;
    const amountBMin = 40n * 10n**9n;
    const to = await uniswapV2Proxy.getAddress();
    const deadline = 19010987500n;

    const message: InMessageStruct = {
        queryId: 1337n,
        operationId: "test remove liquidity",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: await uniswapV2Proxy.getAddress(),
        methodName: 'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [
                await sttonToken.getAddress(),
                await tacToken.getAddress(),
                liquidity,
                amountAMin,
                amountBMin,
                to,
                deadline,
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [],
        unlock: [
            {l2Address: await lpToken.getAddress(), amount: liquidity},
        ],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessage([sequencerSigner], message, tacContracts, true);

    await printBalances('\nBalances after operation', tokensToPrintBalances, entitiesToPrintBalances);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}


main();
