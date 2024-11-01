const { deployToken } = require('../utils.js');


async function main() {
    const tokenBAddress = await deployToken(
        "TAC",
        "TAC",
        9,
        "TON Application Chain",
        "http://sample/tac.png",
        process.env.TVM_TKB_ADDRESS,
    );

    console.log(tokenBAddress);
}

main();
