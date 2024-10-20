const { deployToken } = require('../utils.js');


async function main() {
    const wethAddress = await deployToken(
        process.env.TVM_WETH_NAME, 
        process.env.TVM_WETH_SYMBOL, 
        process.env.TVM_WETH_DECIMALS, 
        process.env.TVM_WETH_ADDRESS,
    );

    console.log(wethAddress);  
}


main();
