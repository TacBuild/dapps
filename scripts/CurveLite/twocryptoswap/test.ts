import { getConfig } from '@setup';
import { TestTacSdk } from '@testTacSdk';
import { ethers, Wallet } from 'ethers';

import FactoryAbi from './factoryAbi.json'

const poolPresetParams = {
    implementation_id: 0,
    A: 20000000n,
    gamma: 1000000000000000n,
    mid_fee: 5000000n,
    out_fee: 45000000n,
    fee_gamma: 5000000000000000n,
    allowed_extra_profit: 10000000000n,
    adjustment_step: 5500000000000n,
    ma_exp_time: 866n,
    initial_price: 10n ** 18n
}

describe('Add liquidity ', () => {
    const config = getConfig();
    jest.setTimeout(500_000); //ms, test lasts ~450sec

    const provider = new ethers.JsonRpcProvider("https://newyork-inap-72-251-230-233.ankr.com/tac_tacd_testnet_full_rpc_1");

    const TVM_TKA_ADDRESS = config.TVM_TKA_ADDRESS;
    const TVM_TKB_ADDRESS = config.TVM_TKB_ADDRESS;

    const EVMSender = new Wallet('0x154a43931958078e4f3c56c1b1431d3012e4a80b586f54aee65fa9560c7684c4', provider);
    let testTacSdk: TestTacSdk;

    beforeAll(async () => {
        testTacSdk = new TestTacSdk();

        await testTacSdk.initialize();
    });

    afterAll(async () => {
        await testTacSdk.tacSdk.closeConnections();
    });

    it('should send 2 jettons as single TVM transaction, update EVM pool balance and get LP token back on TVM', async () => {
        const EVM_TKA_ADDRESS = await testTacSdk.getEVMTokenAddressWithWaiter(TVM_TKA_ADDRESS);
        const EVM_TKB_ADDRESS = await testTacSdk.getEVMTokenAddressWithWaiter(TVM_TKB_ADDRESS);
        const gasPrice = ethers.parseUnits("50", "gwei");

        const factoryContract = new ethers.Contract(
            config.EVM_CURVE_LITE_TWOCRYPTOSWAP_FACTORY_ADDRESS,
            FactoryAbi,
            EVMSender,
        );
        const tx = await factoryContract.deploy_pool(
            'TKA-TKB',
            'TKA-TKB',
            [EVM_TKA_ADDRESS, EVM_TKB_ADDRESS],
            ...Object.values(poolPresetParams),
            {
                gasLimit: 5000000,
                gasPrice: gasPrice,
            },
        );
        const receipt = await tx.wait();
        console.log(receipt);
        const poolAddress = await factoryContract.find_pool_for_coins(EVM_TKA_ADDRESS, EVM_TKB_ADDRESS, 0);
        console.log(poolAddress);
    });
});
