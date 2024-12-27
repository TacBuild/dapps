import hre from "hardhat";
import path from 'path';
import { getCCLArtifacts, loadTacContracts, loadGroupContracts } from "tac-l2-ccl";
import { CrossChainLayerToken } from "tac-l2-ccl/dist/typechain-types";
import { loadContractFromFile } from "../utils";
import { Signer } from "ethers";
import { ERC20 } from "tac-l2-ccl/dist/typechain-types";
import { TacoProxy, IDODOV2Proxy01, IDODOFeeRouteProxy, IDVMFactory } from "../../typechain-types";
import { token } from "tac-l2-ccl/dist/typechain-types/@openzeppelin/contracts";


async function ensurePairs(
    signer: Signer,
    tacoProxy: TacoProxy,
    tacoV2Proxy02: IDODOV2Proxy01,
    dvmFactory: IDVMFactory,
    tokenA: ERC20,
    tokenB: ERC20,
) {
    console.log('ensuring ERC20 and Native pools...');

    const tacoNativeAddress = await tacoProxy._ETH_ADDRESS_();
    const result: string[] = [];

    const tokenPairs = [
        [tacoNativeAddress, await tokenB.getAddress()],
        [await tokenA.getAddress(), tacoNativeAddress],
        [await tokenA.getAddress(), await tokenB.getAddress()],
    ];
    for (const tokenPair of tokenPairs) {
        console.log(`ensuring ${tokenPair[0]}-${tokenPair[1]} pool...`);

        let pools = await dvmFactory.getDODOPool(tokenPair[0], tokenPair[1]);
        if (pools.length > 0) {
            console.log(`pool exists: ${pools[0]}`);
            result.push(pools[0]);
            continue;
        }

        const baseToken = tokenPair[0];
        const quoteToken = tokenPair[1];
        const baseInAmount = 1n * 10n**17n;
        const quoteInAmount = 2000n * 10n**9n;
        const lpFeeRate = 5000000n *10n**9n;
        const i = 1n * 10n**9n;
        const k = 100000n * 10n**9n;
        const isOpenTWAP = false;
        const deadLine = 19010987500n;
        let value = 0n;
        if (tokenPair[0] == tacoNativeAddress) {
            value = baseInAmount;
        } else if (tokenPair[1] == tacoNativeAddress) {
            value = quoteInAmount;
        }

        const tx = await tacoV2Proxy02.connect(signer).createDODOVendingMachine(
            baseToken,
            quoteToken,
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

        pools = await dvmFactory.getDODOPool(tokenPair[0], tokenPair[1]);
        result.push(pools[0]);

        console.log(`pool successfully deployed: ${pools[0]}`);
    }

    return result;
}

export async function loadTacoTestEnv(signer: Signer) {
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');

    const cclArtifacts = await getCCLArtifacts();
    const tokenA = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'TAC', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);
    const tokenB = loadContractFromFile<CrossChainLayerToken>(addressesFilePath, 'stTON', cclArtifacts.readArtifactSync('CrossChainLayerToken').abi, signer);
    const groups = await loadGroupContracts(addressesFilePath, signer, ["Group-0"]);

    const tacContracts = await loadTacContracts(addressesFilePath, signer);
    const tacoProxy = loadContractFromFile<TacoProxy>(addressesFilePath, 'tacoProxy', hre.artifacts.readArtifactSync('TacoProxy').abi, signer);
    const tacoV2Proxy02 = loadContractFromFile<IDODOV2Proxy01>(addressesFilePath, 'tacoV2Proxy02', hre.artifacts.readArtifactSync('IDODOV2Proxy01').abi, signer);
    const tacoFeeRouteProxy = loadContractFromFile<IDODOFeeRouteProxy>(addressesFilePath, 'tacoFeeRouteProxy', hre.artifacts.readArtifactSync('IDODOFeeRouteProxy').abi, signer);
    const dfmFactory = loadContractFromFile<IDVMFactory>(addressesFilePath, 'dfmFactory', hre.artifacts.readArtifactSync('IDVMFactory').abi, signer);

    await ensurePairs(signer, tacoProxy, tacoV2Proxy02, dfmFactory, tokenA, tokenB);

    return { tokenA, tokenB, tacContracts, groups, tacoProxy, tacoV2Proxy02, tacoFeeRouteProxy, dfmFactory }
}
