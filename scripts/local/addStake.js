const { ethers } = require('hardhat');
const { useContract, sendSimpleMessage } = require('../../scripts/utils.js');
async function main(sequencerAddress, sequencerStake) {
 const stakeVaultAddress = process.env.EVM_STAKEVAULT_ADDRESS;
 const stakeVaultContract = await useContract('IStakeVault', stakeVaultAddress);
 const message = {
 target: await stakeVaultContract.getAddress(),
 methodName: 'updateSequencerStake(address,uint256)',
 arguments: new ethers.AbiCoder().encode(
 ['address', 'uint256'], [sequencerAddress, sequencerStake]
 ),
 caller: 'EQCEuIGH8I2bkAf8rLpuxkWmDJ_xZedEHDvjs6aCAN2FrkFp',
 mint: [],
 unlock: [],
 deploy: [],
 };
 await sendSimpleMessage(message, verbose=true);
 console.log('Sequencers with stakes:', await stakeVaultContract.
getAllSequencersWithStakes());
}
main('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 1000);