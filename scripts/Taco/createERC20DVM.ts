import hre, { ethers } from 'hardhat';
import path from 'path';
import { printEvents, printBalances } from '../utils';
import { getCCLArtifacts, loadTacContracts, loadGroupContracts } from "tac-l2-ccl";
import { CrossChainLayerToken } from "tac-l2-ccl/dist/typechain-types";
import { loadContractFromFile } from "../utils";
import { sendSimpleMessage } from 'tac-l2-ccl';
import { InMessageStruct } from 'tac-l2-ccl/dist/typechain-types/contracts/L2/CrossChainLayer';
import { IDVMFactory, TacoProxy } from "../../typechain-types";


async function main(showEvents=false) {
    const sequencerSigner = new ethers.Wallet(process.env.SEQUENCER_PRIVATE_KEY_EVM!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const cclArtifacts = await getCCLArtifacts();
    const tacContracts = await loadTacContracts(addressesFilePath, sequencerSigner);
    const tokenA = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'stTON', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, sequencerSigner);
    const tokenB = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'TAC', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, sequencerSigner);
    const groups = await loadGroupContracts(addressesFilePath, sequencerSigner, ["Group-0"]);
    const tacoDFMFactory = loadContractFromFile<IDVMFactory>(addressesFilePath, 'tacoDFMFactory', hre.artifacts.readArtifactSync('IDVMFactory').abi, sequencerSigner);
    const tacoProxy = loadContractFromFile<TacoProxy>(addressesFilePath, 'tacoProxy', hre.artifacts.readArtifactSync('TacoProxy').abi, sequencerSigner);

    let pools = await tacoDFMFactory.getDODOPool(await tokenA.getAddress(), await tokenB.getAddress());
    if (pools.length != 0) {
        console.log('pool already exists');
        return
    }

    const baseTokenDecimals = await tokenA.decimals();
    const quoteTokenDecimals = await tokenB.decimals();
    const baseToken = await tokenA.getAddress();
    const quoteToken = await tokenB.getAddress();
    const baseInAmount = 2000n * 10n**9n;
    const quoteInAmount = 1000n * 10n**9n;
    const lpFeeRate = 5000000n *10n**9n;
    const i = 1n * 10n**(18n - baseTokenDecimals + quoteTokenDecimals);
    const k = 100000n * 10n**9n;
    const isOpenTWAP = false;
    const deadLine = 19010987500n;

    const message: InMessageStruct = {
        queryId: 5,
        operationId: 'TACO test add ERC20 DVM',
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
        target: await tacoProxy.getAddress(),
        methodName: 'createDODOVendingMachine(address,address,uint256,uint256,uint256,uint256,uint256,bool,uint256)',
        arguments: new ethers.AbiCoder().encode(
            ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bool', 'uint256'],
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
        ),
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [
            {l2Address: await tokenA.getAddress(), amount: baseInAmount},
            {l2Address: await tokenB.getAddress(), amount: quoteInAmount},
        ],
        unlock: [],
        meta: [],  // tokens are already exist, no need to fill meta
    };

    const receipt = await sendSimpleMessage([sequencerSigner], message, [tacContracts, groups], true);

    pools = await tacoDFMFactory.getDODOPool(await tokenA.getAddress(), await tokenB.getAddress());
    console.log('pool successfully created:', pools.length != 0);

    if (showEvents) {
        printEvents(receipt!, tacContracts.crossChainLayer);
    }
}


main(true);
