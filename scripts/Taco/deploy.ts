import hre, { ethers } from 'hardhat';
import path from 'path';
import { TacoProxy } from '../../typechain-types/';
import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";
import { Signer } from 'ethers';
import { tacoTestnetConfig } from './config/testnetConfig';
import { tacoMainnetConfig } from './config/mainnetConfig';

export async function deployTacoProxy(deployer: Signer, tacoConfig: TacoConfig, crossChainLayerAddress: string): Promise<TacoProxy> {
    // Proxy
    const tacoProxy = await deploy<TacoProxy>(
        deployer,
        hre.artifacts.readArtifactSync('TacoProxy'),
        [tacoConfig.tacoV2Proxy02, tacoConfig.tacoFeeRouteProxy, crossChainLayerAddress],
        undefined,
        true
    );

    return tacoProxy;
}

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const config = process.env.DEPLOY_ENV === "mainnet" ? tacoMainnetConfig : tacoTestnetConfig;

    // Taco protocol is already deployed, save addresses
    saveContractAddress(addressesFilePath, 'tacoV2Proxy02', config.tacoV2Proxy02);
    saveContractAddress(addressesFilePath, 'tacoFeeRouteProxy', config.tacoFeeRouteProxy);
    saveContractAddress(addressesFilePath, 'tacoDVMFactory', config.tacoDVMFactory);
    saveContractAddress(addressesFilePath, 'tacoApprove', config.tacoApprove);
    saveContractAddress(addressesFilePath, 'tacoWETH', config.tacoWETH);

    const tacoProxy = await deployTacoProxy(deployer, config, await tacContracts.crossChainLayer.getAddress());

    saveContractAddress(addressesFilePath, 'tacoProxy', await tacoProxy.getAddress());
}


main();
