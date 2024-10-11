const { ethers } = require('hardhat')

const {
    useContract,
    getContract,
    printEvents,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');

async function ensurePairs() {
    // Factory
    const factoryArtifact = require('@uniswap/v2-core/build/UniswapV2Factory.json');
    const uniswapV2Factory = await useContract(
        'UniswapV2Factory', 
        process.env.UNISWAPV2_FACTORY_ADDRESS,
        factoryArtifact,
    );
    const tkaAddress = process.env.EVM_TKA_ADDRESS;
    const tkbAddress = process.env.EVM_TKB_ADDRESS;
    const tokenPairs = [
        [tkaAddress, tkbAddress],
    ];
    for (const tokenPair of tokenPairs) {
        const pairAddress = await uniswapV2Factory.getPair(tokenPair[0], tokenPair[1])
        if (pairAddress == 0x0000000000000000000000000000000000000000) {
            const tx = await uniswapV2Factory.createPair(tokenPair[0], tokenPair[1]);
            await tx.wait();
        }
    }
}


async function main(tokenA, tokenB, showEvents=false) {
    await ensurePairs()

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
        deploy: [],
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
