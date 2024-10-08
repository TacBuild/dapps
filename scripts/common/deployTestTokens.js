const { deployToken } = require('../utils.js');


async function main(suffix) {
    const tokenAAddress = await deployToken(
        `stTON${suffix}`, `stTON${suffix}`, 9, 
        'EQDJfaGp5pgN8oVGyCQI0AvUPMiuMyzaWq7Ckdf_wVZYm1IY')
    const tokenBAddress = await deployToken(
        `TAC'${suffix}`, `TAC${suffix}`, 9, 
        'EQC7-W1nM4DwUnI4_vGnQcLjgwYSw6hQixCdBF1XD_rmZAYZ')

    console.log(tokenAAddress, tokenBAddress);    
}


main('');
