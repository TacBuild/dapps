const { ethers } = require('hardhat')

const {
    printEvents,
    useContract,
    getContract,
    loadContractAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');

const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");


async function main(showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy', null, process.env.UNISWAPV2_PROXY_ADDRESS);
    const factoryContract = await getContract('UniswapV2Factory', 'UniswapV2Factory', factoryArtifact,  process.env.UNISWAPV2_FACTORY_ADDRESS);
    
    await printBalances('\nBalances before operation');

    const tokenA = loadContractAddress('TKA');
    const tokenB = loadContractAddress('TKB');
    const tokenLPAB = await factoryContract.getPair(tokenA, tokenB);
    const liquidity = 50n * 10n**9n;
    const amountAMin = 20n * 10n**9n;
    const amountBMin = 40n * 10n**9n;
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;

    const message = {
        target: await appProxyContract.getAddress(),
        methodName: 'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'address', 'uint256'],
            [
                tokenA, 
                tokenB, 
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
            {tokenAddress: tokenLPAB, amount: liquidity},
        ],
    };

    await sendSimpleMessage(message);

    await printBalances('\nBalances after operation');

    if (showEvents) {
        console.log('\n------------------- Events -------------------\n')
        printEvents(receipt, crossChainLayerContract);
    }
}


main();
