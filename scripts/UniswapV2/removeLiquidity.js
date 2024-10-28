const { ethers } = require('hardhat')

const {
    printEvents,
    useContract,
    getContract,
    getTokenAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');

const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");


async function main(showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy', null, process.env.UNISWAPV2_PROXY_ADDRESS);
    const factoryContract = await getContract('UniswapV2Factory', 'UniswapV2Factory', factoryArtifact,  process.env.UNISWAPV2_FACTORY_ADDRESS);
    
    await printBalances('\nBalances before operation');

    const tokenA = await getTokenAddress(process.env.TVM_TKA_ADDRESS);
    const tokenB = await getTokenAddress(process.env.TVM_TKB_ADDRESS);
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
            {l2Address: tokenLPAB, amount: liquidity},
        ],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessage(message);

    await printBalances('\nBalances after operation');

    if (showEvents) {
        await printEvents(receipt, crossChainLayerContract);
    }
}


main();
