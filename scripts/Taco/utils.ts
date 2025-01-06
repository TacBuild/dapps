import hre from "hardhat";
import path from 'path';
import { getCCLArtifacts, loadTacContracts, loadGroupContracts } from "tac-l2-ccl";
import { CrossChainLayerToken } from "tac-l2-ccl/dist/typechain-types";
import { loadContractFromFile, loadERC20FromFile } from "../utils";
import { Signer } from "ethers";
import { ERC20 } from "tac-l2-ccl/dist/typechain-types";
import { TacoProxy, IDODOV2Proxy01, IDODOFeeRouteProxy, IDVMFactory, IDODOApprove } from "../../typechain-types";


async function ensurePairs(
    signer: Signer,
    tacoProxy: TacoProxy,
    tacoV2Proxy02: IDODOV2Proxy01,
    tacoDFMFactory: IDVMFactory,
    tacoApprove: IDODOApprove,
    tokenWETH: ERC20,
    tokenA: ERC20,
    tokenB: ERC20,
) {
    console.log('ensuring ERC20 and Native pools...');
    console.log('signer:', await signer.getAddress());
    console.log('token', await tokenA.getAddress(), 'balance:', await tokenA.balanceOf(await signer.getAddress()));
    console.log('token', await tokenB.getAddress(), 'balance:', await tokenB.balanceOf(await signer.getAddress()));
    console.log('native balance:', await (signer.provider!).getBalance(await signer.getAddress()));
    console.log('Taco V2 proxy:', await tacoV2Proxy02.getAddress());

    const tacoNativeAddress = await tacoProxy._ETH_ADDRESS_();
    const tacoWETHAddress = await tokenWETH.getAddress();

    const result: string[] = [];

    const tokenPairs = [
        [tokenA, tokenB],
        [tokenWETH, tokenA],
        [tokenWETH, tokenB],
        [tokenA, tokenWETH],
        [tokenB, tokenWETH],
    ];
    for (const tokenPair of tokenPairs) {
        const baseToken = tokenPair[0];
        const isBaseNative = (baseToken == tokenWETH);
        const baseTokenAddress = isBaseNative ? tacoNativeAddress : await baseToken.getAddress();
        const baseTokenDecimals = isBaseNative ? 18n : await baseToken.decimals();

        const quoteToken = tokenPair[1];
        const isQuoteNative = (quoteToken == tokenWETH);
        const quoteTokenAddress = isQuoteNative ? tacoNativeAddress : await quoteToken.getAddress();
        const quoteTokenDecimals = isQuoteNative ? 18n : await quoteToken.decimals();

        console.log(`\nensuring ${baseTokenAddress} - ${quoteTokenAddress} pool...`);

        let pools = await tacoDFMFactory.getDODOPool(
            isBaseNative ? tacoWETHAddress : baseTokenAddress,
            isQuoteNative ? tacoWETHAddress : quoteTokenAddress
        );
        if (pools.length > 0) {
            console.log(`pool exists: ${pools[0]}`);
            result.push(pools[0]);
            continue;
        }

        const baseInAmount = 2000n * 10n**9n;
        const quoteInAmount = 1000n * 10n**9n;
        const lpFeeRate = 5000000n *10n**9n;
        const i = 1n * 10n**(18n - baseTokenDecimals + quoteTokenDecimals);
        const k = 100000n * 10n**9n;
        const isOpenTWAP = false;
        const deadLine = 19010987500n;
        const value = (isBaseNative ? baseInAmount : 0n) + (isQuoteNative ? quoteInAmount : 0n);

        if (!isBaseNative) {
            const txApproveA = await tokenA.connect(signer).approve(await tacoApprove.getAddress(), baseInAmount);
            const receiptA = await txApproveA.wait();
            if (receiptA?.status != 1) {
                console.log('error creating approving base token');
                continue;
            }
            console.log('Base token approved: ', baseInAmount, 'to', await tacoApprove.getAddress());
        }

        if (!isQuoteNative) {
            const txApproveB = await tokenB.connect(signer).approve(await tacoApprove.getAddress(), quoteInAmount);
            const receiptB = await txApproveB.wait();
            if (receiptB?.status != 1) {
                console.log('error creating approving quote token');
                continue;
            }
            console.log('Quote token approved:', quoteInAmount, 'to', await tacoApprove.getAddress());
        }

        const tx = await tacoV2Proxy02.connect(signer).createDODOVendingMachine(
            baseTokenAddress,
            quoteTokenAddress,
            baseInAmount,
            quoteInAmount,
            lpFeeRate,
            i,
            k,
            isOpenTWAP,
            deadLine,
            {
                value: value,
            }
        );
        const receipt = await tx.wait();
        if (receipt?.status != 1) {
            console.log('error creating a pool');
            continue;
        }

        pools = await tacoDFMFactory.getDODOPool(
            isBaseNative ? tacoWETHAddress : baseTokenAddress,
            isQuoteNative ? tacoWETHAddress : quoteTokenAddress
        );
        result.push(pools[0]);

        console.log(`pool successfully deployed: ${pools[0]}`);
    }

    return result;
}

export async function loadTacoTestEnv(signer: Signer) {
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const cclArtifacts = await getCCLArtifacts();
    const tokenA = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'stTON', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);
    const tokenB = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'TAC', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);
    const groups = await loadGroupContracts(addressesFilePath, signer, ["Group-0"]);

    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    const tacoProxy = loadContractFromFile<TacoProxy>(addressesFilePath, 'tacoProxy', hre.artifacts.readArtifactSync('TacoProxy').abi, signer);
    const tacoV2Proxy02 = loadContractFromFile<IDODOV2Proxy01>(addressesFilePath, 'tacoV2Proxy02', hre.artifacts.readArtifactSync('IDODOV2Proxy01').abi, signer);
    const tacoFeeRouteProxy = loadContractFromFile<IDODOFeeRouteProxy>(addressesFilePath, 'tacoFeeRouteProxy', hre.artifacts.readArtifactSync('IDODOFeeRouteProxy').abi, signer);
    const tacoDFMFactory = loadContractFromFile<IDVMFactory>(addressesFilePath, 'tacoDFMFactory', hre.artifacts.readArtifactSync('IDVMFactory').abi, signer);
    const tacoApprove = loadContractFromFile<IDODOApprove>(addressesFilePath, 'tacoApprove', hre.artifacts.readArtifactSync('IDODOApprove').abi, signer);
    const tacoWETH = loadERC20FromFile(addressesFilePath, 'tacoWETH', signer);

    await ensurePairs(signer, tacoProxy, tacoV2Proxy02, tacoDFMFactory, tacoApprove, tacoWETH, tokenA, tokenB);

    return { 
        tokenA, 
        tokenB, 
        tacContracts, 
        groups, 
        tacoProxy, 
        tacoV2Proxy02, 
        tacoFeeRouteProxy, 
        tacoDFMFactory, 
        tacoApprove,
    }
}
