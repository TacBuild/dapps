const { ethers } = require('hardhat')

const {
    useContract,
    getContract,
    printEvents,
    sendSimpleMessage,
    getTokenContract,
} = require('../utils.js');
const {
    printBalances, 
    getPoolFinderContract,
    getImplementationContract,
} = require('./utils.js');


async function main(tokenA, tokenB, showEvents = false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('CurveLiteTwocryptoswapProxy', 'CurveLiteTwocryptoswapProxy', null, process.env.CURVE_LITE_TWOCRYPTOSWAP_PROXY_ADDRESS);
    const poolFinder = await getPoolFinderContract(process.env.CURVE_LITE_TWOCRYPTOSWAP_FACTORY_ADDRESS);
    const poolAddress = await poolFinder.find_pool_for_coins(tokenA, tokenB, 0)
    const poolImplementation = await getImplementationContract(poolAddress);

    console.log('Pool address:', poolAddress);

    await printBalances('\nBalances before operation', poolAddress);

    const amount = 23n * 10n ** 9n;

    console.log(
        `Predicted output:`,
        `\n  Input token:  ${Object.values(await (await getTokenContract(await poolImplementation.coins(0))).getInfo())[1]}`,
        `\n  Output token: ${Object.values(await (await getTokenContract(await poolImplementation.coins(1))).getInfo())[1]}`,
        `\n  Input value:  ${amount}`,
        `\n  Output value: ${await poolImplementation.get_dy(0, 1, amount)}`);

    const message = {
        target: await appProxyContract.getAddress(),
        methodName: 'exchange(address,uint256,uint256,uint256,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
            [
                poolAddress,
                0,
                1,
                amount,
                0
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            { tokenAddress: tokenA, amount: amount },
        ],
        unlock: [],
    };

    const receipt = await sendSimpleMessage(message, verbose=true);

    await printBalances('\nBalances after operation', poolAddress);

    if (showEvents) {
        await printEvents(receipt, crossChainLayerContract);
    }
}


main(
    process.env.EVM_TKA_ADDRESS,
    process.env.EVM_TKB_ADDRESS,
    true,
);
