const { ethers } = require('hardhat')

const {
    useContract,
    getContract,
    printEvents,
    sendSimpleMessage,
} = require('../utils.js');
const { 
    printBalances, 
    getPoolFinderContract, 
    getImplementationContract 
} = require('./utils.js');


async function main(tokenA, tokenB, showEvents = false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('CurveLiteTwocryptoswapProxy', 'CurveLiteTwocryptoswapProxy', null, process.env.CURVE_LITE_TWOCRYPTOSWAP_PROXY_ADDRESS);
    const poolFinder = await getPoolFinderContract(process.env.CURVE_LITE_TWOCRYPTOSWAP_FACTORY_ADDRESS);
    const poolAddress = await poolFinder.find_pool_for_coins(tokenA, tokenB, 0);
    const poolImplementation = await getImplementationContract(poolAddress);

    console.log('Pool address', poolAddress);

    await printBalances('\nBalances before operation', poolAddress);

    const amountA = 1000000n * 10n ** 9n;
    const amountB = 2000000n * 10n ** 9n;

    const message = {
        target: await appProxyContract.getAddress(),
        methodName: 'addLiquidity(address,uint256[2],uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'uint256[2]', 'uint256'],
            [
                poolAddress,
                [amountA, amountB],
                0
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            { tokenAddress: tokenA, amount: amountA },
            { tokenAddress: tokenB, amount: amountB },
        ],
        unlock: [],
    };

    const receipt = await sendSimpleMessage(message);

    await printBalances('\nBalances after operation', poolAddress);

    if (showEvents) {
        await printEvents(receipt, crossChainLayerContract);
    }

    dx = 10n**9n;
    dy = await poolImplementation.get_dy(0, 1, dx);
    console.log('current pool price:', Number(dy)/Number(dx));
}


main(
    // process.env.EVM_TKA_ADDRESS,
    // process.env.EVM_TKB_ADDRESS,
    '0x2CB284c531fB21A70E2c24EDe980239e643b7B5d',
    '0x928d8Aa02a9Fd54ad3E203f7d79A03d1077c51F5',
    true
);
