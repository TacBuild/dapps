const { deploy } = require('../utils.js');

const factoryArtifact = require('@uniswap/v2-core/build/UniswapV2Factory.json');
const routerArtifact = require('@uniswap/v2-periphery/build/UniswapV2Router02.json');


async function main() {
    const settingsAddress = process.env.EVM_SETTINGS_ADDRESS;
    const wethAddress = process.env.EVM_WETH_ADDRESS;

    // Factory
    const uniswapV2Factory = await deploy('UniswapV2Factory', 'UniswapV2Factory', [process.env.HADRHAT_ADDRESS], factoryArtifact);

    // Router
    const uniswapV2Router02 = await deploy('UniswapV2Router02', 'UniswapV2Router02', [await uniswapV2Factory.getAddress(), wethAddress], routerArtifact);

    // Proxy
    await deploy('UniswapV2Proxy', 'UniswapV2Proxy', [await uniswapV2Router02.getAddress(), settingsAddress]);
}


main();
