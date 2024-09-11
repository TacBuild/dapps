const { ethers } = require('hardhat')

const {
    useContract,
    getContract,
    printEvents,
    loadContractAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalancesTKATKBTKC, getPoolFinderContract } = require('./utils.js');


async function main(showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('CurveLiteTricryptoswapProxy', 'CurveLiteTricryptoswapProxy', null, process.env.CURVE_LITE_TRICRYPTOSWAP_PROXY_ADDRESS);
    const poolFinder = await getPoolFinderContract(process.env.CURVE_LITE_TRICRYPTOSWAP_FACTORY_ADDRESS)
    
    const tokenA = process.env.EVM_TKA_ADDRESS;
    const tokenB = process.env.EVM_TKB_ADDRESS;
    const tokenC = process.env.EVM_TKC_ADDRESS;

    const poolAddress = await poolFinder.find_pool_for_coins(tokenA,tokenB,0)

    await printBalancesTKATKBTKC('\nBalances before operation', poolAddress);
    
    const amount = 10n**8n;

    const message = {
        target: await appProxyContract.getAddress(),
        methodName: 'removeLiquidity(address,uint256,uint256[3])',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'uint256', 'uint256[3]'],
            [
                poolAddress, 
                amount, 
                [0,0,0]
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [],
        unlock: [
            {tokenAddress: poolAddress, amount: amount},
        ],
    };

    const receipt = await sendSimpleMessage(message);

    await printBalancesTKATKBTKC('\nBalances after operation', poolAddress);

    if (showEvents) {
        printEvents(receipt, crossChainLayerContract);
    }
}


main(true);
