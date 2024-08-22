const {
    useContract,
    getContract,
    loadContractAddress,
    printContractBalance,
} = require('../utils.js');

const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerArtifact = require("@uniswap/v2-periphery/build/IUniswapV2Router02");


async function printBalances(name) {
    const tokenTKAAddress = loadContractAddress('TKA');
    const tokenTKBAddress = loadContractAddress('TKB');
    const tokenWETHAddress = loadContractAddress('WETH');
    const factoryContract = await getContract('UniswapV2Factory', 'UniswapV2Factory', factoryArtifact);
    const tokenLPABAddress = await factoryContract.getPair(tokenTKAAddress, tokenTKBAddress)

    const tokenAddresses = {
        'TKA': tokenTKAAddress,
        'TKB': tokenTKBAddress,
        'WETH': tokenWETHAddress,
        'LP-TKA-TKB': tokenLPABAddress,
    };

    console.log(`----------------- ${name}:`);

    const cclContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    await printContractBalance(
        'CrossChainLayer', await cclContract.getAddress(), tokenAddresses,
        ['TKA', 'TKB', 'LP-TKA-TKB']
    )

    const appProxyContract = await getContract('UniswapV2Proxy', 'UniswapV2Proxy');
    await printContractBalance(
        'UniswapV2Proxy', await appProxyContract.getAddress(), tokenAddresses,
        ['TKA', 'TKB', 'LP-TKA-TKB']
    )

    const appContract = await getContract('UniswapV2Router02', 'UniswapV2Router02', routerArtifact);
    await printContractBalance(
        'UniswapV2Router02', await appContract.getAddress(), tokenAddresses,
        ['TKA', 'TKB', 'LP-TKA-TKB']
    )

    const pairContractAddress = tokenLPABAddress;
    await printContractBalance(
        'TKA-TKB Pair', pairContractAddress, tokenAddresses,
        ['TKA', 'TKB', 'LP-TKA-TKB']
    )
}


module.exports = {
    printBalances,
};
