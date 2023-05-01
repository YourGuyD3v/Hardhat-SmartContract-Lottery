const { ethers } = require("hardhat")
require("dotenv").config()
const fs = require("fs")
const { network } = require("hardhat")

const frontEndContractsFile = '../nextjs-smartcontract-lottery/constants/contractAddress.json'
const frontEndAbiFile = '../nextjs-smartcontract-lottery/constants/abi.json'

module.exports = async () =>{
    if(process.env.UPDATE_FRONT_END){
    console.log("Writing to frontend....")
    frontendContractAddress()
    frondendAbi()
    }
}

async function frondendAbi(){
    const raffle = await ethers.getContract("Raffle")
    fs.writeFileSync(frontEndAbiFile, raffle.interface.format(ethers.utils.FormatTypes.json))
}

async function frontendContractAddress(){
    const raffle = await ethers.getContract("Raffle")
    const contractAddress = JSON.parse(fs.readFileSync(frontEndContractsFile, "utf-8"))
    if(network.config.chainId.toString() in contractAddress){
        if(!contractAddress[network.config.chainId.toString()].includes(raffle.address)){
            contractAddress[network.config.chainId.toString()].push(raffle.address)
        }
    } else {
       contractAddress[network.config.chainId.toString()] = raffle.address
    }
    fs.writeFileSync(frontEndContractsFile, JSON.stringify(contractAddress))
}

module.exports.tags = ["all", 'frontend']