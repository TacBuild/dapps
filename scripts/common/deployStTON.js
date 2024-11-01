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

    console.log(tokenAAddress);
}

main();
