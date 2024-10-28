const { deployToken } = require('../utils.js');


async function main() {
    const tokenAAddress = await deployToken(
        "stTON", 
        "stTON", 
        9,
        "Staked TON",
        "http://sample/stton.png",
        process.env.TVM_TKA_ADDRESS,
    );
    const tokenBAddress = await deployToken(
        "TAC", 
        "TAC", 
        9,
        "TON Application Chain",
        "http://sample/tac.png",
        process.env.TVM_TKB_ADDRESS,
    );

    console.log(tokenAAddress, tokenBAddress);    
}

main();
