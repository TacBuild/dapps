const { ethers } = require('hardhat')

const {
    printEvents,
    useContract,
    getContract,
    getTokenAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');


async function main(showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy', null, process.env.UNISWAPV2_PROXY_ADDRESS);

    const tokenA = await getTokenAddress(process.env.TVM_TKA_ADDRESS);
    const tokenB = await getTokenAddress(process.env.TVM_TKB_ADDRESS);

    await printBalances('\nBalances before operation');

    const amountInMax = 10n * 10n**9n;
    const amountOut = 13n * 10n**9n;
    const path = [tokenA, tokenB];
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;
    const message = {
        target: await appProxyContract.getAddress(),
        methodName: 'swapTokensForExactTokens(uint256,uint256,address[],address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['uint256', 'uint256', 'address[]', 'address', 'uint256'],
            [
                amountOut, 
                amountInMax, 
                path, 
                to, 
                deadline,
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {l2Address: tokenA, amount: amountInMax},
        ],
        unlock: [],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessage(message);

    await printBalances('\nBalances after operation');

    if (showEvents) {
        await printEvents(receipt, crossChainLayerContract);
    }
};


main();
