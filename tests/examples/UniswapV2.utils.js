const {
    balanceFormat, 
    getContract,
    getTokenContract,
    loadContractAddress,
 } = require('../../scripts/utils.js');

const factoryArtifact = require("@uniswap/v2-core/build/UniswapV2Factory.json");
const routerArtifact = require("@uniswap/v2-periphery/build/IUniswapV2Router02");


async function printContractBalance(name, contractAddress, tokenAddresses, tokens) {
    console.log(`${name} balances:`);

    for (const tokenName of tokens) {
        const tokenAddress = tokenAddresses[tokenName];
        const tokenContract = await getTokenContract(tokenAddress);
        const tokenBalance = await tokenContract.balanceOf(contractAddress)
        const tokenDigits = await tokenContract.decimals()
        console.log(`  ${tokenName}:`.padEnd(13, ' '), balanceFormat(tokenBalance, tokenDigits));
    }
}


async function printBalances(name) {
    // list all tokens
    const tokenTKAAddress = loadContractAddress('TKA');
    const tokenTKBAddress = loadContractAddress('TKB');
    const tokenTKCAddress = loadContractAddress('TKC');
    const tokenWETHAddress = loadContractAddress('WETH');
    const factoryContract = await getContract('UniswapV2Factory', 'UniswapV2Factory', factoryArtifact);
    const tokenLPABAddress = await factoryContract.getPair(tokenTKAAddress, tokenTKBAddress)

    const tokenAddresses = {
        'TKA': tokenTKAAddress,
        'TKB': tokenTKBAddress,
        'TKC': tokenTKCAddress,
        'WETH': tokenWETHAddress,
        'LP-TKA-TKB': tokenLPABAddress,
    };

    console.log(`----------------- ${name}:`);

    const cclContract = await getContract('CrossChainLayer', 'CrossChainLayer');
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


async function baseSetUp() {
    const factoryContract = await getContract('UniswapV2Factory', 'UniswapV2Factory', factoryArtifact);
    const tokenTKAContract = await getContract('CrossChainLayerToken', 'TKA');
    const tokenTKBContract = await getContract('CrossChainLayerToken', 'TKB');
    const tokenTKCContract = await getContract('CrossChainLayerToken', 'TKC');

    // ensure token pairs
    const tokenPairs = [
        [tokenTKAContract, tokenTKBContract],
        [tokenTKBContract, tokenTKCContract],
        [tokenTKCContract, tokenTKAContract],
    ];
    for (const tokenPair of tokenPairs) {
        const pairAddress = await factoryContract.getPair(
            await tokenPair[0].getAddress(),
            await tokenPair[1].getAddress()
        )
        if (pairAddress == 0x0000000000000000000000000000000000000000) {
            await factoryContract.createPair(await tokenPair[0].getAddress(), await tokenPair[1].getAddress())
        }
    }
}


module.exports = {
    baseSetUp,
    printBalances,
    printContractBalance
};
