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
    const appProxyContract = await getContract('CurveLiteProxy', 'CurveLiteProxy', null, process.env.CURVE_LITE_PROXY_ADDRESS);

    const tokenA = loadContractAddress('TKA');
    const tokenB = loadContractAddress('TKB');
    const pool = '0xBD362ee863428e117b9E08B46aC195Aa4e536a45';
    // const pool_type = 20 ;// pool_type: 10 - stable-ng, 20 - twocrypto-ng, 30 - tricrypto-ng, 4 - llamma
    // const swap_params = [[0,1,4,20],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
    // 4 - addliq, 1 - swap, 6 - remove
    const to = appProxyContract.getAddress();
    const amount = 1;
    const min_dy = 0

    const deadline = 19010987500n;

    const NA = '0x0000000000000000000000000000000000000000'


    const message = {
        target: to,
        methodName: 'exchange(address[11], uint256[4][5], uint256, uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address[11]', 'uint256[4][5]', 'uint256', 'uint256'],
            [
                [tokenA,pool,tokenB,NA,NA,NA,NA,NA,NA,NA,NA], 
                [[0,1,4,20],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
                amount, 
                min_dy,
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {tokenAddress: tokenA, amount: amount},
            {tokenAddress: tokenB, amount: amount},
        ],
        unlock: [],
    };

    const receipt = await sendSimpleMessage(message);


    if (showEvents) {
        printEvents(receipt, crossChainLayerContract);
    }
}


main(true);
