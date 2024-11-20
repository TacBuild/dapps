import { ethers } from "hardhat";
const fs = require('fs-extra');
const path = require('path');
const clc = require('cli-color');
const { fromTwos } = require('ethers');
const { timeStamp } = require('console');


const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


function saveContractAddress(instanceName, address) {
    addressFilePath = path.resolve(__dirname, '../addresses.json');

    let addressData = {};
    if (fs.existsSync(addressFilePath)) {
        addressData = JSON.parse(fs.readFileSync(addressFilePath, 'utf8'));
    }
    addressData[instanceName] = address;
    fs.writeFileSync(addressFilePath, JSON.stringify(addressData, null, 2));
}

async function deploy(contractName, instanceName, args, artifact = null, silent = false, save = true) {
    let contr;

    if (artifact) {
        const signer = (await ethers.getSigners())[0];
        const Factory = new ethers.ContractFactory(
            artifact.abi,
            artifact.bytecode,
            signer,
        );
        contr = await Factory.deploy(...args);
    }
    else {
        contr = await ethers.deployContract(contractName, args);
    }

    await contr.waitForDeployment();

    if (!silent) {
        console.log(clc.green(`[${contractName} : ${instanceName}] Deployment successful:`, await contr.getAddress()));
    }
    if (save) {
        saveContractAddress(instanceName, await contr.getAddress())
    }

    return contr
}


async function useContract(contractName, contractAddress, artifact = null) {
    const signer = (await ethers.getSigners())[0];
    if (artifact == null) {
        artifact = require(`../artifacts/contracts/interfaces/${contractName}.sol/${contractName}.json`);
    }
    return new ethers.Contract(contractAddress, artifact.abi, signer);
}


async function getContract(contractName, instanceName, artifact = null, contractAddress = null) {
    if (contractAddress == null) {
        contractAddress = loadContractAddress(instanceName);
    }

    let lock

    if (artifact == null){
        const factory = await ethers.getContractFactory(contractName);
        lock = factory.attach(contractAddress);
    }
    else {
        const factory = new ethers.ContractFactory(
            artifact.abi,
            artifact.bytecode,
            (await ethers.getSigners())[0]
        );
        lock = factory.attach(contractAddress)
    }

    return lock;
}


function loadContractAddress(instanceName) {
    const addressFilePath = path.resolve(__dirname, '../addresses.json');
    const addressData = JSON.parse(fs.readFileSync(addressFilePath, 'utf8'));
    const contractAddress = addressData[instanceName];

    return contractAddress;
}

async function printEvents(receipt, contract) {
    console.log('\n------------------- Events -------------------\n')

    address = await contract.getAddress();

    const events = receipt.logs.map((log) => {
        try {
            if (log.address.toLowerCase() !== address.toLowerCase()) {
                return null
            }

            console.log('-------------------------');
            console.log('  Event:', log.topics[0]);
            console.log('  Args1:', log.topics.slice(1));
            console.log('  Args2:', log.data);
            return contract.interface.parseLog(log);
        } catch (error) {
            // If the log is not from this contract, it will throw an error
            return null;
        }
    }).filter(log => log !== null);

    events.forEach((event) => {
        console.log(`Event ${event.name} with args:`, event.args);
    });
}


async function getTokenContract(tokenAddress) {
    const erc20CCLAbi = [
        {
            "inputs": [
            {
                "internalType": "address",
                "name": "owner",
                "type": "address"
            }
            ],
            "name": "balanceOf",
            "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "owner",
                    "type": "address"
                },
                {
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                }
            ],
            "name": "allowance",
            "outputs": [
                {
                    "internalType": "uint256",
                    "name": "",
                    "type": "uint256"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "spender",
                    "type": "address"
                },
                {
                    "internalType": "uint256",
                    "name": "amount",
                    "type": "uint256"
                }
            ],
            "name": "approve",
            "outputs": [
                {
                    "internalType": "bool",
                    "name": "",
                    "type": "bool"
                }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs":[],
            "name":"decimals",
            "outputs":[{"internalType":"uint8","name":"","type":"uint8"}],
            "stateMutability":"view",
            "type":"function"
        },
        {
            "inputs": [],
            "name": "getInfo",
            "outputs": [
              {
                "components": [
                  {
                    "internalType": "string",
                    "name": "name",
                    "type": "string"
                  },
                  {
                    "internalType": "string",
                    "name": "symbol",
                    "type": "string"
                  },
                  {
                    "internalType": "uint8",
                    "name": "decimals",
                    "type": "uint8"
                  },
                  {
                    "internalType": "string",
                    "name": "l1Address",
                    "type": "string"
                  },
                  {
                    "internalType": "address",
                    "name": "l2Address",
                    "type": "address"
                  }
                ],
                "internalType": "struct TokenInfo",
                "name": "",
                "type": "tuple"
              }
            ],
            "stateMutability": "view",
            "type": "function"
        },
    ];

    return new ethers.Contract(tokenAddress, erc20CCLAbi, (await ethers.getSigners())[0])
}

