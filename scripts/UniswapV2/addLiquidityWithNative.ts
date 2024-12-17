import hre, { ethers } from 'hardhat';
import { printEvents, printBalances } from '../utils';
import { ERC20 } from 'tac-l2-ccl/dist/typechain-types';
import { sendSimpleMessage } from 'tac-l2-ccl';
import { InMessageStruct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer';
import { loadUniswapTestEnv } from './utils';


async function main(showEvents=false) {

    const [signer] = await ethers.getSigners();
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const { tacToken, sttonToken, tacContracts, groups, uniswapV2Proxy, uniswapV2Router02, uniswapV2Factory, lpToken, lpTokenTacAndStTon } = await loadUniswapTestEnv(sequencerSigner);

    const amountTokenDesired = 1000n * 10n**9n;
    const amountETHDesired = 2000n * 10n**9n;
    const amountTokenMin = 5000n * 10n**9n;
    const amountETHMin = 1000n * 10n**9n;
    const to = await uniswapV2Proxy.getAddress();
    const deadline = 19010987500n;

    const message: InMessageStruct = {
        queryId: 5,
        operationId: "test add liquidity with native token",
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: to,
        methodName: 'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [
                await sttonToken.getAddress(),
                amountTokenDesired,
                amountTokenMin,
                amountETHMin,
                to,
                deadline,
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {l2Address: await sttonToken.getAddress(), amount: amountTokenDesired},
        ],
        unlock: [
            {l2Address: await tacContracts.crossChainLayer.NATIVE_TOKEN_ADDRESS(), amount: amountETHDesired},
        ],
        meta: [],  // tokens are already exist, no need to fill meta
    };
    
    const receipt = await sendSimpleMessage([sequencerSigner], message, [tacContracts, groups], true);
    
    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}

main(true);
