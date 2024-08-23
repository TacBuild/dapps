const { ethers } = require('hardhat')

const {
    printEvents,
    useContract,
    getContract,
    loadContractAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');


async function main(showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy', null, process.env.UNISWAPV2_PROXY_ADDRESS);
    
    await printBalances('\nBalances before operation');

    const tokenA = loadContractAddress('TKA');
    const tokenB = loadContractAddress('TKB');
    const amountIn = 10n * 10n**9n;
    const amountOutMin = 5n * 10n**9n;
    const path = [tokenA, tokenB];
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;

    const message = {
        queryId: 123,
        timestamp: Math.floor(Math.random() * 2**32),
        target: await appProxyContract.getAddress(),
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
    };

    const receipt = await sendSimpleMessage(message);

    await printBalances('\nBalances after operation');

    if (showEvents) {
        printEvents(receipt, crossChainLayerContract);
    }
}


main();