async function getTokenAddress(l1Address) {
    const tokenUtilsAddress = process.env.EVM_TOKENUTILS_ADDRESS;
    const tokenUtilsContract = await useContract('ITokenUtils', tokenUtilsAddress);

    const tokenL2Address = await tokenUtilsContract.computeAddress(
        l1Address,
        process.env.EVM_SETTINGS_ADDRESS
    );

    return tokenL2Address;
}

function hexStringToByteArray(hexString) {
    hexString = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    if (hexString.length % 2 !== 0) {
        throw new Error('Hex string must have an even number of characters');
    }

    const byteArray = [];
    for (let i = 0; i < hexString.length; i += 2) {
        const byte = parseInt(hexString.substr(i, 2), 16);
        byteArray.push(byte);
    }

    return byteArray;
}


function commutativeKeccak256(a, b) {
    return BigInt(a) < BigInt(b) ? efficientKeccak256(a, b) : efficientKeccak256(b, a);
}


function efficientKeccak256(a, b) {
    a = a.startsWith('0x') ? a.slice(2) : a;
    b = b.startsWith('0x') ? b.slice(2) : b;

    a = a.padStart(64, '0');
    b = b.padStart(64, '0');
    const concatenated = a + b;

    return ethers.keccak256('0x' + concatenated);
}


function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, 1000*s))
}


function getSelectorsFromABI(abi) {
    const selectors = {
        errors: {},
        events: {}
    };

    abi.forEach(item => {
        if (item.type === 'error' || item.type === 'event') {
            const signature = `${item.name}(${item.inputs.map(input => input.type).join(',')})`;
            const selector = ethers.id(signature).slice(0, 10);

            if (item.type === 'error') {
                selectors.errors[item.name] = selector;
            } else {
                selectors.events[item.name] = selector;
            }
        }
    });

    return selectors;
}


function printSelectorsFromABI(abiFiles) {
    abiFiles.forEach(file => {
        const fileName = path.basename(file, '.json');
        const fileContent = fs.readFileSync(file, 'utf8');
        const jsonContent = JSON.parse(fileContent);
        const abi = jsonContent.abi;
    
        const selectors = getSelectorsFromABI(abi);
    
        console.log(`\nContract: ${fileName} ==================`);
        console.log('Errors:');
        Object.entries(selectors.errors).forEach(([name, selector]) => {
            console.log(`  ${selector}: ${name}`);
        });
        console.log('Events:');
        Object.entries(selectors.events).forEach(([name, selector]) => {
            console.log(`  ${selector}: ${name}`);
        });
    });
}

async function waitForNextBlock(provider = null) {
    if (provider == null) {
        provider = ethers.provider;
    }

    // current block
    const currentBlockNumber = await provider.getBlockNumber();

    // resolve promise when a new block is mined
    return new Promise((resolve) => {
        provider.on('block', (blockNumber) => {
            if (blockNumber > currentBlockNumber) {
                provider.removeAllListeners('block');
                resolve(blockNumber);
            }
        });
    });
}

async function mineBlocks(numBlocks) {
    for (let i = 0; i < numBlocks; i++) {
        await ethers.provider.send("evm_mine");
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getLatestBlockTimestamp() {
    const latestBlock = await ethers.provider.getBlock("latest");
    const timestamp = latestBlock.timestamp;
    return timestamp;
}

async function sendEmptyTransaction(signer) {
    await delay(1000); 
    
    const currentTime = Math.floor(Date.now() / 1000);

    // new block every 7 seconds
    if (currentTime - await getLatestBlockTimestamp() < 7) {
        return
    }

    // try to set next block time
    try {
        await network.provider.send("evm_setNextBlockTimestamp", [currentTime]);
        await network.provider.send("evm_mine"); 
    } catch {
        return;
    }

    const tx = await signer.sendTransaction({
        to: '0x0000000000000000000000000000000000000000',
        value: 0,
        gasLimit: 100_000,
    });
    await tx.wait();
    return tx;
}

async function waitForBlocks(numBlocks, signer, forceBlockCreation = true) {
    const startBlock = await ethers.provider.getBlockNumber();
    const endBlock = startBlock + numBlocks;

    return new Promise((resolve) => {
        const checkBlock = async () => {
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock >= endBlock) {
                resolve(currentBlock);
            } else {
                if (forceBlockCreation) {
                    await sendEmptyTransaction(signer);
                }
                setTimeout(checkBlock, 1000); // Check every second
            }
        };
        checkBlock();
    });
}


async function waitForNextEpoch(currentEpoch=null, forceNext=false, delaySec=1, maxIters=30, test=false) {
    console.log('waiting for the next epoch...')

    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);

    if (currentEpoch == null) {
        const result = await crossChainLayerContract.getCurrentEpoch();
        currentEpoch = result[0];
    }

    var iter = 0;

    // resolve promise when a new epoch reached
    return new Promise((resolve, reject) => {
        const checkEpoch = async () => {
            try {
                const result = await crossChainLayerContract.getCurrentEpoch();
                const newEpoch = result[0];
                const isConsensus = result[1];
                if (!isConsensus && !forceNext) {
                    resolve(newEpoch);
                }

                if (iter >= maxIters) {
                    resolve(newEpoch);
                    throw new Error('Try number exceeded');
                }

                if (newEpoch > currentEpoch) {
                    resolve(newEpoch);
                } else {
                    iter += 1;
                    if (test) {
                        await mineBlocks(1);
                    } else {
                        const signer = (await ethers.getSigners())[0];
                        await waitForBlocks(1, signer);
                    }
                    setTimeout(checkEpoch, delaySec * 100);
                }
            } catch (error) {
                reject(error);
            }
        };

        checkEpoch();
    });
}


