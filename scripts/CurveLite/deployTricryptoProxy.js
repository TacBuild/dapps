const { deploy } = require('../utils.js');

async function main() {
    const settingsAddress = process.env.EVM_SETTINGS_ADDRESS;
    await deploy('CurveLiteTricryptoswapProxy', 'CurveLiteTricryptoswapProxy', [settingsAddress]);
}


main();
