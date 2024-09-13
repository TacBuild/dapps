const { ethers } = require('hardhat')

const {
    useContract,
    getContract,
    printEvents,
    loadContractAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');


async function main(tokenA, tokenB, showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy', null, process.env.UNISWAPV2_PROXY_ADDRESS);
    
    await printBalances('\nBalances before operation');

    const amountADesired = 10000n * 10n**9n;
    const amountBDesired = 20000n * 10n**9n;
    const amountAMin = 5000n * 10n**9n;
    const amountBMin = 10000n * 10n**9n;
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;

    const message = {
        queryId: 5,
        target: to,
        methodName: 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [
                tokenA, 
                tokenB, 
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
            {tokenAddress: tokenA, amount: amountADesired},
            {tokenAddress: tokenB, amount: amountBDesired},
        ],
        unlock: [],
    };

    const receipt = await sendSimpleMessage(message);

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
