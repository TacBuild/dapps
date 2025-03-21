import hre, { ethers, upgrades } from "hardhat";

const proxyAddresses = [
    "0xC137dbdB0029f4BAc9942Cac9499DD8966A5Ec6c",
    // "0x5FFCa38A45b6cb89DE1423fEB8dC4180D9e40125",
    "0xC97d51c60Bc6705B249b2aB8a2ee85D6AA4B9421",
    "0x34B248d6d86948E47AD829B17d22cD9fD38D5289",
    "0x0417ef03d70A1542078B6E348965d8CA7Ae80ea6",
    "0x60eB2f1DF2BBD5B73d734741954557120a7fA4f5",
    "0xe489576feFBf1106cb61a82c08f01aA6a04000E9",
    "0x7CcB999C5955B452B9bF9BEd4387B6eFda9a09Fa",
    "0x1deE3DE260d9d513E0c038eCAE0551eDDdddEDb6",
    "0xaA692f8d64477420Ae657393a4B5a63a0dC6dF59",
    "0xFc3e783aEa18184594cDBD892447ed687c00a3a9",
    "0xc6429EC37bc418187cE90FE200226BcCEf34Ee81",
    "0x289B29981a3F59B0CC25adC3E0493574c8D0D8C2",
    "0x9F0b43D8e8e0906B127934Cf885d7DaEde685930",
    "0x2274adc503a44e389e6D959cb42f87E3492d90e5",
    "0x356aD19A03e2523C9Ed3BA3cE9aD2BD26C1c5234",
    "0xEDAfD52A9CdfDaB5cb21f7eCa9FFB3c926BE5F89",
    "0x9D4BC93B5414d69Afca5c256Ae248EE42B46d5e8",
    "0xABA52Ad65Bc9048Ef6a86110A7a5A4A34E618442"
  ];

async function main(needsForceImport: boolean = false) {

    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, ethers.provider);

    const artifact = hre.artifacts.readArtifactSync("TreasurySwapProxy");
    const ImplFactory = await ethers.getContractFactoryFromArtifact(artifact, deployer);

    for (const proxyAddress of proxyAddresses) {

        if (needsForceImport === true) {
            console.log(`Force importing contract at ${proxyAddress}`);
            await upgrades.forceImport(proxyAddress, ImplFactory, { kind: "uups" });
        } else {
            console.log(`Upgrading contract at ${proxyAddress}`);
            const newImpl = await upgrades.upgradeProxy(proxyAddress, ImplFactory, { kind: "uups" });
            console.log(`Upgrade done`);
        }
    }
}

// set true for force import (if there is no upgrade manifest)
// set false for upgrade
main(true);