const { deploy, loadContractAddress } = require('../utils.js');

const factoryArtifact = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const routerArtifact = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');


async function main() {
    const settingsAddress = process.env.EVM_SETTINGS_ADDRESS;
    const wethAddress = loadContractAddress('wETH');
    const tkaAddress = loadContractAddress('TKA');
    const tkbAddress = loadContractAddress('TKB');
    const tkcAddress = loadContractAddress('TKC');

    // Factory 
    const uniswapV2Factory = await deploy('UniswapV2Factory', 'UniswapV2Factory', ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'], factoryArtifact);

    // Router
    const uniswapV2Router02 = await deploy('UniswapV2Router02', 'UniswapV2Router02', [await uniswapV2Factory.getAddress(), wethAddress], routerArtifact);

    // Proxy
    await deploy('UniswapV2Proxy', 'UniswapV2Proxy', [await uniswapV2Router02.getAddress(), settingsAddress]);

    // Ensure token pairs
    const tokenPairs = [
        [tkaAddress, tkbAddress],
        [tkbAddress, tkcAddress],
        [tkcAddress, tkaAddress],
    ];
    for (const tokenPair of tokenPairs) {
        const pairAddress = await uniswapV2Factory.getPair(tokenPair[0], tokenPair[1])
        if (pairAddress == 0x0000000000000000000000000000000000000000) {
            const tx = await uniswapV2Factory.createPair(tokenPair[0], tokenPair[1]);
            await tx.wait();
        }
    }
}


main();
