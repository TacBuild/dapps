const { deploy, loadContractAddress } = require('../utils.js');

async function main() {
    const settingsAddress = process.env.EVM_SETTINGS_ADDRESS;
    const CurveRouterAddress = process.env.CURVE_LITE_ROUTER_ADDRESS;
    await deploy('CurveLiteProxy', 'CurveLiteProxy', [CurveRouterAddress, settingsAddress]);
}


main();
