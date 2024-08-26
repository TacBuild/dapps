const { ethers } = require('hardhat')

const {
    useContract,
    getContract,
    printEvents,
    loadContractAddress,
    sendSimpleMessage,
}  = require('../utils.js');
const { printBalances } = require('./utils.js');


async function main(showEvents=false) {
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const appProxyContract = await getContract('CurveLiteProxy', 'CurveLiteProxy', null, process.env.UNISWAPV2_PROXY_ADDRESS);
    
    //await printBalances('\nBalances before operation');

    const tokenA = loadContractAddress('TKA');
    const tokenB = loadContractAddress('TKB');
    const pool = '';
    const pool_type = 20 ;// pool_type: 10 - stable-ng, 20 - twocrypto-ng, 30 - tricrypto-ng, 4 - llamma
    const swap_params = [[0,1,1,20],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    const to = await appProxyContract.getAddress();
    const amount = 0;
    const min_dy = 0

    

    const deadline = 19010987500n;

    const NA = 0x0000000000000000000000000000000000000000

    const message = {
        target: await appProxyContract.getAddress(),
        methodName: 'exchange(address[11], uint256[4][5], uint256, uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address[11]', 'uint256[4][5]', 'uint256', 'uint256', 'address'],
            [
                [tokenA,pool,tokenB,NA,NA,NA,NA,NA,NA,NA,NA], 
                swap_params, 
                amount, 
                min_dy,
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

    //await printBalances('\nBalances after operation');

    if (showEvents) {
        printEvents(receipt, crossChainLayerContract);
    }
}


main(true);
