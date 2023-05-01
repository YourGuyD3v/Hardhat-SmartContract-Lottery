const { network, getNamedAccounts, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

developmentChains.includes(network.name) ? describe.skip
: describe("Raflle stagging testing", function () {
    let raffle, deployer, raffleEntranceFee

    beforeEach(async () => {
         deployer  = (await getNamedAccounts()).deployer
         raffle = await ethers.getContract("Raffle", deployer)
         raffleEntranceFee = await raffle.getEntranceFee()
    })

    describe("fulfillRandomWords", function () {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
            // Enter the raffle
            console.log("Setting up test...")
            const startingTimeStamp = await raffle.getLastTimeStamp()
            const accounts = await ethers.getSigners()

             // setup listener before we enter the raffle
            // Just in case the blockchain moves REALLY fast
            console.log("Setting up Listener...")
            await new Promise(async (resolve, reject) => {
                raffle.once("WinnerPicked", async () => {
                    console.log("WinnerPicked event fired!")
                    try {
                        // add our asserts here
                        const recentWinner = await raffle.getRecentWinner()
                        const raffleState = await raffle.getRaffleState()
                        const winnerEndingBalance = await accounts[0].getBalance()
                        const endingTimeStamp = await raffle.getLastTimeStamp()

                        await expect(raffle.getPlayer(0)).to.be.reverted
                        assert(recentWinner.toString(), accounts[0].address)
                        assert(raffleState, 0)
                        assert(winnerEndingBalance.toString(), winnerStartingBalance.add(raffleEntranceFee).toString())
                        assert(endingTimeStamp > startingTimeStamp)

                        resolve()
                    } catch(error){
                        console.log(error)
                        reject(error)
                    } 
                })
            }) 
        
            // Then entering the raffle
            console.log("Entering raffle...")
            const tx = await raffle.enterRaffle({value: raffleEntranceFee})
            const txReceipt = await tx.wait(1)
            console.log("Ok, time to wait...")
            const winnerStartingBalance = await accounts[0].getBalance()

            // and this code WONT complete until our listener has finished listening!
        })
    })
})