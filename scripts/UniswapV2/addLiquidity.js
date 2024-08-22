const { ethers } = require('hardhat')

const {
    useContract,
    printEvents,
    getContract,
    loadContractAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');


async function main() {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy');

    await printBalances('\nBalances before operation');

    const tokenA = loadContractAddress('TKA');
    const tokenB = loadContractAddress('TKB');
    const amountADesired = 10000n * 10n**9n;
    const amountBDesired = 20000n * 10n**9n;
    const amountAMin = 5000n * 10n**9n;
    const amountBMin = 10000n * 10n**9n;
    const to = await appProxyContract.getAddress();
    const deadline = 19010987500n;
    const message = {
        target: await appProxyContract.getAddress(),
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
                deadline]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {tokenAddress: tokenA, amount: amountADesired},
            {tokenAddress: tokenB, amount: amountBDesired},
        ],
        unlock: [],
    };

    const tx = await sendSimpleMessage(message);
    const receipt = await tx.wait()

    await printBalances('\nBalances after operation');

    console.log('\n------------------- Events -------------------\n')
    console.log('>>>>>>>>', receipt.logs)
    printEvents(receipt, crossChainLayerContract);
}


main();
