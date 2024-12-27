import hre, { ethers } from 'hardhat';
import path from 'path';
import { TacoProxy } from '../../typechain-types/';
import { deploy, loadTacContracts, saveContractAddress } from "tac-l2-ccl";


async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);
    const addressesFilePath = path.resolve(__dirname, '../../addresses.json');
    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    // Taco protocol is already deployed, save addresses
    const tacoV2Proxy02Address = process.env.DODO_V2PROXY02_ADDRESS as string;
    const tacoFeeRouteProxyAddress = process.env.DODO_FEEROUTEPROXY_ADDRESS as string
    const dfmFactoryAddress = process.env.DODO_DVMFACTORY_ADDRESS as string
    saveContractAddress(addressesFilePath, 'tacoV2Proxy02', tacoV2Proxy02Address);
    saveContractAddress(addressesFilePath, 'tacoFeeRouteProxy', tacoFeeRouteProxyAddress);
    saveContractAddress(addressesFilePath, 'dfmFactory', dfmFactoryAddress);

    // Proxy
    const tacoProxy = await deploy<TacoProxy>(deployer, hre.artifacts.readArtifactSync('TacoProxy'), [tacoV2Proxy02Address, await tacContracts.settings.getAddress()], undefined, true);
    saveContractAddress(addressesFilePath, 'tacoProxy', await tacoProxy.getAddress());
}


main();
