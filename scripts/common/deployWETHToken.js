const { deployToken } = require('../utils.js');


async function main() {
    const wethAddress = await deployToken(
        "Token wETH", 
        "wETH", 
        9,
        "Wrapped Ethereum",
        "http://sample/weth.png",
        process.env.TVM_WETH_ADDRESS,
    );

    console.log(wethAddress);  
}

main();
