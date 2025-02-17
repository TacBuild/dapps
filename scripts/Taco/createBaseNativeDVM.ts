import { ethers } from 'hardhat';
import path from 'path';
import { printEvents, loadERC20FromFile } from '../utils';
import { loadTacoTestEnv } from './utils';
import { sendSimpleMessageV1 } from 'tac-l2-ccl';
import { InMessageV1Struct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/Structs.sol/IStructsInterface';


async function main(showEvents=false) {
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const {
        tokenA,
        tokenB,
        tacContracts,
        tacoProxy,
        tacoV2Proxy02,
        tacoFeeRouteProxy,
        tacoDFMFactory,
        tacoApprove,
    } = await loadTacoTestEnv(sequencerSigner, false);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacoNativeAddress = await tacoProxy._ETH_ADDRESS_();
    const tacoWETH = loadERC20FromFile(addressesFilePath, 'tacoWETH', sequencerSigner);
    const tacNativeAddress = await tacContracts.crossChainLayer.NATIVE_TOKEN_ADDRESS();

    let pools = await tacoDFMFactory.getDODOPool(await tacoWETH.getAddress(), await tokenA.getAddress());
    if (pools.length != 0) {
        console.log(`pool already exists: ${pools[0]}`);
        return
    }

    const baseTokenDecimals = 18n;
    const quoteTokenDecimals = await tokenA.decimals();
    const baseToken = tacoNativeAddress;
    const quoteToken = await tokenA.getAddress();
    const baseInAmount = 2000n * 10n**9n;
    const quoteInAmount = 1000n * 10n**9n;
    const lpFeeRate = 5000000n *10n**9n;
    const i = 1n * 10n**(18n - baseTokenDecimals + quoteTokenDecimals);
    const k = 100000n * 10n**9n;
    const isOpenTWAP = false;
    const deadLine = 19010987500n;

    const message: InMessageV1Struct = {
        shardsKey: 5,
        operationId: 'TACO test add ERC20 DVM',
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: await tacoProxy.getAddress(),
        methodName: 'createDODOVendingMachine(bytes,bytes)',
        arguments: new ethers.AbiCoder().encode(
            ['tuple(address,address,uint256,uint256,uint256,uint256,uint256,bool,uint256)'],
            [
                [
                    baseToken,
                    quoteToken,
                    baseInAmount,
                    quoteInAmount,
                    lpFeeRate,
                    i,
                    k,
                    isOpenTWAP,
                    deadLine,
                ]
            ]
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {l2Address: await tokenA.getAddress(), amount: quoteInAmount},
        ],
        unlock: [
            {l2Address: tacNativeAddress, amount: baseInAmount},
        ],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessageV1([sequencerSigner], message, tacContracts, "0x", true);

    pools = await tacoDFMFactory.getDODOPool(await tacoWETH.getAddress(), await tokenA.getAddress());
    console.log('pool successfully created:', pools.length != 0);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}


main(true);
