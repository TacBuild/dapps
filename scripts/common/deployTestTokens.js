const { deployToken } = require('../utils.js');


async function main() {
    const tokenAAddress = await deployToken(
        process.env.TVM_TKA_NAME, 
        process.env.TVM_TKA_SYMBOL, 
        process.env.TVM_TKA_DECIMALS, 
        process.env.TVM_TKA_ADDRESS,
    );
    const tokenBAddress = await deployToken(
        process.env.TVM_TKB_NAME, 
        process.env.TVM_TKB_SYMBOL, 
        process.env.TVM_TKB_DECIMALS, 
        process.env.TVM_TKB_ADDRESS,
    );

    console.log(tokenAAddress, tokenBAddress);    
}

main();
