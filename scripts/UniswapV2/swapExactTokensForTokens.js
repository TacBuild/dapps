const { ethers } = require('hardhat')

const {
    printEvents,
    useContract,
    getContract,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');


async function main(tokenA, tokenB, showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy', null, process.env.UNISWAPV2_PROXY_ADDRESS);
    
    await printBalances('\nBalances before operation');

    const amountIn = 10n * 10n**9n;
    const amountOutMin = 1n * 10n**9n;
    const path = [tokenA, tokenB];
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;

    const message = {
        queryId: 42,
        timestamp: 1726050404,
        target: to,
        methodName: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['uint256', 'uint256', 'address[]', 'address', 'uint256'],
            [
                amountIn, 
                amountOutMin, 
                path, 
                to, 
                deadline,
            ]
        ),
        caller: 'EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp',
        mint: [
            {tokenAddress: tokenA, amount: amountIn},
        ],
        unlock: [],
        deploy: [],
    };

    const receipt = await sendSimpleMessage(message, verbose=true);

    await printBalances('\nBalances after operation');

    if (showEvents) {
        await printEvents(receipt, crossChainLayerContract);
    }
}


main(
    process.env.EVM_TKA_ADDRESS,
    process.env.EVM_TKB_ADDRESS,
    true,
);