async function sendSimpleMessage(message, verbose=false) {
    // setup
    const crossChainLayerContract = await useContract('ICrossChainLayer', process.env.EVM_CCL_ADDRESS);
    const groupContract = await useContract('IGroup', process.env.EVM_GROUP_ADDRESS);
    const treeUtilsContract = await useContract('IMerkleTreeUtils', process.env.EVM_MERKLETREEUTILS_ADDRESS);

    // fill message
    if (message['queryId'] == null) {
        message['queryId'] = 0;
    }
    if (message['operationId'] == null) {
        message['operationId'] = "";
    }
    if (message['timestamp'] == null) {
        message['timestamp'] = Math.floor(Date.now() / 1000);
    }

    if (verbose) {
        console.log('sending message:');
        console.log(message);
    }

    // clear epoch
    await waitForNextEpoch(currentEpoch=null, forceNext=false);
    // set proper Merkle root
    const messageHash = await treeUtilsContract.hashInMessage(message);

    const tx = await groupContract.vote(messageHash);
    await tx.wait();

    if (verbose) {
        console.log('set new Merkle root:', messageHash);
        console.log('group:')
        console.log(await groupContract.getAddress());
        console.log(await groupContract.getCurrentEpoch());
        console.log(await groupContract.getValue());
        console.log(await groupContract.totalVoters());
        console.log('CCL:')
        console.log(await crossChainLayerContract.getAddress());
        console.log(await crossChainLayerContract.getCurrentEpoch());
        console.log(await crossChainLayerContract.getValue());
        console.log(await crossChainLayerContract.totalVoters());

        console.log('message args:', message.arguments)
    }

    // execute message
    const resTx = await crossChainLayerContract.receiveMessage(message, [], 0);
    const receipt =  await resTx.wait();

    console.log(`Transaction successful: ${receipt.transactionHash}`);
    console.log(receipt.toString());

    return receipt
}


async function deployToken(
    tokenName,
    tokenSymbol,
    tokenDecimals,
    tokenDescription,
    tokenImage,
    tokenL1Address,
    verbose=false
) {
    // setup
    const tokenL2Address = await getTokenAddress(tokenL1Address);

    // create and send CCL message

    const message = {
        queryId: 123,
        timestamp: Math.floor(Math.random() * 2**32),
        target: ZERO_ADDRESS,
        methodName: '',
        arguments: '0x',
        caller: 'EQB4EHxrOyEfeImrndKemPRLHDLpSkuHUP9BmKn59TGly2Jk',
        mint: [],
        unlock: [],
        meta: [{
            name: tokenName,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
            description: tokenDescription,
            image: tokenImage,
            l1Address: tokenL1Address,
        }],
    };

    await sendSimpleMessage(message, verbose=true);

    // check deployment
    const tokenContract = await getTokenContract(tokenL2Address);
    const tokenInfo = await tokenContract.getInfo();

    // save token address
    saveContractAddress(tokenSymbol, tokenL2Address);

    if (verbose) {
        console.log(`Token ${tokenSymbol} deployed successfully: ${tokenL2Address}, info: ${tokenInfo}`);
    }

    return tokenL2Address;
}

function balanceFormat(tokenAmount, digits, precision = 6) {
    const humanReadable = BigInt(10) ** BigInt(precision) * tokenAmount / (BigInt(10) ** BigInt(digits))
    const roundedValue = (Number.parseFloat(humanReadable) / (10**precision)).toFixed(precision);
    return roundedValue;
}


async function printContractBalance(name, contractAddress, tokenAddresses, tokens) {
    console.log(`${name} balances:`);

    for (const tokenName of tokens) {
        const tokenAddress = tokenAddresses[tokenName];
        const tokenContract = await getTokenContract(tokenAddress);
        const tokenBalance = await tokenContract.balanceOf(contractAddress)
        const tokenDigits = await tokenContract.decimals()
        console.log(`  ${tokenName}:`.padEnd(13, ' '), balanceFormat(tokenBalance, tokenDigits));
    }
}


module.exports = {
    balanceFormat,
    printEvents,
    useContract,
    getContract,
    getTokenContract,
    loadContractAddress,
    hexStringToByteArray,
    commutativeKeccak256,
    saveContractAddress,
    deploy,
    sleep,
    getSelectorsFromABI,
    printSelectorsFromABI,
    waitForNextBlock,
    waitForNextEpoch,
    sendSimpleMessage,
    deployToken,
    getTokenAddress,
    printContractBalance,
};
