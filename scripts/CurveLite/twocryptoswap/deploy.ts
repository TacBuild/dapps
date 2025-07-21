import { ethers, upgrades  } from 'hardhat';
import { loadTacContracts, saveContractAddress } from "@tonappchain/evm-ccl";
import { deployCurveLiteTwocryptoswapProxy } from './deployProxy';
import { deployTacSAFactory } from '../../TacSmartAccountFactory/FactoryDeploy';
import { deployTacSmartAccount } from '../../TacSmartAccountFactory/SABlueprintDeploy';
import path from 'path';

async function main() {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const addressesFilePath = path.resolve(__dirname, '../../../addresses.json');

    const tacContracts = await loadTacContracts(addressesFilePath, deployer);

    const tacNativeAddress = await tacContracts.crossChainLayer.NATIVE_TOKEN_ADDRESS();

    console.log("---------------------------", tacNativeAddress, "---------------------------")

    // const tacSmartAccount = await deployTacSmartAccount(deployer);

    // const tacSAFactory = await deployTacSAFactory(deployer, await tacSmartAccount.getAddress());

    const CurveLiteTwocryptoswapProxy = await deployCurveLiteTwocryptoswapProxy(deployer, "0x070820Ed658860f77138d71f74EfbE173775895b", await tacContracts.crossChainLayer.getAddress(), tacNativeAddress);

    saveContractAddress(addressesFilePath, 'CurveLiteTwocryptoswapProxy', await CurveLiteTwocryptoswapProxy.getAddress());



}


main();
